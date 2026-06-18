const SENSITIVE_KEY_PATTERN = /(password|token|secret|api[-_]?key|authorization|credential|otp|cookie|session|private[-_]?key|githubToken|refreshToken|accessToken)/i
const SENSITIVE_VALUE_PATTERN = /(sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._-]+)/g

const sanitize = (data, seen = new WeakSet()) => {
  if (typeof data === 'string') {
    return data.replace(SENSITIVE_VALUE_PATTERN, '[REDACTED]')
  }

  if (!data || typeof data !== 'object') return data

  if (seen.has(data)) return '[Circular]'
  seen.add(data)

  if (typeof data.toObject === 'function') {
    data = data.toObject({ depopulate: true })
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item, seen))
  }

  const cloned = {}

  for (const key of Object.keys(data)) {
    cloned[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitize(data[key], seen)
  }

  return cloned
}

export default sanitize
