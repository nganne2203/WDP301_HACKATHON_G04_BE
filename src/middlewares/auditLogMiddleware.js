import crypto from 'node:crypto'

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_RESULTS } from '#constants/audit.js'
import { AUDIT_LOG_SERVICE } from '#modules/audit-logs/audit-log.service.js'
import sanitize from '#utils/sanitizeUtil.js'
import { formatResponseForAuditLog } from '#utils/auditUtil.js'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const READ_SUCCESS_STATUS_MAX = 399

const SKIP_PATHS = [
  '/health',
  '/ready',
  '/api/status',
  '/api-docs'
]

const MODULE_ENTITY_MAP = {
  auth: AUDIT_ENTITY_TYPES.AUTH,
  users: AUDIT_ENTITY_TYPES.USER,
  roles: AUDIT_ENTITY_TYPES.ROLE,
  permissions: AUDIT_ENTITY_TYPES.PERMISSION,
  teams: AUDIT_ENTITY_TYPES.TEAM,
  competitions: AUDIT_ENTITY_TYPES.EVENT,
  rounds: AUDIT_ENTITY_TYPES.ROUND,
  rubrics: AUDIT_ENTITY_TYPES.RUBRIC,
  submissions: AUDIT_ENTITY_TYPES.SUBMISSION,
  'score-sheets': AUDIT_ENTITY_TYPES.SCORE_SHEET,
  rankings: AUDIT_ENTITY_TYPES.RANKING,
  finalists: AUDIT_ENTITY_TYPES.FINALIST,
  'ai-reviews': AUDIT_ENTITY_TYPES.AI_REVIEW,
  repositories: AUDIT_ENTITY_TYPES.REPOSITORY,
  github: AUDIT_ENTITY_TYPES.GITHUB,
  media: AUDIT_ENTITY_TYPES.MEDIA,
  notifications: AUDIT_ENTITY_TYPES.NOTIFICATION,
  workshops: AUDIT_ENTITY_TYPES.WORKSHOP
}

const getPathParts = (req) => {
  const pathname = req.originalUrl.split('?')[0].replace(/^\/api\/?/, '')
  return pathname.split('/').filter(Boolean)
}

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || null
}

const getSessionId = (req) => {
  const header = req.headers['x-session-id'] || req.headers['x-request-session-id']
  if (Array.isArray(header)) return header[0] || null
  return header || null
}

const getActor = ({ req, responseBody }) => {
  const responseUser = responseBody?.data?.user || responseBody?.data
  const user = req.user || null
  const roles = user?.roles || responseUser?.roles || []

  return {
    id: user?.id || responseUser?.id || null,
    username: user?.email || responseUser?.email || req.body?.email || null,
    userRole: user?.role || (Array.isArray(roles) ? roles.map(role => role?.name || role).filter(Boolean).join(',') : roles) || null
  }
}

const findEntityId = ({ req, responseBody }) => {
  const pathParts = getPathParts(req)
  const pathId = pathParts.find(part => /^[a-f0-9]{24}$/i.test(part))
  const responseData = responseBody?.data

  return pathId ||
    responseData?.id ||
    responseData?._id ||
    responseData?.review?.id ||
    responseData?.repositoryId ||
    req.body?.id ||
    null
}

const moduleToActionPrefix = (moduleName = '') => {
  return moduleName.replace(/-/g, '_').toUpperCase()
}

const deriveAuthAction = ({ req, result }) => {
  const parts = getPathParts(req)
  const tail = parts.at(-1)
  const success = result === AUDIT_RESULTS.SUCCESS

  if (tail === 'login') return success ? AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS : AUDIT_ACTIONS.AUTH_LOGIN_FAILED
  if (tail === 'register') return success ? AUDIT_ACTIONS.AUTH_REGISTER_SUCCESS : AUDIT_ACTIONS.AUTH_REGISTER_FAILED
  if (tail === 'refresh-token') return success ? AUDIT_ACTIONS.AUTH_TOKEN_REFRESHED : AUDIT_ACTIONS.AUTH_TOKEN_REFRESH_FAILED
  if (tail === 'change-password') return success ? AUDIT_ACTIONS.AUTH_PASSWORD_CHANGED : AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE_FAILED
  if (tail === 'logout') return AUDIT_ACTIONS.AUTH_LOGOUT
  if (tail === 'google') return success ? AUDIT_ACTIONS.AUTH_GOOGLE_LOGIN_SUCCESS : AUDIT_ACTIONS.AUTH_GOOGLE_LOGIN_FAILED

  return success ? AUDIT_ACTIONS.API_MUTATION_COMPLETED : AUDIT_ACTIONS.API_MUTATION_FAILED
}

