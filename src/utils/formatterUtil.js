export const slugify = (value) => {
  if (!value) return ''
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') // Trim - from start and end
}

export const escapeRegex = (string = '') => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const maskEmail = (email) => {
  const [localPart, domain] = email.split('@')
  if (localPart.length <= 2) return `${localPart[0]}***@${domain}`

  return `${localPart[0]}${localPart[1]}***@${domain}`
}