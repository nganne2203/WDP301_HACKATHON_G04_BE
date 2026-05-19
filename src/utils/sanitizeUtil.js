const SENSITIVE_KEYS = [
  'password',
  'refreshToken',
  'accessToken',
  'otp'
]

const sanitize = (data, seen = new WeakSet()) => {
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
    if (!SENSITIVE_KEYS.includes(key)) {
      cloned[key] = sanitize(data[key], seen)
    }
  }

  return cloned
}

export default sanitize
