import { Router } from 'express'

import { OPERATIONS_CONTROLLER } from './operations.controller.js'
import { OPERATIONS_VALIDATION } from './operations.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/dashboard',
  permissionMiddleware(PERMISSIONS.AUDIT_LOG_VIEW),
  validationHandlingMiddleware(OPERATIONS_VALIDATION.scopedQuery),
  OPERATIONS_CONTROLLER.getDashboardMetrics
)

router.get(
  '/pipeline-summary',
  permissionMiddleware(PERMISSIONS.AUDIT_LOG_VIEW),
  validationHandlingMiddleware(OPERATIONS_VALIDATION.scopedQuery),
  OPERATIONS_CONTROLLER.getPipelineSummary
)

export default router
