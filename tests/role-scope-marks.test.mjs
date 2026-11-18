import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('enrolment visibility is limited to authorised role scopes in UI and database RLS', async () => {
  const [migration, dashboard, lecturer, actions] = await Promise.all([
    read('../supabase/migrations/20261118203100_role_scoped_enrollment_and_atomic_marks_entry.sql'),
    read('../app/dashboard/page.tsx'),
    read('../app/dashboard/lecturer/page.tsx'),
    read('../app/dashboard/actions.ts'),
  ])

  assert.match(migration, /private\.current_role\(\) = any \(array\['ADMIN', 'REGISTRAR'\]/)
  assert.match(migration, /create policy enrollments_manager_manage[\s\S]*?private\.is_enrollment_manager\(\)/)
  const enrollmentReadPolicy = migration.split('create policy enrollments_student_or_assigned_lecturer_read')[1].split('drop policy if exists offerings_read_authenticated')[0]
  assert.match(enrollmentReadPolicy, /student_id = \(select auth\.uid\(\)\)/)
  assert.match(enrollmentReadPolicy, /private\.is_assigned\(offering_id, array\['LECTURER'\]/)
  assert.doesNotMatch(enrollmentReadPolicy, /REVIEWER/)
  assert.match(migration, /s\.status = 'OPEN'[\s\S]*?y\.is_current = true/)
  assert.match(migration, /private\.can_view_assigned_student\(id\)/)

  assert.match(dashboard, /const isEnrollmentManager = isAdmin \|\| profile\.role === 'REGISTRAR'/)
  assert.match(dashboard, /isEnrollmentManager && <Card id="enrolments"/)
  assert.match(dashboard, /action=\{enrollStudent\}/)
  const enrollmentQuery = dashboard.split('const enrollmentQuery =')[1].split('const assessmentQuery =')[0]
  assert.match(enrollmentQuery, /isEnrollmentManager/)
  assert.match(enrollmentQuery, /profile\.role === 'STUDENT'/)
  assert.match(enrollmentQuery, /profile\.role === 'LECTURER'/)
  assert.doesNotMatch(enrollmentQuery, /REVIEWER/)
  assert.match(dashboard, /\.eq\('student_id', profile\.id\)/)
  assert.match(lecturer, /\.eq\('assignment_role', 'LECTURER'\)/)
  assert.match(lecturer, /\.in\('offering_id', offeringIds\)/)
  assert.match(actions, /export async function enrollStudent/)
  assert.match(actions, /actor\(\['ADMIN', 'REGISTRAR'\]\)/)
})

test('marks batches are complete, assignment-bound, maximum-bound and attendance-aware', async () => {
  const [migration, actions, lecturer, validation] = await Promise.all([
    read('../supabase/migrations/20261118203100_role_scoped_enrollment_and_atomic_marks_entry.sql'),
    read('../app/dashboard/actions.ts'),
    read('../app/dashboard/lecturer/page.tsx'),
    read('../lib/validation.mjs'),
  ])

  assert.match(migration, /create or replace function public\.save_batch_marks/)
  assert.match(migration, /private\.is_assigned\(p_offering_id, array\['LECTURER'\]/)
  assert.match(migration, /v_input_count <> v_expected_count or v_distinct_count <> v_expected_count/)
  assert.match(migration, /i\.mark > a\.maximum_mark/)
  assert.match(migration, /a\.assessment_type = 'EXAM'/)
  assert.match(migration, /att\.present::numeric \/ att\.sessions::numeric < 0\.80/)
  assert.match(migration, /v_submission_status <> 'RETURNED'/)
  assert.match(migration, /'BATCH_MARKS_SAVED'/)
  assert.match(migration, /marks_exam_attendance_eligibility/)
  assert.match(actions, /supabase\.rpc\('save_batch_marks'/)
  assert.match(actions, /validateBatchMarks\([\s\S]*?eligibleStudentIds/)
  assert.match(lecturer, /Exam eligibility/)
  assert.match(lecturer, /isIneligibleExam/)
  assert.match(lecturer, /disabled=\{isLocked \|\| isIneligibleExam\}/)
  assert.match(lecturer, /required \/>/)
  assert.match(validation, /seen\.size !== expected\.size/)
  assert.match(validation, /assessment\.type === 'EXAM' && !examEligible\.has\(studentId\)/)
})

test('review, return, approval and publication remain controlled server/database transitions', async () => {
  const [actions, dashboard] = await Promise.all([
    read('../app/dashboard/actions.ts'),
    read('../app/dashboard/page.tsx'),
  ])
  for (const transition of ['review_result_submission', 'resubmit_returned_results', 'publish_approved_results']) {
    assert.ok(actions.includes(transition), transition)
  }
  assert.match(actions, /actor\(\['REVIEWER'\]\)/)
  assert.match(actions, /actor\(\['REGISTRAR'\]\)/)
  assert.match(dashboard, /profile\.role === 'STUDENT'[\s\S]*?\.eq\('student_id', profile\.id\)/)
})
