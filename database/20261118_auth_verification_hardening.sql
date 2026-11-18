-- MUST ERMS: keep account approval separate from email ownership verification.
-- Apply only after reviewing the current production auth provider and SMTP setup.
-- Existing accounts are intentionally not mass-reset here; historical auto-confirmation
-- means their previous confirmation state cannot reliably prove inbox ownership.

-- MUST-domain addresses must not be auto-confirmed. Every email address, regardless
-- of domain, must complete the configured Supabase email/OAuth verification flow.
DROP TRIGGER IF EXISTS auto_confirm_must_signup ON auth.users;
DROP FUNCTION IF EXISTS private.auto_confirm_must_signup();

CREATE OR REPLACE FUNCTION public.handle_new_must_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
BEGIN
  IF v_email = '' OR length(v_email) > 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid email address is required'
      USING errcode = 'check_violation';
  END IF;

  INSERT INTO public.profiles (
    id, institutional_email, full_name, role, account_status, email_verified
  )
  VALUES (
    new.id,
    v_email,
    v_name,
    'STUDENT',
    'PENDING',
    (new.email_confirmed_at IS NOT NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$function$;

-- Keep the profile verification flag synchronized when Supabase confirms or
-- un-confirms an email address (including OAuth provider confirmation).
CREATE OR REPLACE FUNCTION public.sync_profile_email_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.profiles
  SET email_verified = (new.email_confirmed_at IS NOT NULL),
      updated_at = now()
  WHERE id = new.id;

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_profile_email_verification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_profile_email_verification ON auth.users;
CREATE TRIGGER sync_profile_email_verification
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (old.email_confirmed_at IS DISTINCT FROM new.email_confirmed_at)
EXECUTE FUNCTION public.sync_profile_email_verification();

-- RLS and database authorization must enforce the same email-verification gate
-- as the Next.js protected-route guard.
CREATE OR REPLACE FUNCTION private.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
    AND p.account_status = 'ACTIVE'
    AND p.email_verified = true
  LIMIT 1
$function$;

-- Admin approval changes only the role/account status. It must never write to
-- auth.users.email_confirmed_at or set profiles.email_verified.
CREATE OR REPLACE FUNCTION public.admin_set_user_access(
  p_user_id uuid,
  p_role text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required'
      USING errcode = '42501';
  END IF;

  IF p_user_id IS NULL
     OR p_role IS NULL
     OR p_role NOT IN ('ADMIN','LECTURER','REVIEWER','REGISTRAR','STUDENT') THEN
    RAISE EXCEPTION 'Invalid user or role'
      USING errcode = '22023';
  END IF;

  IF p_status IS NULL
     OR p_status NOT IN ('PENDING','ACTIVE','SUSPENDED') THEN
    RAISE EXCEPTION 'Invalid account status'
      USING errcode = '22023';
  END IF;

  SELECT lower(btrim(institutional_email))
  INTO v_email
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found'
      USING errcode = 'P0002';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      account_status = p_status,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (
    (SELECT auth.uid()),
    'USER_ACCESS_UPDATED',
    'profile',
    p_user_id::text,
    jsonb_build_object(
      'role', p_role,
      'status', p_status,
      'email_domain', split_part(coalesce(v_email, ''), '@', 2)
    )
  );
END;
$function$;

-- Cover the two foreign keys reported by Supabase's performance advisor.
CREATE INDEX IF NOT EXISTS attendance_records_recorded_by_idx
  ON public.attendance_records (recorded_by);

CREATE INDEX IF NOT EXISTS attendance_sessions_recorded_by_idx
  ON public.attendance_sessions (recorded_by);
