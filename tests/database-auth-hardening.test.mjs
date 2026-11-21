import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('new Auth users must use MUST domains and are not auto-confirmed', async () => {
  const migration = await readFile(new URL('../database/20261121_require_verified_must_identity.sql', import.meta.url), 'utf8')

  assert.match(migration, /DROP TRIGGER IF EXISTS auto_confirm_must_signup ON auth\.users/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.enforce_must_auth_email/)
  assert.match(migration, /CREATE TRIGGER enforce_must_auth_email[\s\S]*?BEFORE INSERT OR UPDATE OF email ON auth\.users/)
  assert.match(migration, /NEW\.email_confirmed_at IS NOT NULL/)
  assert.match(migration, /account_status, email_verified/)
  assert.match(migration, /'PENDING'[\s\S]*?NEW\.email_confirmed_at IS NOT NULL/)
  assert.match(migration, /CREATE TRIGGER sync_profile_email_verification[\s\S]*?AFTER UPDATE OF email_confirmed_at, email ON auth\.users/)
})

test('database role resolution requires a verified, matching MUST Auth identity', async () => {
  const migration = await readFile(new URL('../database/20261121_require_verified_must_identity.sql', import.meta.url), 'utf8')

  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.current_role\(\)[\s\S]*?JOIN auth\.users u ON u\.id = p\.id/)
  assert.match(migration, /p\.account_status = 'ACTIVE'/)
  assert.match(migration, /p\.email_verified IS TRUE/)
  assert.match(migration, /u\.email_confirmed_at IS NOT NULL/)
  assert.match(migration, /lower\(btrim\(coalesce\(u\.email/)
  assert.match(migration, /must\.ac\.ug', 'std\.must\.ac\.ug/)
})

test('administrator activation cannot manufacture email verification', async () => {
  const migration = await readFile(new URL('../database/20261121_require_verified_must_identity.sql', import.meta.url), 'utf8')
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.admin_set_user_access')
  assert.notEqual(start, -1)
  const adminFunction = migration.slice(start, migration.indexOf('$function$;', start))

  assert.doesNotMatch(adminFunction, /auth\.users/)
  assert.doesNotMatch(adminFunction, /email_confirmed_at/)
  assert.doesNotMatch(adminFunction, /email_verified\s*=/)
  assert.match(adminFunction, /private\.is_admin\(\)/)
})

test('trigger-only SECURITY DEFINER functions are not directly executable', async () => {
  const migration = await readFile(new URL('../database/20261121_require_verified_must_identity.sql', import.meta.url), 'utf8')

  assert.match(migration, /REVOKE ALL ON FUNCTION private\.enforce_must_auth_email\(\) FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.sync_profile_email_verification\(\) FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.audit_enrollment_change\(\) FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.enforce_exam_mark_attendance_eligibility\(\) FROM PUBLIC, anon, authenticated/)
})
