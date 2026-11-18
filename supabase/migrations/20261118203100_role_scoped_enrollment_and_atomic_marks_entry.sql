-- Restrict enrolment visibility to operational roles and make lecturer marks batches atomic.
-- Student visibility is limited to their own enrolled offerings in the current open academic year.
-- Lecturer/reviewer profile context is limited to students enrolled in their assigned offerings.

create or replace function private.is_enrollment_manager()
returns boolean language sql stable security definer set search_path to ''
as $function$
  select coalesce(private.current_role() = any (array['ADMIN', 'REGISTRAR']::text[]), false)
$function$;
revoke all on function private.is_enrollment_manager() from public, anon;
grant execute on function private.is_enrollment_manager() to authenticated;

create or replace function private.is_enrolled(p_offering uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
  select coalesce(
    private.current_role() = 'STUDENT'
    and exists (
      select 1 from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id
      join public.semesters s on s.id = o.semester_id
      join public.academic_years y on y.id = s.academic_year_id
      where e.offering_id = p_offering
        and e.student_id = (select auth.uid())
        and e.enrollment_status = 'ENROLLED'
        and s.status = 'OPEN'
        and y.is_current = true
    ), false
  )
$function$;
revoke all on function private.is_enrolled(uuid) from public, anon;
grant execute on function private.is_enrolled(uuid) to authenticated;

create or replace function private.can_view_assigned_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
  select coalesce(
    private.current_role() in ('LECTURER', 'REVIEWER')
    and exists (
      select 1 from public.enrollments e
      join public.course_staff cs on cs.offering_id = e.offering_id
      where e.student_id = p_student_id
        and e.enrollment_status = 'ENROLLED'
        and cs.user_id = (select auth.uid())
        and cs.assignment_role = private.current_role()
    ), false
  )
$function$;
revoke all on function private.can_view_assigned_student(uuid) from public, anon;
grant execute on function private.can_view_assigned_student(uuid) to authenticated;

drop policy if exists enrollments_admin_manage on public.enrollments;
create policy enrollments_manager_manage on public.enrollments for all to authenticated
using (private.is_enrollment_manager())
with check (private.is_enrollment_manager());

drop policy if exists enrollments_student_or_assigned_staff_read on public.enrollments;
create policy enrollments_student_or_assigned_lecturer_read on public.enrollments for select to authenticated
using (
  (
    private.current_role() = 'STUDENT'
    and student_id = (select auth.uid())
    and enrollment_status = 'ENROLLED'
    and exists (
      select 1 from public.course_offerings o
      join public.semesters s on s.id = o.semester_id
      join public.academic_years y on y.id = s.academic_year_id
      where o.id = enrollments.offering_id and s.status = 'OPEN' and y.is_current = true
    )
  )
  or (
    private.current_role() = 'LECTURER'
    and enrollment_status = 'ENROLLED'
    and private.is_assigned(offering_id, array['LECTURER']::text[])
  )
);

drop policy if exists offerings_read_authenticated on public.course_offerings;
create policy offerings_read_authorized on public.course_offerings for select to authenticated
using (
  private.is_enrollment_manager()
  or private.is_assigned(id, array['LECTURER', 'REVIEWER']::text[])
  or private.is_enrolled(id)
);

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_authorized_student_context on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.is_admin()
  or (private.current_role() = 'REGISTRAR' and role = 'STUDENT')
  or (role = 'STUDENT' and private.can_view_assigned_student(id))
);

create or replace function private.enforce_exam_mark_attendance_eligibility()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_offering_id uuid;
  v_assessment_type text;
  v_session_count integer;
  v_recorded_count integer;
  v_present_count integer;
