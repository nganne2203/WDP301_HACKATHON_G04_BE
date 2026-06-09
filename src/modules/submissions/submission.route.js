import { Router } from 'express'

import { SUBMISSION_CONTROLLER } from './submission.controller.js'
import { SUBMISSION_VALIDATION } from './submission.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(SUBMISSION_VALIDATION.listSubmissions),
  SUBMISSION_CONTROLLER.listSubmissions
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(SUBMISSION_VALIDATION.createSubmission),
  SUBMISSION_CONTROLLER.createSubmission
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(SUBMISSION_VALIDATION.getSubmissionById),
  SUBMISSION_CONTROLLER.getSubmissionById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(SUBMISSION_VALIDATION.updateSubmission),
  SUBMISSION_CONTROLLER.updateSubmission
)

router.post(
  '/:id/submit',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(SUBMISSION_VALIDATION.submitSubmission),
  SUBMISSION_CONTROLLER.submitSubmission
)

router.patch(
  '/:id/status',
  permissionMiddleware(PERMISSIONS.TEAM_UPDATE),
  validationHandlingMiddleware(SUBMISSION_VALIDATION.updateSubmissionStatus),
  SUBMISSION_CONTROLLER.updateSubmissionStatus
)

export default router
