-- Require real MUST inbox verification for all new authentication flows.
--
-- RELEASE GATE:
-- 1. Verify production SMTP confirmation and password-reset delivery first.
-- 2. In Supabase Auth, enable email confirmations (disable automatic email confirmation).
-- 3. Review the existing-account re-verification plan before applying this migration.
-- 4. Apply only through the reviewed migration process with a current backup/rollback plan.
--
-- This migration deliberately does NOT clear email_confirmed_at for existing users.
-- The legacy auto-confirm trigger may have marked existing MUST addresses as confirmed.
-- Those accounts need a separate, communicated re-verification operation after SMTP works.

BEGIN;

-- Remove the legacy trigger that silently confirms every MUST-domain signup.
DROP TRIGGER IF EXISTS auto_confirm_must_signup ON auth.users;

-- Enforce the institutional domain at the database boundary as well as in the app.
CREATE OR REPLACE FUNCTION private.enforce_must_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(NEW.email, '')));
  v_domain text := lower(split_part(btrim(coalesce(NEW.email, '')), '@', 2));
BEGIN
  IF v_email = ''
     OR length(v_email) > 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR v_domain NOT IN ('must.ac.ug', 'std.must.ac.ug') THEN
    RAISE EXCEPTION 'A valid MUST institutional email address is required'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_must_auth_email ON auth.users;
CREATE TRIGGER enforce_must_auth_email
BEFORE INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.enforce_must_auth_email();

-- New accounts are pending administrator approval. Inbox verification is
-- derived only from Supabase Auth's actual email_confirmed_at value.
CREATE OR REPLACE FUNCTION public.handle_new_must_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(NEW.email, '')));
  v_domain text := lower(split_part(btrim(coalesce(NEW.email, '')), '@', 2));
  v_name text := coalesce(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
BEGIN
  IF v_email = ''
     OR length(v_email) > 254
     OR v_domain NOT IN ('must.ac.ug', 'std.must.ac.ug') THEN
    RAISE EXCEPTION 'A MUST institutional email address is required'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (
    id, institutional_email, full_name, role, account_status, email_verified
  )
  VALUES (
    NEW.id,
    v_email,
    v_name,
    'STUDENT',
    'PENDING',
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Keep the profile verification flag synchronized when Supabase Auth confirms
-- an address or when the account changes its email address.
CREATE OR REPLACE FUNCTION private.sync_profile_email_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.profiles
  SET institutional_email = lower(NEW.email),
      email_verified = (NEW.email_confirmed_at IS NOT NULL),
      updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_profile_email_verification ON auth.users;
CREATE TRIGGER sync_profile_email_verification
AFTER UPDATE OF email_confirmed_at, email ON auth.users
FOR EACH ROW
WHEN (
  OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
  OR OLD.email IS DISTINCT FROM NEW.email
)
EXECUTE FUNCTION private.sync_profile_email_verification();

-- Administrator approval controls account status and role only. It must never
-- manufacture inbox verification or write auth.users.email_confirmed_at.
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
  v_email_verified boolean;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Administrator permission required';
  END IF;

  IF p_role NOT IN ('ADMIN','LECTURER','REVIEWER','REGISTRAR','STUDENT') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_status NOT IN ('PENDING','ACTIVE','SUSPENDED') THEN
    RAISE EXCEPTION 'Invalid account status';
  END IF;

  SELECT lower(btrim(institutional_email)), email_verified
  INTO v_email, v_email_verified
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
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
      'email_verified', v_email_verified,
      'email_domain', split_part(coalesce(v_email, ''), '@', 2)
    )
  );
END;
$function$;


-- RLS authorization must use the same verified MUST identity boundary as the app.
-- Also compare the profile address with the Auth source of truth so a stale or
-- mismatched profile flag cannot grant database access.
CREATE OR REPLACE FUNCTION private.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.role
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = (SELECT auth.uid())
    AND p.account_status = 'ACTIVE'
    AND p.email_verified IS TRUE
    AND u.email_confirmed_at IS NOT NULL
    AND lower(btrim(coalesce(u.email, ''))) = lower(btrim(coalesce(p.institutional_email, '')))
    AND lower(split_part(btrim(coalesce(u.email, '')), '@', 2)) IN ('must.ac.ug', 'std.must.ac.ug')
  LIMIT 1
$function$;

-- These functions are trigger-only. They must not be directly executable
-- through PostgREST or by arbitrary SQL callers.
REVOKE ALL ON FUNCTION private.enforce_must_auth_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_profile_email_verification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.audit_enrollment_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_exam_mark_attendance_eligibility() FROM PUBLIC, anon, authenticated;

COMMIT;

-- OPERATIONAL FOLLOW-UP (not part of this migration):
-- After SMTP delivery is proven and existing users are notified, re-verify
-- legacy accounts whose confirmation state may have been set by the old
-- auto-confirm trigger. Prepare a separate, reviewed operation that clears
-- their auth.users.email_confirmed_at and public.profiles.email_verified
-- together; do not run an unreviewed bulk reset.