begin
  select a.offering_id, a.assessment_type into v_offering_id, v_assessment_type
  from public.assessments a where a.id = new.assessment_id;
  if v_offering_id is null then
    raise exception 'Assessment not found' using errcode = '23503';
  end if;
  if v_assessment_type = 'EXAM' then
    select count(*)::integer into v_session_count
    from public.attendance_sessions s where s.offering_id = v_offering_id;
    select
      count(distinct ar.session_id)::integer,
      count(distinct ar.session_id) filter (where ar.attendance_status = 'PRESENT')::integer
      into v_recorded_count, v_present_count
    from public.attendance_sessions s
    left join public.attendance_records ar on ar.session_id = s.id and ar.student_id = new.student_id
    where s.offering_id = v_offering_id;
    if v_session_count = 0 or v_recorded_count <> v_session_count
       or v_present_count::numeric / v_session_count::numeric < 0.80 then
      raise exception 'Examination marks require complete attendance records and at least 80 percent attendance'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists marks_exam_attendance_eligibility on public.marks;
create trigger marks_exam_attendance_eligibility before insert or update on public.marks
for each row execute function private.enforce_exam_mark_attendance_eligibility();

create or replace function public.save_batch_marks(p_offering_id uuid, p_marks jsonb)
returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_submission_status text;
  v_assessment_count integer;
  v_coursework_count integer;
  v_exam_count integer;
  v_enrolled_count integer;
  v_eligible_count integer;
  v_expected_count integer;
  v_input_count integer;
  v_distinct_count integer;
  v_saved_count integer;
begin
  if v_user_id is null or private.current_role() <> 'LECTURER' then
    raise exception 'An active lecturer account is required' using errcode = '42501';
  end if;
  if not private.is_assigned(p_offering_id, array['LECTURER']::text[]) then
    raise exception 'You are not assigned to this course offering' using errcode = '42501';
  end if;
  if jsonb_typeof(p_marks) <> 'array' then
    raise exception 'Marks must be submitted as an array' using errcode = '22023';
  end if;

  select s.status into v_submission_status from public.result_submissions s
  where s.offering_id = p_offering_id for update;
  if found and v_submission_status <> 'RETURNED' then
    raise exception 'Marks are locked while the submission is under review, approved or published'
      using errcode = '55000';
  end if;

  select count(*)::integer,
         count(*) filter (where a.assessment_type <> 'EXAM')::integer,
         count(*) filter (where a.assessment_type = 'EXAM')::integer
    into v_assessment_count, v_coursework_count, v_exam_count
  from public.assessments a where a.offering_id = p_offering_id;
  select count(*)::integer into v_enrolled_count from public.enrollments e
  where e.offering_id = p_offering_id and e.enrollment_status = 'ENROLLED';
  if v_assessment_count = 0 or v_enrolled_count = 0 then
    raise exception 'Configure assessments and active student enrolments before entering marks'
      using errcode = '22023';
  end if;

  with attendance_summary as (
    select e.student_id, count(distinct s.id)::integer as sessions,
      count(distinct ar.session_id)::integer as recorded,
      count(distinct ar.session_id) filter (where ar.attendance_status = 'PRESENT')::integer as present
    from public.enrollments e
    left join public.attendance_sessions s on s.offering_id = e.offering_id
    left join public.attendance_records ar on ar.session_id = s.id and ar.student_id = e.student_id
    where e.offering_id = p_offering_id and e.enrollment_status = 'ENROLLED'
    group by e.student_id
  )
  select count(*)::integer into v_eligible_count from attendance_summary a
  where a.sessions > 0 and a.recorded = a.sessions
    and a.present::numeric / a.sessions::numeric >= 0.80;

  v_expected_count := (v_enrolled_count * v_coursework_count) + (v_eligible_count * v_exam_count);
  select count(*)::integer,
    count(distinct ((item->>'assessment_id') || ':' || (item->>'student_id')))::integer
    into v_input_count, v_distinct_count
  from jsonb_array_elements(p_marks) as item;

  if v_expected_count = 0 then
    raise exception 'No assessment/student pairs are eligible for mark entry until attendance is recorded'
      using errcode = '22023';
  end if;
  if v_input_count <> v_expected_count or v_distinct_count <> v_expected_count then
    raise exception 'Submit exactly one mark for every required enrolled student and assessment; examination marks are accepted only for attendance-eligible students'
      using errcode = '22023';
  end if;

  if exists (
    with input_marks as (
      select * from jsonb_to_recordset(p_marks) as r(assessment_id uuid, student_id uuid, mark numeric)
    ),
    attendance_summary as (
      select e.student_id, count(distinct s.id)::integer as sessions,
        count(distinct ar.session_id)::integer as recorded,
        count(distinct ar.session_id) filter (where ar.attendance_status = 'PRESENT')::integer as present
      from public.enrollments e
      left join public.attendance_sessions s on s.offering_id = e.offering_id
      left join public.attendance_records ar on ar.session_id = s.id and ar.student_id = e.student_id
      where e.offering_id = p_offering_id and e.enrollment_status = 'ENROLLED'
      group by e.student_id
    )
    select 1 from input_marks i
    left join public.assessments a on a.id = i.assessment_id and a.offering_id = p_offering_id
    left join public.enrollments e on e.offering_id = p_offering_id
      and e.student_id = i.student_id and e.enrollment_status = 'ENROLLED'
    left join attendance_summary att on att.student_id = i.student_id
    where a.id is null or e.student_id is null or i.mark is null or i.mark < 0 or i.mark > a.maximum_mark
      or (a.assessment_type = 'EXAM' and (
        att.student_id is null or att.sessions = 0 or att.recorded <> att.sessions
        or att.present::numeric / att.sessions::numeric < 0.80
      ))
  ) then
    raise exception 'A mark references an unassigned assessment, non-enrolled student, invalid numeric value, maximum mark or ineligible examination entry'
      using errcode = '22023';
  end if;

  insert into public.marks (assessment_id, student_id, mark, entered_by, updated_by)
  select r.assessment_id, r.student_id, r.mark, v_user_id, v_user_id
  from jsonb_to_recordset(p_marks) as r(assessment_id uuid, student_id uuid, mark numeric)
  on conflict (assessment_id, student_id) do update
    set mark = excluded.mark, updated_by = v_user_id, updated_at = now();
  get diagnostics v_saved_count = row_count;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (v_user_id, 'BATCH_MARKS_SAVED', 'course_offering', p_offering_id::text,
    jsonb_build_object('saved_rows', v_saved_count, 'assessment_count', v_assessment_count, 'enrolled_count', v_enrolled_count));
  return v_saved_count;
