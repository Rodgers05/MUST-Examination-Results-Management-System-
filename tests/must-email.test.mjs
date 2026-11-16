import test from 'node:test'
import assert from 'node:assert/strict'
import { isMustInstitutionalEmail, isValidEmail } from '../lib/validation.mjs'

test('accepts MUST institutional domains', () => {
  assert.equal(isMustInstitutionalEmail('student@std.must.ac.ug'), true)
  assert.equal(isMustInstitutionalEmail('staff@must.ac.ug'), true)
  assert.equal(isMustInstitutionalEmail('student@department.must.ac.ug'), true)
})

test('rejects personal, malformed and lookalike domains', () => {
  for (const email of [
    'person@gmail.com',
    'person@yahoo.com',
    'person@must.ac.ug.example.com',
    'person@notmust.ac.ug',
    'person@must.ac.ug.evil',
    'plain-text',
    '',
  ]) assert.equal(isMustInstitutionalEmail(email), false, email)
})

test('email matching is case-insensitive and whitespace-trimmed', () => {
  assert.equal(isMustInstitutionalEmail('  STUDENT@STD.MUST.AC.UG  '), true)
  assert.equal(isValidEmail('student@std.must.ac.ug'), true)
})
