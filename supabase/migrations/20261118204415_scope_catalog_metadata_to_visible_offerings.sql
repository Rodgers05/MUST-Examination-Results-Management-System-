-- Restrict supporting catalogue metadata to offerings visible to the current role.
-- ADMIN/REGISTRAR retain global academic catalogue access; students see only current
-- enrolled courses, while lecturers/reviewers see only assigned course metadata.

drop policy if exists departments_read_authenticated on public.departments;
create policy departments_read_authorized on public.departments for select to authenticated
using (
  private.is_enrollment_manager()
  or exists (
    select 1 from public.courses c
    join public.course_offerings o on o.course_id = c.id
    where c.department_id = departments.id
      and (
        private.is_assigned(o.id, array['LECTURER', 'REVIEWER']::text[])
        or private.is_enrolled(o.id)
      )
  )
);

drop policy if exists courses_read_authenticated on public.courses;
create policy courses_read_authorized on public.courses for select to authenticated
using (
  private.is_enrollment_manager()
  or exists (
    select 1 from public.course_offerings o
    where o.course_id = courses.id
      and (
        private.is_assigned(o.id, array['LECTURER', 'REVIEWER']::text[])
        or private.is_enrolled(o.id)
      )
  )
);

drop policy if exists semesters_read_authenticated on public.semesters;
create policy semesters_read_authorized on public.semesters for select to authenticated
using (
  private.is_enrollment_manager()
  or exists (
    select 1 from public.course_offerings o
    where o.semester_id = semesters.id
      and (
        private.is_assigned(o.id, array['LECTURER', 'REVIEWER']::text[])
        or private.is_enrolled(o.id)
      )
  )
);

drop policy if exists academic_years_read_authenticated on public.academic_years;
create policy academic_years_read_authorized on public.academic_years for select to authenticated
using (
  private.is_enrollment_manager()
  or exists (
    select 1
    from public.semesters s
    join public.course_offerings o on o.semester_id = s.id
    where s.academic_year_id = academic_years.id
      and (
        private.is_assigned(o.id, array['LECTURER', 'REVIEWER']::text[])
        or private.is_enrolled(o.id)
      )
  )
);
