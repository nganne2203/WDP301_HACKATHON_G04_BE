import { Router } from 'express'

import { ROUND_CONTROLLER } from './round.controller.js'
import { ROUND_VALIDATION } from './round.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(ROUND_VALIDATION.listRounds),
  ROUND_CONTROLLER.listRounds
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(ROUND_VALIDATION.createRound),
  ROUND_CONTROLLER.createRound
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(ROUND_VALIDATION.getRoundById),
  ROUND_CONTROLLER.getRoundById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(ROUND_VALIDATION.updateRound),
  ROUND_CONTROLLER.updateRound
)

router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(ROUND_VALIDATION.getRoundById),
  ROUND_CONTROLLER.deleteRound
)

export default router
