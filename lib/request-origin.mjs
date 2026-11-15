export function resolveAuthOrigin(requestHeaders, fallbackOrigin) {
  const get = (name) => requestHeaders?.get?.(name) ?? requestHeaders?.[name] ?? null
  const requestOrigin = get('origin')
  const forwardedHost = get('x-forwarded-host')
  const host = (forwardedHost || get('host') || '').split(',')[0].trim()

  if (!requestOrigin || !host) return fallbackOrigin

  try {
    const parsed = new URL(requestOrigin)
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallbackOrigin
    if (parsed.host.toLowerCase() !== host.toLowerCase()) return fallbackOrigin
    return parsed.origin
  } catch {
    return fallbackOrigin
  }
}
