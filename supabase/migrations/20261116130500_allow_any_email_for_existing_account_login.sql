-- Existing active accounts may authenticate with any registered email domain.
-- New registrations remain restricted by public.handle_new_must_user().
-- Role assignment and account activation remain administrator-controlled.
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
  limit 1
$function$;