end;
$function$;

revoke all on function public.save_batch_marks(uuid, jsonb) from public, anon;
grant execute on function public.save_batch_marks(uuid, jsonb) to authenticated;

create or replace function private.audit_enrollment_change()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_action text;
  v_entity_id text;
  v_details jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'ENROLLMENT_CREATED';
    v_entity_id := new.id::text;
    v_details := jsonb_build_object('offering_id', new.offering_id, 'student_id', new.student_id, 'new_status', new.enrollment_status);
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), v_action, 'enrollment', v_entity_id, v_details);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.enrollment_status is distinct from new.enrollment_status then
      v_action := 'ENROLLMENT_STATUS_UPDATED';
      v_entity_id := new.id::text;
      v_details := jsonb_build_object('offering_id', new.offering_id, 'student_id', new.student_id,
        'old_status', old.enrollment_status, 'new_status', new.enrollment_status);
      insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
      values ((select auth.uid()), v_action, 'enrollment', v_entity_id, v_details);
    end if;
    return new;
  else
    v_action := 'ENROLLMENT_DELETED';
    v_entity_id := old.id::text;
    v_details := jsonb_build_object('offering_id', old.offering_id, 'student_id', old.student_id, 'old_status', old.enrollment_status);
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), v_action, 'enrollment', v_entity_id, v_details);
    return old;
  end if;
end;
$function$;

drop trigger if exists audit_enrollment_change on public.enrollments;
create trigger audit_enrollment_change after insert or update or delete on public.enrollments
for each row execute function private.audit_enrollment_change();
