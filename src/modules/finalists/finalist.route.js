import { Router } from 'express'

import { FINALIST_CONTROLLER } from './finalist.controller.js'
import { FINALIST_VALIDATION } from './finalist.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { sensitiveRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.SCORE_VIEW),
  validationHandlingMiddleware(FINALIST_VALIDATION.listFinalists),
  FINALIST_CONTROLLER.listFinalists
)

router.post(
  '/select',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.FINALIST_SELECT),
  validationHandlingMiddleware(FINALIST_VALIDATION.selectFinalists),
  FINALIST_CONTROLLER.selectFinalists
)

export default router
