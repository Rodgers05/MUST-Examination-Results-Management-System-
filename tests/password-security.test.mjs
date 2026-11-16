import test from 'node:test'
import assert from 'node:assert/strict'
import { getPwnedPasswordRange, isPwnedPasswordResponse } from '../lib/password-security.mjs'

test('password range lookup sends only the first five SHA-1 characters', () => {
  assert.deepEqual(getPwnedPasswordRange('password'), {
    prefix: '5BAA6',
    suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8',
  })
})

test('breach response matching is exact and requires a positive occurrence count', () => {
  const suffix = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'
  assert.equal(isPwnedPasswordResponse('ABCDEF:4\n' + suffix + ':1000\n123456:2', suffix), true)
  assert.equal(isPwnedPasswordResponse(suffix + ':0', suffix), false)
  assert.equal(isPwnedPasswordResponse('1E4C9B93F3F0682250B6CF8331B7EE68FD80:7', suffix), false)
  assert.equal(isPwnedPasswordResponse('', suffix), false)
})
