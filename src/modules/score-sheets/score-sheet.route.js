import { Router } from 'express'

import { SCORE_SHEET_CONTROLLER } from './score-sheet.controller.js'
import { SCORE_SHEET_VALIDATION } from './score-sheet.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.SCORE_VIEW),
  validationHandlingMiddleware(SCORE_SHEET_VALIDATION.listScoreSheets),
  SCORE_SHEET_CONTROLLER.listScoreSheets
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.SCORE_CREATE),
  validationHandlingMiddleware(SCORE_SHEET_VALIDATION.createScoreSheet),
  SCORE_SHEET_CONTROLLER.createScoreSheet
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.SCORE_VIEW),
  validationHandlingMiddleware(SCORE_SHEET_VALIDATION.getScoreSheetById),
  SCORE_SHEET_CONTROLLER.getScoreSheetById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.SCORE_CREATE),
  validationHandlingMiddleware(SCORE_SHEET_VALIDATION.updateScoreSheet),
  SCORE_SHEET_CONTROLLER.updateScoreSheet
)

router.post(
  '/:id/submit',
  permissionMiddleware(PERMISSIONS.SCORE_CREATE),
  validationHandlingMiddleware(SCORE_SHEET_VALIDATION.submitScoreSheet),
  SCORE_SHEET_CONTROLLER.submitScoreSheet
)

export default router
