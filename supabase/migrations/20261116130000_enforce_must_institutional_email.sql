-- Enforce MUST institutional email addresses for all newly created Auth users.
-- Existing accounts are deliberately preserved; no user rows or academic records are modified.
create or replace function public.handle_new_must_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_domain text := split_part(lower(btrim(coalesce(new.email, ''))), '@', 2);
  v_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid MUST institutional email address is required'
      using errcode = 'check_violation';
  end if;

  if not (v_domain = 'must.ac.ug' or v_domain like '%.must.ac.ug') then
    raise exception 'Only MUST institutional email addresses are accepted'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (
    id, institutional_email, full_name, role, account_status
  )
  values (
    new.id, v_email, v_name, 'STUDENT', 'PENDING'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
