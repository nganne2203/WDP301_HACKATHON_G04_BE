import { Router } from 'express'

import { JUDGING_BOARD_CONTROLLER } from './judging-board.controller.js'
import { JUDGING_BOARD_VALIDATION } from './judging-board.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(JUDGING_BOARD_VALIDATION.listBoards),
  JUDGING_BOARD_CONTROLLER.listBoards
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(JUDGING_BOARD_VALIDATION.createBoard),
  JUDGING_BOARD_CONTROLLER.createBoard
)

router.post(
  '/auto-assign',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(JUDGING_BOARD_VALIDATION.autoAssignBoards),
  JUDGING_BOARD_CONTROLLER.autoAssignBoards
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(JUDGING_BOARD_VALIDATION.getBoardById),
  JUDGING_BOARD_CONTROLLER.getBoardById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(JUDGING_BOARD_VALIDATION.updateBoard),
  JUDGING_BOARD_CONTROLLER.updateBoard
)

router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(JUDGING_BOARD_VALIDATION.getBoardById),
  JUDGING_BOARD_CONTROLLER.deleteBoard
)

export default router
