-- MUST undergraduate result calculation update
-- Apply to the Supabase project before publishing real results.
-- Coursework and end-of-semester examination contributions are calculated
-- separately, then mapped to the official MUST 2023 undergraduate grade scale.

ALTER TABLE public.published_results
  ADD COLUMN IF NOT EXISTS coursework_mark numeric(5,2),
  ADD COLUMN IF NOT EXISTS exam_mark numeric(5,2),
  ADD COLUMN IF NOT EXISTS grade_value numeric(2,1);

CREATE OR REPLACE FUNCTION public.publish_approved_results(p_submission_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_offering uuid;
  v_count integer;
  v_assessment_count integer;
BEGIN
  IF private.current_role() <> 'REGISTRAR' THEN
    RAISE EXCEPTION 'An active registrar account is required';
  END IF;

  SELECT offering_id INTO v_offering
  FROM public.result_submissions
  WHERE id = p_submission_id AND status = 'APPROVED'
  FOR UPDATE;

  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'Only approved submissions can be published';
  END IF;
  IF NOT private.is_assigned(v_offering, ARRAY['REGISTRAR']::text[]) THEN
    RAISE EXCEPTION 'Only the assigned active registrar may publish results';
  END IF;

  SELECT count(*) INTO v_assessment_count
  FROM public.assessments WHERE offering_id = v_offering;
  IF v_assessment_count = 0 THEN
    RAISE EXCEPTION 'Cannot publish: no assessments are configured';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.offering_id = v_offering
    GROUP BY a.offering_id
    HAVING abs(sum(a.weight) - 100) > 0.01
       OR sum(a.weight) FILTER (WHERE a.assessment_type = 'EXAM') > 60.01
       OR sum(a.weight) FILTER (WHERE a.assessment_type <> 'EXAM') > 40.01
  ) THEN
    RAISE EXCEPTION 'MUST assessment weights must total 100 percent, with coursework at most 40 percent and examinations at most 60 percent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assessments
    WHERE offering_id = v_offering AND assessment_type = 'EXAM'
  ) THEN
    RAISE EXCEPTION 'An end-of-semester examination assessment is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.enrollments e
    CROSS JOIN public.assessments a
    LEFT JOIN public.marks m
      ON m.assessment_id = a.id AND m.student_id = e.student_id
    WHERE e.offering_id = v_offering
      AND e.enrollment_status = 'ENROLLED'
      AND a.offering_id = v_offering
      AND m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot publish: one or more enrolled students have missing assessment marks';
  END IF;

  INSERT INTO public.published_results
    (offering_id, student_id, coursework_mark, exam_mark, total_mark, grade, grade_value)
  SELECT
    v_offering,
    e.student_id,
    round(sum((m.mark / a.maximum_mark) * a.weight) FILTER (WHERE a.assessment_type <> 'EXAM'), 2),
    round(sum((m.mark / a.maximum_mark) * a.weight) FILTER (WHERE a.assessment_type = 'EXAM'), 2),
    round(sum((m.mark / a.maximum_mark) * a.weight), 2),
    CASE
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 80 THEN 'A'
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 75 THEN 'B+'
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 70 THEN 'B'
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 65 THEN 'C+'
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 60 THEN 'C'
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 55 THEN 'D+'
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 50 THEN 'D'
      ELSE 'F'
    END,
    CASE
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 80 THEN 5.0
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 75 THEN 4.5
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 70 THEN 4.0
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 65 THEN 3.5
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 60 THEN 3.0
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 55 THEN 2.5
      WHEN sum((m.mark / a.maximum_mark) * a.weight) >= 50 THEN 2.0
      ELSE NULL
    END
  FROM public.enrollments e
  JOIN public.assessments a ON a.offering_id = e.offering_id
  JOIN public.marks m ON m.assessment_id = a.id AND m.student_id = e.student_id
  WHERE e.offering_id = v_offering AND e.enrollment_status = 'ENROLLED'
  GROUP BY e.student_id
  ON CONFLICT (offering_id, student_id) DO UPDATE
    SET coursework_mark = EXCLUDED.coursework_mark,
        exam_mark = EXCLUDED.exam_mark,
        total_mark = EXCLUDED.total_mark,
        grade = EXCLUDED.grade,
        grade_value = EXCLUDED.grade_value,
        published_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.result_submissions
  SET status = 'PUBLISHED', published_at = now()
  WHERE id = p_submission_id;

  INSERT INTO public.review_actions(submission_id, actor_id, action, comments)
  VALUES (p_submission_id, (SELECT auth.uid()), 'PUBLISHED', 'Results released to students');

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (
    (SELECT auth.uid()), 'PUBLISHED', 'result_submission', p_submission_id::text,
    jsonb_build_object('students_published', v_count)
  );

  RETURN v_count;
END;
$function$;
