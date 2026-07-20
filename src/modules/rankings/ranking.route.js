import { Router } from 'express'

import { RANKING_CONTROLLER } from './ranking.controller.js'
import { RANKING_VALIDATION } from './ranking.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { sensitiveRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(RANKING_VALIDATION.listRankings),
  RANKING_CONTROLLER.listRankings
)

router.post(
  '/generate',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.RANKING_GENERATE),
  validationHandlingMiddleware(RANKING_VALIDATION.generateRankings),
  RANKING_CONTROLLER.generateRankings
)

router.post(
  '/tie-breaks/resolve',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.RANKING_GENERATE),
  validationHandlingMiddleware(RANKING_VALIDATION.resolveTieBreak),
  RANKING_CONTROLLER.resolveTieBreak
)

export default router
