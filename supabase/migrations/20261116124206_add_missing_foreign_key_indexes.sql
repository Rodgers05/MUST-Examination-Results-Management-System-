-- Cover frequently joined and referenced foreign-key columns.
-- These indexes do not change or delete academic data.
create index if not exists idx_assessments_created_by on public.assessments (created_by);
create index if not exists idx_assessments_offering_id on public.assessments (offering_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs (actor_id);
create index if not exists idx_course_offerings_semester_id on public.course_offerings (semester_id);
create index if not exists idx_course_staff_assigned_by on public.course_staff (assigned_by);
create index if not exists idx_courses_department_id on public.courses (department_id);
create index if not exists idx_marks_entered_by on public.marks (entered_by);
create index if not exists idx_marks_updated_by on public.marks (updated_by);
create index if not exists idx_profiles_department_id on public.profiles (department_id);
create index if not exists idx_published_results_student_id on public.published_results (student_id);
create index if not exists idx_result_submissions_submitted_by on public.result_submissions (submitted_by);
create index if not exists idx_review_actions_actor_id on public.review_actions (actor_id);
create index if not exists idx_review_actions_submission_id on public.review_actions (submission_id);
create index if not exists idx_support_tickets_created_by on public.support_tickets (created_by);