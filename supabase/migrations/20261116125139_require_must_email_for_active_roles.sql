-- Existing non-MUST profiles remain stored, but cannot obtain application roles
-- or pass role-based RLS checks. New Auth users are separately rejected by
-- public.handle_new_must_user().
create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.account_status = 'ACTIVE'
    and (
      lower(split_part(btrim(p.institutional_email), '@', 2)) = 'must.ac.ug'
      or lower(split_part(btrim(p.institutional_email), '@', 2)) like '%.must.ac.ug'
    )
  limit 1
$function$;
