import test from 'node:test'
import assert from 'node:assert/strict'
import { hasRole, isMustInstitutionalEmail, isValidEmail, validateBatchMarks } from '../lib/validation.mjs'

test('accepts MUST institutional domains', () => {
  assert.equal(isMustInstitutionalEmail('student@std.must.ac.ug'), true)
  assert.equal(isMustInstitutionalEmail('staff@must.ac.ug'), true)
  assert.equal(isMustInstitutionalEmail('student@department.must.ac.ug'), false)
})

test('rejects personal, malformed and lookalike domains', () => {
  for (const email of [
    'person@gmail.com',
    'person@yahoo.com',
    'person@must.ac.ug.example.com',
    'person@notmust.ac.ug',
    'person@department.must.ac.ug',
    'person@must.ac.ug.evil',
    'plain-text',
    '',
  ]) assert.equal(isMustInstitutionalEmail(email), false, email)
})

test('email matching is case-insensitive and whitespace-trimmed', () => {
  assert.equal(isMustInstitutionalEmail('  STUDENT@STD.MUST.AC.UG  '), true)
  assert.equal(isValidEmail('student@std.must.ac.ug'), true)
})

test('validates complete mark batches against assessment maxima and active enrolment', () => {
  const assessments = [
    { id: 'a1', maximum_mark: 30, assessment_type: 'COURSEWORK' },
    { id: 'a2', maximum_mark: 70, assessment_type: 'EXAM' },
  ]
  const enrolled = ['student-1', 'student-2']
  const eligible = ['student-1']
  const valid = validateBatchMarks([
    { assessment_id: 'a1', student_id: 'student-1', mark: 25 },
    { assessment_id: 'a1', student_id: 'student-2', mark: 22 },
    { assessment_id: 'a2', student_id: 'student-1', mark: 60 },
  ], assessments, enrolled, eligible)
  assert.equal(valid.error, undefined)
  assert.equal(valid.data.length, 3)
  assert.equal(validateBatchMarks([{ assessment_id: 'unknown', student_id: 'student-1', mark: 10 }], assessments, enrolled, eligible).error !== undefined, true)
  assert.equal(validateBatchMarks([{ assessment_id: 'a1', student_id: 'not-enrolled', mark: 10 }], assessments, enrolled, eligible).error !== undefined, true)
  assert.equal(validateBatchMarks([
    { assessment_id: 'a1', student_id: 'student-1', mark: 31 },
    { assessment_id: 'a1', student_id: 'student-2', mark: 22 },
    { assessment_id: 'a2', student_id: 'student-1', mark: 60 },
  ], assessments, enrolled, eligible).error !== undefined, true)
  assert.equal(validateBatchMarks([
    { assessment_id: 'a1', student_id: 'student-1', mark: -1 },
    { assessment_id: 'a1', student_id: 'student-2', mark: 22 },
    { assessment_id: 'a2', student_id: 'student-1', mark: 60 },
  ], assessments, enrolled, eligible).error !== undefined, true)
  assert.equal(validateBatchMarks([
    { assessment_id: 'a1', student_id: 'student-1', mark: 10 },
    { assessment_id: 'a1', student_id: 'student-1', mark: 11 },
    { assessment_id: 'a1', student_id: 'student-2', mark: 22 },
    { assessment_id: 'a2', student_id: 'student-1', mark: 60 },
  ], assessments, enrolled, eligible).error !== undefined, true)
  assert.equal(validateBatchMarks([
    { assessment_id: 'a1', student_id: 'student-1', mark: 10 },
    { assessment_id: 'a1', student_id: 'student-2', mark: 22 },
    { assessment_id: 'a2', student_id: 'student-2', mark: 60 },
  ], assessments, enrolled, eligible).error !== undefined, true)
})

test('role checks require active accounts and an explicitly allowed role', () => {
  assert.equal(hasRole({ role: 'LECTURER', account_status: 'ACTIVE' }, ['LECTURER']), true)
  assert.equal(hasRole({ role: 'LECTURER', account_status: 'PENDING' }, ['LECTURER']), false)
  assert.equal(hasRole({ role: 'STUDENT', account_status: 'ACTIVE' }, ['LECTURER']), false)
  assert.equal(hasRole(null, ['ADMIN']), false)
})
