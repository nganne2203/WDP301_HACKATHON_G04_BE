import { AUDITLOG_REPOSITORY } from '#repositories/auditLogRepository.js'
import sanitize from '#utils/sanitizeUtil.js'
import { formatResponseForAuditLog } from '#utils/auditUtil.js'

const auditLogMiddleware = async (req, res, next) => {
  const startTime = Date.now()
  const userId = req.user?._id || null

  const SKIP_PATHS = ['/api-docs']

  if (SKIP_PATHS.some(path => req.originalUrl.startsWith(path))) {
    return next()
  }

  const auditLog = await AUDITLOG_REPOSITORY.createLog({
    user: userId,
    method: req.method,
    endpoint: req.originalUrl,
    request: {
      body: sanitize(req.body),
      params: req.params,
      query: req.query
    },
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  req.auditLogId = auditLog._id

  const originalJson = res.json.bind(res)

  res.json = async (body) => {
    await AUDITLOG_REPOSITORY.updateLog(req.auditLogId, {
      response: {
        status: res.statusCode,
        body: formatResponseForAuditLog(body)
      },
      duration: Date.now() - startTime
    })

    return originalJson(body)
  }

  next()
}

export default auditLogMiddleware
