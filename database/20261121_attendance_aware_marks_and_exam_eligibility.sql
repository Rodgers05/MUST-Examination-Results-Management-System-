-- Align the lecturer marks workspace and atomic RPC with the existing 80% attendance rule.
-- Coursework marks remain available to every actively enrolled student.
-- Examination marks require a complete attendance register and >= 80% presence.
-- Result submission remains blocked until every enrolled student meets that rule.
-- Apply only after this migration has been tested on an isolated staging database.

BEGIN;

CREATE OR REPLACE FUNCTION private.student_attendance_eligible(
  p_offering_id uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH attendance AS (
    SELECT
      count(DISTINCT s.id)::integer AS sessions,
      count(DISTINCT ar.session_id)::integer AS recorded,
      count(DISTINCT ar.session_id) FILTER (
        WHERE ar.attendance_status = 'PRESENT'
      )::integer AS present
    FROM public.attendance_sessions s
    LEFT JOIN public.attendance_records ar
      ON ar.session_id = s.id
     AND ar.student_id = p_student_id
    WHERE s.offering_id = p_offering_id
  )
  SELECT COALESCE(
    attendance.sessions > 0
    AND attendance.recorded = attendance.sessions
    AND attendance.present::numeric / NULLIF(attendance.sessions, 0)::numeric >= 0.80,
    false
  )
  FROM attendance
$function$;

REVOKE ALL ON FUNCTION private.student_attendance_eligible(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- PostgreSQL cannot change a RETURNS TABLE output-column name with CREATE OR REPLACE.
-- No database objects depend on this RPC signature; recreate it with the new column name.
DROP FUNCTION IF EXISTS public.get_assigned_offering_student_roster(uuid);

CREATE FUNCTION public.get_assigned_offering_student_roster(p_offering_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  student_number text,
  institutional_email text,
  attendance_sessions integer,
  attendance_recorded integer,
  attendance_present integer,
  attendance_percentage numeric,
  attendance_eligible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text := private.current_role();
BEGIN
  IF auth.uid() IS NULL
     OR v_role IS NULL
     OR v_role NOT IN ('ADMIN', 'LECTURER', 'REVIEWER', 'REGISTRAR') THEN
    RAISE EXCEPTION 'An authorised academic staff account is required'
      USING errcode = '42501';
  END IF;

  IF v_role <> 'ADMIN'
     AND NOT private.is_assigned(p_offering_id, ARRAY[v_role]::text[]) THEN
    RAISE EXCEPTION 'You are not assigned to this course offering'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COALESCE(p.student_number, ''),
    p.institutional_email,
    attendance.sessions,
    attendance.recorded,
    attendance.present,
    CASE
      WHEN attendance.sessions > 0
        THEN round(attendance.present::numeric * 100 / attendance.sessions::numeric, 2)
      ELSE NULL
    END,
    private.student_attendance_eligible(e.offering_id, e.student_id)
  FROM public.enrollments e
  JOIN public.profiles p ON p.id = e.student_id
  CROSS JOIN LATERAL (
    SELECT
      count(DISTINCT s.id)::integer AS sessions,
      count(DISTINCT ar.session_id)::integer AS recorded,
      count(DISTINCT ar.session_id) FILTER (
        WHERE ar.attendance_status = 'PRESENT'
      )::integer AS present
    FROM public.attendance_sessions s
    LEFT JOIN public.attendance_records ar
      ON ar.session_id = s.id
     AND ar.student_id = e.student_id
    WHERE s.offering_id = e.offering_id
  ) attendance
  WHERE e.offering_id = p_offering_id
    AND e.enrollment_status = 'ENROLLED'
  ORDER BY p.full_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_assigned_offering_student_roster(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assigned_offering_student_roster(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_batch_marks(p_offering_id uuid, p_marks jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_submission_status text;
  v_assessment_count integer;
  v_enrolled_count integer;
  v_eligible_exam_count integer;
  v_expected_count integer;
  v_input_count integer;
  v_distinct_count integer;
  v_saved_count integer;
BEGIN
  IF v_user_id IS NULL OR private.current_role() IS DISTINCT FROM 'LECTURER' THEN
    RAISE EXCEPTION 'An active lecturer account is required'
      USING errcode = '42501';
  END IF;

  IF NOT private.is_assigned(p_offering_id, ARRAY['LECTURER']::text[]) THEN
    RAISE EXCEPTION 'You are not assigned to this course offering'
      USING errcode = '42501';
  END IF;

  IF p_marks IS NULL OR jsonb_typeof(p_marks) <> 'array' THEN
    RAISE EXCEPTION 'Marks must be submitted as an array'
      USING errcode = '22023';
  END IF;

  SELECT s.status
  INTO v_submission_status
  FROM public.result_submissions s
  WHERE s.offering_id = p_offering_id
  FOR UPDATE;

  IF FOUND AND v_submission_status <> 'RETURNED' THEN
    RAISE EXCEPTION 'Marks are locked while the submission is under review, approved or published'
      USING errcode = '55000';
  END IF;

  SELECT count(*)::integer
  INTO v_assessment_count
  FROM public.assessments a
  WHERE a.offering_id = p_offering_id;

  SELECT count(*)::integer
  INTO v_enrolled_count
  FROM public.enrollments e
  WHERE e.offering_id = p_offering_id
    AND e.enrollment_status = 'ENROLLED';

  SELECT count(*)::integer
  INTO v_eligible_exam_count
  FROM public.enrollments e
  WHERE e.offering_id = p_offering_id
    AND e.enrollment_status = 'ENROLLED'
    AND private.student_attendance_eligible(p_offering_id, e.student_id);

  IF v_assessment_count = 0 OR v_enrolled_count = 0 THEN
    RAISE EXCEPTION 'Configure assessments and active student enrolments before entering marks'
      USING errcode = '22023';
  END IF;

  -- Require all coursework marks for all enrolled students, but examination
  -- marks only for students who have a complete register and >= 80% attendance.
  SELECT count(*)::integer
  INTO v_expected_count
  FROM public.assessments a
  JOIN public.enrollments e
    ON e.offering_id = a.offering_id
   AND e.enrollment_status = 'ENROLLED'
  WHERE a.offering_id = p_offering_id
    AND (
      a.assessment_type <> 'EXAM'
      OR private.student_attendance_eligible(p_offering_id, e.student_id)
    );

  IF v_expected_count = 0 THEN
    RAISE EXCEPTION 'No marks are eligible to be entered. Configure coursework assessments and record attendance before examination marks.'
      USING errcode = '22023';
  END IF;

  SELECT
    count(*)::integer,
    count(DISTINCT ((item->>'assessment_id') || ':' || (item->>'student_id')))::integer
  INTO v_input_count, v_distinct_count
  FROM jsonb_array_elements(p_marks) AS item;

  IF v_input_count <> v_expected_count OR v_distinct_count <> v_expected_count THEN
    RAISE EXCEPTION 'Submit every coursework mark for enrolled students and examination marks only for students with at least 80 percent attendance'
      USING errcode = '22023';
  END IF;

  IF EXISTS (
    WITH input_marks AS (
      SELECT *
      FROM jsonb_to_recordset(p_marks)
        AS r(assessment_id uuid, student_id uuid, mark numeric)
    )
    SELECT 1
    FROM input_marks i
    LEFT JOIN public.assessments a
      ON a.id = i.assessment_id
     AND a.offering_id = p_offering_id
    LEFT JOIN public.enrollments e
      ON e.offering_id = p_offering_id
     AND e.student_id = i.student_id
     AND e.enrollment_status = 'ENROLLED'
    WHERE a.id IS NULL
       OR e.student_id IS NULL
       OR i.mark IS NULL
       OR i.mark < 0
       OR i.mark > a.maximum_mark
       OR (
         a.assessment_type = 'EXAM'
         AND NOT private.student_attendance_eligible(p_offering_id, i.student_id)
       )
  ) THEN
    RAISE EXCEPTION 'A mark references an unassigned assessment, non-enrolled student, invalid mark or examination-ineligible student'
      USING errcode = '22023';
  END IF;

  -- Do not silently retain an examination mark if a later attendance correction
  -- makes that student ineligible. Require an authorised review of that record.
  IF EXISTS (
    SELECT 1
    FROM public.marks m
    JOIN public.assessments a ON a.id = m.assessment_id
    JOIN public.enrollments e
      ON e.offering_id = p_offering_id
     AND e.student_id = m.student_id
     AND e.enrollment_status = 'ENROLLED'
    WHERE a.offering_id = p_offering_id
      AND a.assessment_type = 'EXAM'
      AND NOT private.student_attendance_eligible(p_offering_id, e.student_id)
  ) THEN
    RAISE EXCEPTION 'An existing examination mark belongs to a student who no longer meets the attendance rule. Review that record before saving.'
      USING errcode = '23514';
  END IF;

  INSERT INTO public.marks (assessment_id, student_id, mark, entered_by, updated_by)
  SELECT r.assessment_id, r.student_id, r.mark, v_user_id, v_user_id
  FROM jsonb_to_recordset(p_marks) AS r(assessment_id uuid, student_id uuid, mark numeric)
  ON CONFLICT (assessment_id, student_id) DO UPDATE
    SET mark = EXCLUDED.mark,
        updated_by = v_user_id,
        updated_at = now();

  GET DIAGNOSTICS v_saved_count = ROW_COUNT;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_user_id,
    'BATCH_MARKS_SAVED',
    'course_offering',
    p_offering_id::text,
    jsonb_build_object(
      'saved_rows', v_saved_count,
      'assessment_count', v_assessment_count,
      'enrolled_count', v_enrolled_count,
      'eligible_exam_students', v_eligible_exam_count,
      'eligibility_policy', 'COMPLETE_REGISTER_AND_AT_LEAST_80_PERCENT_ATTENDANCE'
    )
  );

  RETURN v_saved_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_batch_marks(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_batch_marks(uuid, jsonb) TO authenticated;

COMMIT;
