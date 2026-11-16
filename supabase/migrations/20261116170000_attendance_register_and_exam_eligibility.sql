-- Attendance register with atomic lecturer submission and 80% examination eligibility.
-- This migration is intentionally branch-only until preview verification.
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  session_date date not null,
  session_title text not null check (char_length(btrim(session_title)) between 2 and 160),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (offering_id, session_date, session_title)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  attendance_status text not null check (attendance_status in ('PRESENT', 'ABSENT')),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index attendance_sessions_offering_date_idx
  on public.attendance_sessions(offering_id, session_date desc);
create index attendance_records_student_session_idx
  on public.attendance_records(student_id, session_id);
create index attendance_records_session_status_idx
  on public.attendance_records(session_id, attendance_status);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

grant select on public.attendance_sessions, public.attendance_records to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.attendance_sessions from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.attendance_records from anon, authenticated;

create policy attendance_sessions_read_authorized
on public.attendance_sessions for select to authenticated
using (
  (select private.is_admin())
  or (select private.is_assigned(offering_id, array['LECTURER','REVIEWER','REGISTRAR']))
  or exists (
    select 1 from public.enrollments e
    where e.offering_id = attendance_sessions.offering_id
      and e.student_id = (select auth.uid())
      and e.enrollment_status = 'ENROLLED'
  )
);

create policy attendance_records_read_authorized
on public.attendance_records for select to authenticated
using (
  student_id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1 from public.attendance_sessions s
    where s.id = attendance_records.session_id
      and (select private.is_assigned(s.offering_id, array['LECTURER','REVIEWER','REGISTRAR']))
  )
);

create or replace function public.record_attendance_session(
  p_offering_id uuid,
  p_session_date date,
  p_session_title text,
  p_attendance jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_enrolled_count integer;
  v_input_count integer;
  v_distinct_count integer;
begin
  if v_user_id is null or private.current_role() is null then
    raise exception 'An active authenticated account is required' using errcode = '42501';
  end if;

  if not (private.is_admin() or private.is_assigned(p_offering_id, array['LECTURER'])) then
    raise exception 'Only the assigned lecturer or administrator can record attendance' using errcode = '42501';
  end if;

  if p_session_date is null or p_session_date > current_date
     or p_session_title is null or char_length(btrim(p_session_title)) not between 2 and 160
     or jsonb_typeof(p_attendance) <> 'array' then
    raise exception 'Enter a valid past or current session date, title and attendance register' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.result_submissions s
    where s.offering_id = p_offering_id and s.status <> 'RETURNED'
  ) then
    raise exception 'Attendance is locked after results submission until results are returned' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.course_offerings o
    join public.semesters sm on sm.id = o.semester_id
    where o.id = p_offering_id and p_session_date between sm.starts_on and sm.ends_on
  ) then
    raise exception 'The attendance date must fall within the course semester' using errcode = '22023';
  end if;

  select count(*) into v_enrolled_count
  from public.enrollments e
  where e.offering_id = p_offering_id and e.enrollment_status = 'ENROLLED';

  select count(*), count(distinct r.student_id)
    into v_input_count, v_distinct_count
  from jsonb_to_recordset(p_attendance) as r(student_id uuid, attendance_status text);

  if v_enrolled_count = 0 or v_input_count <> v_enrolled_count or v_distinct_count <> v_enrolled_count then
    raise exception 'Submit exactly one attendance status for every enrolled student' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attendance) as r(student_id uuid, attendance_status text)
    left join public.enrollments e
      on e.offering_id = p_offering_id and e.student_id = r.student_id and e.enrollment_status = 'ENROLLED'
    where e.student_id is null or r.attendance_status not in ('PRESENT','ABSENT')
  ) then
    raise exception 'Attendance contains an invalid student or status' using errcode = '22023';
  end if;

  insert into public.attendance_sessions(offering_id, session_date, session_title, recorded_by)
  values (p_offering_id, p_session_date, btrim(p_session_title), v_user_id)
  returning id into v_session_id;

  insert into public.attendance_records(session_id, student_id, attendance_status, recorded_by)
  select v_session_id, r.student_id, r.attendance_status, v_user_id
  from jsonb_to_recordset(p_attendance) as r(student_id uuid, attendance_status text);

  return v_session_id;
end;
$function$;

revoke all on function public.record_attendance_session(uuid, date, text, jsonb) from public, anon;
grant execute on function public.record_attendance_session(uuid, date, text, jsonb) to authenticated;

-- Enforce attendance eligibility inside PostgreSQL as well as the application.
-- This prevents direct API/RPC calls from bypassing the 80% requirement.
create or replace function public.enforce_attendance_before_result_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session_count integer;
  v_enrolled_count integer;
begin
  if new.status <> 'SUBMITTED' then
    return new;
  end if;

  select count(*) into v_session_count
  from public.attendance_sessions s
  where s.offering_id = new.offering_id;

  if v_session_count = 0 then
    raise exception 'Results cannot be submitted until attendance sessions have been recorded';
  end if;

  select count(*) into v_enrolled_count
  from public.enrollments e
  where e.offering_id = new.offering_id and e.enrollment_status = 'ENROLLED';

  if v_enrolled_count = 0 then
    raise exception 'Results cannot be submitted without enrolled students';
  end if;

  if exists (
    select 1
    from public.enrollments e
    left join public.attendance_sessions s on s.offering_id = e.offering_id
    left join public.attendance_records r
      on r.session_id = s.id and r.student_id = e.student_id
    where e.offering_id = new.offering_id and e.enrollment_status = 'ENROLLED'
    group by e.student_id
    having count(distinct s.id) <> v_session_count
       or count(r.id) <> v_session_count
       or count(r.id) filter (where r.attendance_status = 'PRESENT')::numeric
            / v_session_count::numeric < 0.80
  ) then
    raise exception 'Every enrolled student must have a complete attendance record and at least 80 percent attendance before results can be submitted';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_attendance_before_result_submission() from public, anon, authenticated;

create trigger result_submission_attendance_eligibility
before insert or update of status on public.result_submissions
for each row execute function public.enforce_attendance_before_result_submission();