const deriveAction = ({ req, result, statusCode }) => {
  const parts = getPathParts(req)
  const moduleName = parts[0] || 'system'
  const tail = parts.at(-1) || ''

  if (statusCode === 429) return AUDIT_ACTIONS.SECURITY_RATE_LIMITED
  if (statusCode === 401) return AUDIT_ACTIONS.SECURITY_UNAUTHORIZED_ACCESS
  if (statusCode === 403) return AUDIT_ACTIONS.SECURITY_PERMISSION_DENIED
  if (moduleName === 'auth') return deriveAuthAction({ req, result })
  if (result === AUDIT_RESULTS.FAILURE) return AUDIT_ACTIONS.API_MUTATION_FAILED

  if (moduleName === 'repositories' && parts.includes('ai-reviews')) return AUDIT_ACTIONS.AI_REVIEW_REQUESTED
  if (moduleName === 'ai-reviews') return AUDIT_ACTIONS.AI_REVIEW_REQUESTED
  if (moduleName === 'score-sheets' && tail === 'submit') return AUDIT_ACTIONS.SCORE_SHEET_SUBMITTED
  if (moduleName === 'rankings' && req.method === 'POST') return AUDIT_ACTIONS.RANKING_GENERATED
  if (moduleName === 'results') return AUDIT_ACTIONS.RESULTS_PUBLISHED
  if (moduleName === 'permissions' && req.method === 'PATCH') return AUDIT_ACTIONS.PERMISSION_UPDATED
  if (moduleName === 'roles' && parts.includes('permissions')) return AUDIT_ACTIONS.ROLE_PERMISSION_CHANGED
  if (moduleName === 'teams' && parts.includes('invitations')) {
    if (tail === 'accept') return AUDIT_ACTIONS.TEAM_INVITATION_ACCEPTED
    if (tail === 'decline') return AUDIT_ACTIONS.TEAM_INVITATION_DECLINED
    if (req.method === 'DELETE') return AUDIT_ACTIONS.TEAM_INVITATION_CANCELLED
    return AUDIT_ACTIONS.TEAM_MEMBER_INVITED
  }
  if (moduleName === 'media') {
    if (req.method === 'POST') return AUDIT_ACTIONS.FILE_UPLOADED
    if (req.method === 'DELETE') return AUDIT_ACTIONS.FILE_DELETED
  }

  const prefix = moduleToActionPrefix(moduleName)
  if (req.method === 'POST') return `${prefix}_CREATED`
  if (req.method === 'PUT' || req.method === 'PATCH') return `${prefix}_UPDATED`
  if (req.method === 'DELETE') return `${prefix}_DELETED`
  return AUDIT_ACTIONS.API_MUTATION_COMPLETED
}

const shouldAudit = ({ req, statusCode }) => {
  if (SKIP_PATHS.some(path => req.originalUrl.startsWith(path))) return false
  if (req.originalUrl.startsWith('/api/audit-logs')) return false
  if (req.originalUrl.startsWith('/api-docs')) return false
  if (MUTATION_METHODS.has(req.method)) return true
  if (statusCode >= 400) return true
  if (req.originalUrl.startsWith('/api/auth/google')) return true
  return statusCode > READ_SUCCESS_STATUS_MAX
}

const buildDescription = ({ req, action, result, statusCode }) => {
  const parts = getPathParts(req)
  const moduleName = parts[0] || 'system'
  return `${action} ${result.toLowerCase()} for ${req.method} /${parts.join('/')} with HTTP ${statusCode} in ${moduleName}`
}

const auditLogMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  let responseBody = null
  const originalJson = res.json.bind(res)
  res.json = (body) => {
    responseBody = body
    return originalJson(body)
  }

  req.audit = req.audit || {}

  res.on('finish', () => {
    if (!shouldAudit({ req, statusCode: res.statusCode })) return

    const result = res.statusCode >= 400 ? AUDIT_RESULTS.FAILURE : AUDIT_RESULTS.SUCCESS
    const action = deriveAction({ req, result, statusCode: res.statusCode })
    const entityType = req.audit.entityType || MODULE_ENTITY_MAP[getPathParts(req)[0]] || AUDIT_ENTITY_TYPES.SYSTEM
    const entityId = req.audit.entityId || findEntityId({ req, responseBody })
    const actor = getActor({ req, responseBody })
    const formattedResponse = formatResponseForAuditLog(responseBody)

    AUDIT_LOG_SERVICE.createAuditLog({
      userId: actor.id,
      username: actor.username,
      userRole: actor.userRole,
      action,
      entityType,
      entityId,
      resourceType: entityType,
      resourceId: entityId,
      oldValue: req.audit.oldValue || null,
      newValue: req.audit.newValue || (MUTATION_METHODS.has(req.method) ? sanitize(req.body) : null),
      description: req.audit.description || buildDescription({ req, action, result, statusCode: res.statusCode }),
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestId,
      sessionId: getSessionId(req),
      result,
      errorMessage: result === AUDIT_RESULTS.FAILURE ? responseBody?.message || responseBody?.errors?.[0] || null : null,
      sourceModule: req.audit.sourceModule || getPathParts(req)[0] || 'system',
      metadata: {
        ...(req.audit.metadata || {}),
        method: req.method,
        path: req.originalUrl,
        params: sanitize(req.params),
        query: sanitize(req.query),
        response: formattedResponse
      }
    }).catch(() => {})
  })

  next()
}

export default auditLogMiddleware
