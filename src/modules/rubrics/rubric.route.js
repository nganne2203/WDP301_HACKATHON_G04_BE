import { Router } from 'express'

import { RUBRIC_CONTROLLER } from './rubric.controller.js'
import { RUBRIC_VALIDATION } from './rubric.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(RUBRIC_VALIDATION.listRubrics),
  RUBRIC_CONTROLLER.listRubrics
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(RUBRIC_VALIDATION.createRubric),
  RUBRIC_CONTROLLER.createRubric
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(RUBRIC_VALIDATION.updateRubric),
  RUBRIC_CONTROLLER.updateRubric
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(RUBRIC_VALIDATION.getRubricById),
  RUBRIC_CONTROLLER.getRubricById
)

router.post(
  '/:id/criteria',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(RUBRIC_VALIDATION.addCriterion),
  RUBRIC_CONTROLLER.addCriterion
)

router.patch(
  '/:id/criteria/:criterionId',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(RUBRIC_VALIDATION.updateCriterion),
  RUBRIC_CONTROLLER.updateCriterion
)

router.delete(
  '/:id/criteria/:criterionId',
  permissionMiddleware(PERMISSIONS.JUDGING_ASSIGN),
  validationHandlingMiddleware(RUBRIC_VALIDATION.deleteCriterion),
  RUBRIC_CONTROLLER.deleteCriterion
)

export default router
