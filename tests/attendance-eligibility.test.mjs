import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateBatchMarks } from '../lib/validation.mjs'

test('coursework remains available while examination marks require 80 percent attendance', () => {
  const assessments = [
    { id: 'coursework', maximum_mark: 30, assessment_type: 'TEST' },
    { id: 'examination', maximum_mark: 70, assessment_type: 'EXAM' },
  ]
  const enrolled = ['student-eligible', 'student-ineligible']
  const eligibleForExam = ['student-eligible']

  const valid = validateBatchMarks([
    { assessment_id: 'coursework', student_id: 'student-eligible', mark: 25 },
    { assessment_id: 'coursework', student_id: 'student-ineligible', mark: 21 },
    { assessment_id: 'examination', student_id: 'student-eligible', mark: 58 },
  ], assessments, enrolled, eligibleForExam)

  assert.equal(valid.error, undefined)
  assert.equal(valid.data.length, 3)

  const rejected = validateBatchMarks([
    { assessment_id: 'examination', student_id: 'student-ineligible', mark: 40 },
  ], assessments, enrolled, eligibleForExam)
  assert.match(rejected.error, /complete attendance register and at least 80 percent attendance/)
})

test('attendance migration and lecturer UI share the same examination eligibility rule', async () => {
  const [migration, actions, page, workspace] = await Promise.all([
    readFile(new URL('../database/20261121_attendance_aware_marks_and_exam_eligibility.sql', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/lecturer/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/lecturer-marks-workspace.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(migration, /private\.student_attendance_eligible/)
  assert.match(migration, /v_role IS NULL[\s\S]*?v_role NOT IN/)
  assert.match(migration, /p_marks IS NULL OR jsonb_typeof\(p_marks\) <> 'array'/)
  assert.match(migration, /attendance\.recorded = attendance\.sessions/)
  assert.match(migration, /attendance\.present::numeric[\s\S]*?>= 0\.80/)
  assert.match(migration, /DROP FUNCTION IF EXISTS public\\.get_assigned_offering_student_roster\\(uuid\\);[\\s\\S]*?CREATE FUNCTION public\\.get_assigned_offering_student_roster/)
  assert.match(migration, /attendance_eligible boolean/)
  assert.match(migration, /a\.assessment_type <> 'EXAM'[\s\S]*?private\.student_attendance_eligible/)
  assert.match(migration, /existing examination mark belongs to a student who no longer meets the attendance rule/)

  assert.match(page, /attendance_sessions: Number/)
  assert.match(page, /attendance_eligible: student\.attendance_eligible === true/)
  assert.match(workspace, /attendance_sessions: number/)
  assert.match(workspace, /required=\{!examIneligible\}/)
  assert.match(workspace, /disabled=\{workflowLocked \|\| examIneligible\}/)
  assert.match(workspace, /disabled=\{!allAttendanceEligible\}/)

  assert.match(actions, /get_assigned_offering_student_roster/)
  assert.match(actions, /attendanceEligibleStudentIds/)
  assert.match(actions, /assessment\.assessment_type !== 'EXAM' \|\| attendanceEligibleStudentIds\.has\(studentId\)/)
  assert.match(actions, /Every enrolled student must have a complete attendance register and at least 80% attendance/)
})
