-- Keep read policy evaluation single-pass while preserving administrator write control.
-- ADMIN/REGISTRAR global reads remain in the authorised SELECT policies.

drop policy if exists academic_years_admin_manage on public.academic_years;
create policy academic_years_admin_insert on public.academic_years for insert to authenticated with check (private.is_admin());
create policy academic_years_admin_update on public.academic_years for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy academic_years_admin_delete on public.academic_years for delete to authenticated using (private.is_admin());

drop policy if exists offerings_admin_manage on public.course_offerings;
create policy offerings_admin_insert on public.course_offerings for insert to authenticated with check (private.is_admin());
create policy offerings_admin_update on public.course_offerings for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy offerings_admin_delete on public.course_offerings for delete to authenticated using (private.is_admin());

drop policy if exists course_staff_admin_manage on public.course_staff;
create policy course_staff_admin_insert on public.course_staff for insert to authenticated with check (private.is_admin());
create policy course_staff_admin_update on public.course_staff for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy course_staff_admin_delete on public.course_staff for delete to authenticated using (private.is_admin());

drop policy if exists courses_admin_manage on public.courses;
create policy courses_admin_insert on public.courses for insert to authenticated with check (private.is_admin());
create policy courses_admin_update on public.courses for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy courses_admin_delete on public.courses for delete to authenticated using (private.is_admin());

drop policy if exists departments_admin_manage on public.departments;
create policy departments_admin_insert on public.departments for insert to authenticated with check (private.is_admin());
create policy departments_admin_update on public.departments for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy departments_admin_delete on public.departments for delete to authenticated using (private.is_admin());

drop policy if exists semesters_admin_manage on public.semesters;
create policy semesters_admin_insert on public.semesters for insert to authenticated with check (private.is_admin());
create policy semesters_admin_update on public.semesters for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy semesters_admin_delete on public.semesters for delete to authenticated using (private.is_admin());

drop policy if exists enrollments_manager_manage on public.enrollments;
drop policy if exists enrollments_student_or_assigned_lecturer_read on public.enrollments;
create policy enrollments_read_authorized on public.enrollments for select to authenticated
using (
  private.is_enrollment_manager()
  or (
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
create policy enrollments_manager_insert on public.enrollments for insert to authenticated
with check (private.is_enrollment_manager());
create policy enrollments_manager_update on public.enrollments for update to authenticated
using (private.is_enrollment_manager()) with check (private.is_enrollment_manager());
create policy enrollments_manager_delete on public.enrollments for delete to authenticated
using (private.is_enrollment_manager());

create index if not exists attendance_records_recorded_by_idx on public.attendance_records(recorded_by);
create index if not exists attendance_sessions_recorded_by_idx on public.attendance_sessions(recorded_by);
