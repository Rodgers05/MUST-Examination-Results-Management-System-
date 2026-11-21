import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('workflow table grants are limited to existing RLS-protected operations', async () => {
  const migration = await readFile(new URL('../database/20261121_restore_rls_backed_workflow_write_grants.sql', import.meta.url), 'utf8')
  const actions = await readFile(new URL('../app/dashboard/actions.ts', import.meta.url), 'utf8')

  assert.match(migration, /GRANT INSERT, UPDATE ON TABLE public\.assessments TO authenticated/)
  assert.match(migration, /GRANT INSERT ON TABLE public\.result_submissions TO authenticated/)
  assert.match(migration, /GRANT INSERT ON TABLE public\.support_tickets TO authenticated/)
  assert.doesNotMatch(migration, /GRANT ALL ON TABLE/)
  assert.doesNotMatch(migration, /GRANT UPDATE ON TABLE public\.(result_submissions|support_tickets)/)

  assert.match(actions, /supabase\.from\('assessments'\)\.insert/)
  assert.match(actions, /supabase\.from\('assessments'\)\.update/)
  assert.match(actions, /supabase\.from\('result_submissions'\)\.insert/)
  assert.match(actions, /supabase\.from\('support_tickets'\)\.insert/)
})

test('official student and staff identifiers are changed only through an administrator RPC', async () => {
  const [migration, actions] = await Promise.all([
    readFile(new URL('../database/20261121_restore_rls_backed_workflow_write_grants.sql', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/actions.ts', import.meta.url), 'utf8'),
  ])

  assert.match(migration, /admin_set_profile_identifiers/)
  assert.match(migration, /private\.current_role\(\) IS DISTINCT FROM 'ADMIN'/)
  assert.match(migration, /student_number = v_student_number/)
  assert.match(migration, /staff_number = v_staff_number/)
  assert.match(migration, /PROFILE_IDENTIFIER_UPDATED/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_set_profile_identifiers[\s\S]*?FROM PUBLIC, anon/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_set_profile_identifiers[\s\S]*?TO authenticated/)

  assert.match(actions, /supabase\.rpc\('admin_set_profile_identifiers'/)
  assert.doesNotMatch(actions, /from\('profiles'\)\.update\(identifierUpdate\)/)
})
