-- Restore only the table privileges required by existing RLS-backed workflows.
-- RLS policies remain the authorization boundary; no broad table privileges are added.
-- Apply after the verified-MUST identity gate has been reviewed and staged.

BEGIN;

-- Existing policies already restrict these writes to administrators or assigned
-- lecturers, and lock changes once the result workflow has started.
GRANT INSERT, UPDATE ON TABLE public.assessments TO authenticated;

-- The lecturer submission policy requires submitted_by = auth.uid(), status =
-- SUBMITTED, and an active lecturer assignment for the course offering.
GRANT INSERT ON TABLE public.result_submissions TO authenticated;

-- The support policy requires created_by = auth.uid(), an active role and OPEN status.
GRANT INSERT ON TABLE public.support_tickets TO authenticated;

-- Account identifiers remain administrator-controlled. Do not grant users
-- direct UPDATE privileges on student_number or staff_number.
CREATE OR REPLACE FUNCTION public.admin_set_profile_identifiers(
  p_user_id uuid,
  p_student_number text,
  p_staff_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_student_number text := nullif(upper(btrim(coalesce(p_student_number, ''))), '');
  v_staff_number text := nullif(upper(btrim(coalesce(p_staff_number, ''))), '');
  v_identifier_type text;
BEGIN
  IF auth.uid() IS NULL OR private.current_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Administrator permission required'
      USING errcode = '42501';
  END IF;

  SELECT p.role
  INTO v_role
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found'
      USING errcode = 'P0002';
  END IF;

  IF v_role = 'STUDENT' THEN
    IF v_student_number IS NULL OR v_staff_number IS NOT NULL THEN
      RAISE EXCEPTION 'A student registration number is required for a student account'
        USING errcode = '22023';
    END IF;
    IF length(v_student_number) > 40 OR v_student_number !~ '^[A-Z0-9/-]+$' THEN
      RAISE EXCEPTION 'Student registration number format is invalid'
        USING errcode = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.student_number = v_student_number
        AND p.id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Student registration number is already assigned'
        USING errcode = '23505';
    END IF;

    UPDATE public.profiles
    SET student_number = v_student_number,
        staff_number = NULL,
        updated_at = now()
    WHERE id = p_user_id;
    v_identifier_type := 'STUDENT_REGISTRATION';
  ELSE
    IF v_staff_number IS NULL OR v_student_number IS NOT NULL THEN
      RAISE EXCEPTION 'A staff number is required for a staff account'
        USING errcode = '22023';
    END IF;
    IF length(v_staff_number) > 40 OR v_staff_number !~ '^[A-Z0-9/-]+$' THEN
      RAISE EXCEPTION 'Staff number format is invalid'
        USING errcode = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.staff_number = v_staff_number
        AND p.id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Staff number is already assigned'
        USING errcode = '23505';
    END IF;

    UPDATE public.profiles
    SET staff_number = v_staff_number,
        student_number = NULL,
        updated_at = now()
    WHERE id = p_user_id;
    v_identifier_type := 'STAFF_NUMBER';
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (
    (SELECT auth.uid()),
    'PROFILE_IDENTIFIER_UPDATED',
    'profile',
    p_user_id::text,
    jsonb_build_object('identifier_type', v_identifier_type)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_profile_identifiers(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_identifiers(uuid, text, text)
  TO authenticated;

COMMIT;
