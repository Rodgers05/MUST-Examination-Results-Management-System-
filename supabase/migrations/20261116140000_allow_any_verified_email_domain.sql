-- Permit any syntactically valid email domain for new accounts.
-- Supabase email confirmation remains mandatory before portal access.
-- Every new profile is STUDENT/PENDING; privileged roles remain administrator-assigned.
create or replace function public.handle_new_must_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
begin
  if v_email = '' or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'A valid email address is required'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, institutional_email, full_name, role, account_status)
  values (new.id, v_email, v_name, 'STUDENT', 'PENDING')
  on conflict (id) do nothing;

  return new;
end;
$function$;
