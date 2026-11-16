import { createHash } from 'node:crypto'

export function getPwnedPasswordRange(password) {
  const digest = createHash('sha1').update(String(password), 'utf8').digest('hex').toUpperCase()
  return { prefix: digest.slice(0, 5), suffix: digest.slice(5) }
}

export function isPwnedPasswordResponse(body, suffix) {
  return String(body ?? '').split(/\r?\n/).some((line) => {
    const [candidate, count] = line.trim().split(':')
    return candidate?.toUpperCase() === String(suffix).toUpperCase() && Number(count) > 0
  })
}

export async function isCompromisedPassword(password) {
  const { prefix, suffix } = getPwnedPasswordRange(password)
  const response = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
    headers: { 'Add-Padding': 'true' },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('Password security service is unavailable.')
  return isPwnedPasswordResponse(await response.text(), suffix)
}
