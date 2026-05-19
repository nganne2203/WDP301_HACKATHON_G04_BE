export const parseTokenTTL = (expiresIn) => {
  if (!expiresIn) throw new Error('Expiration time is required')

  if (typeof expiresIn === 'number') return expiresIn

  const string = String(expiresIn).toLowerCase().trim()

  if (/^\d+$/.test(string)) return parseInt(string, 10) * 1000

  const match = string.match(/^(\d+)\s*(ms|s|m|h|d|w|y)?$/)
  if (!match) throw new Error(`Invalid token TTL expression: ${expiresIn}`)

  const value = parseInt(match[1], 10)
  const unit = match[2] || 's'

  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000
  }

  const multiplier = multipliers[unit]
  if (!multiplier) throw new Error(`Invalid token TTL unit: ${unit}`)

  return value * multiplier
}