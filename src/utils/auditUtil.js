import sanitize from '#utils/sanitizeUtil.js'

const summarizeData = (data) => {
  if (!data) return null

  const sanitizedData = sanitize(data)

  if (Array.isArray(sanitizedData)) {
    return {
      type: 'array',
      total: sanitizedData.length
    }
  }

  if (typeof sanitizedData === 'object') {
    return {
      type: 'object',
      keys: Object.keys(sanitizedData).slice(0, 10)
    }
  }

  return { type: typeof sanitizedData }
}

export const formatResponseForAuditLog = (body) => {
  if (!body || typeof body !== 'object') return null

  if (body.success === true) {
    return {
      success: true,
      message: body.message,
      data: summarizeData(body.data),
      pagination: Boolean(body.pagination)
    }
  }

  if (body.success === false) {
    return {
      success: false,
      code: body.code,
      message: body.message,
      errorCount: Array.isArray(body.errors)
        ? body.errors.length
        : 0
    }
  }

  return null
}
