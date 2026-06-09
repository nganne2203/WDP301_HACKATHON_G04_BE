import { Router } from 'express'

import { AUDIT_LOG_CONTROLLER } from './audit-log.controller.js'
import { AUDIT_LOG_VALIDATION } from './audit-log.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.AUDIT_LOG_VIEW),
  validationHandlingMiddleware(AUDIT_LOG_VALIDATION.listAuditLogs),
  AUDIT_LOG_CONTROLLER.listAuditLogs
)

router.get(
  '/summary',
  permissionMiddleware(PERMISSIONS.AUDIT_LOG_VIEW),
  validationHandlingMiddleware(AUDIT_LOG_VALIDATION.getAuditLogSummary),
  AUDIT_LOG_CONTROLLER.getAuditLogSummary
)

export default router
