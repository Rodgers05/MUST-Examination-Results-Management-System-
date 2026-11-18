-- Expose only the enrolled roster for a course offering to staff assigned to that offering.
-- This avoids granting lecturers broad SELECT access to every student profile.
create or replace function public.get_assigned_offering_student_roster(p_offering_id uuid)
returns table (
  student_id uuid,
  full_name text,
  student_number text,
  institutional_email text,
  attendance_sessions integer,
  attendance_recorded integer,
  attendance_present integer,
  attendance_percentage numeric,
  examination_eligible boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_role();
begin
  if auth.uid() is null
     or v_role not in ('ADMIN', 'LECTURER', 'REVIEWER', 'REGISTRAR') then
    raise exception 'An authorised academic staff account is required'
      using errcode = '42501';
  end if;

  if v_role <> 'ADMIN'
     and not private.is_assigned(
       p_offering_id,
       array[v_role]::text[]
     ) then
    raise exception 'You are not assigned to this course offering'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    coalesce(p.student_number, ''),
    p.institutional_email,
    attendance.sessions,
    attendance.recorded,
    attendance.present,
    case when attendance.sessions > 0
      then round(attendance.present::numeric * 100 / attendance.sessions::numeric, 2)
      else null
    end,
    (attendance.sessions > 0
      and attendance.recorded = attendance.sessions
      and attendance.present::numeric / attendance.sessions::numeric >= 0.80)
  from public.enrollments e
  join public.profiles p on p.id = e.student_id
  cross join lateral (
    select
      count(distinct s.id)::integer as sessions,
      count(distinct ar.session_id)::integer as recorded,
      count(distinct ar.session_id) filter (
        where ar.attendance_status = 'PRESENT'
      )::integer as present
    from public.attendance_sessions s
    left join public.attendance_records ar
      on ar.session_id = s.id
     and ar.student_id = e.student_id
    where s.offering_id = e.offering_id
  ) attendance
  where e.offering_id = p_offering_id
    and e.enrollment_status = 'ENROLLED'
  order by p.full_name;
end;
$$;

revoke all on function public.get_assigned_offering_student_roster(uuid) from public;
grant execute on function public.get_assigned_offering_student_roster(uuid) to authenticated;
