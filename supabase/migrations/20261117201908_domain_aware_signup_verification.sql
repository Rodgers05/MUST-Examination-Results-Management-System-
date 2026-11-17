-- Allow every valid email address to register while applying different verification paths.
-- MUST domains are auto-confirmed at Auth insertion; external domains require explicit admin approval.

alter table public.profiles
  add column if not exists email_verified boolean not null default false;

update public.profiles p
set email_verified = exists (
  select 1
  from auth.users u
  where u.id = p.id
    and u.email_confirmed_at is not null
)
where p.email_verified is distinct from exists (
  select 1
  from auth.users u
  where u.id = p.id
    and u.email_confirmed_at is not null
);

create or replace function private.auto_confirm_must_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_domain text := lower(split_part(btrim(coalesce(new.email, '')), '@', 2));
begin
  if v_domain in ('must.ac.ug', 'std.must.ac.ug') then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
    new.confirmed_at := coalesce(new.confirmed_at, new.email_confirmed_at);
  end if;
  return new;
end;
$function$;

drop trigger if exists auto_confirm_must_signup on auth.users;
create trigger auto_confirm_must_signup
before insert on auth.users
for each row
execute function private.auto_confirm_must_signup();

create or replace function public.handle_new_must_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_domain text := lower(split_part(btrim(coalesce(new.email, '')), '@', 2));
  v_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  v_is_must boolean := v_domain in ('must.ac.ug', 'std.must.ac.ug');
begin
  if v_email = '' or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'A valid email address is required'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (
    id, institutional_email, full_name, role, account_status, email_verified
  )
  values (
    new.id,
    v_email,
    v_name,
    'STUDENT',
    case when v_is_must then 'ACTIVE' else 'PENDING' end,
    v_is_must
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

create or replace function public.admin_set_user_access(
  p_user_id uuid,
  p_role text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text;
begin
  if not private.is_admin() then
    raise exception 'Administrator permission required';
  end if;
  if p_role not in ('ADMIN','LECTURER','REVIEWER','REGISTRAR','STUDENT') then
    raise exception 'Invalid role';
  end if;
  if p_status not in ('PENDING','ACTIVE','SUSPENDED') then
    raise exception 'Invalid account status';
  end if;

  select lower(btrim(institutional_email))
  into v_email
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  -- Activating a non-MUST account is the administrator's explicit verification
  -- of that external email address. MUST addresses are verified by the signup trigger.
  if p_status = 'ACTIVE' then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmed_at = coalesce(confirmed_at, now())
    where id = p_user_id
      and email_confirmed_at is null;
  end if;

  update public.profiles
  set role = p_role,
      account_status = p_status,
      email_verified = (email_verified or p_status = 'ACTIVE'),
      updated_at = now()
  where id = p_user_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'USER_ACCESS_UPDATED',
    'profile',
    p_user_id::text,
    jsonb_build_object(
      'role', p_role,
      'status', p_status,
      'email_verified', (p_status = 'ACTIVE'),
      'email_domain', split_part(coalesce(v_email, ''), '@', 2)
    )
  );
end;
$function$;

revoke all on function private.auto_confirm_must_signup() from public, anon, authenticated;
