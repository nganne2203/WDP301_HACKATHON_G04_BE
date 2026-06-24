import { Router } from 'express'

import { PARTICIPANT_CONTROLLER } from './participant.controller.js'
import { PARTICIPANT_VALIDATION } from './participant.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_VIEW),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.listParticipants),
  PARTICIPANT_CONTROLLER.listParticipants
)

router.get(
  '/me',
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.getMyParticipant),
  PARTICIPANT_CONTROLLER.getMyParticipant
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.createParticipant),
  PARTICIPANT_CONTROLLER.createParticipant
)

router.post(
  '/check-in/scan',
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.scanCheckInQr),
  PARTICIPANT_CONTROLLER.scanCheckInQr
)

router.post(
  '/check-in/qr',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.generateCheckInQr),
  PARTICIPANT_CONTROLLER.generateCheckInQr
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_VIEW),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.getParticipantById),
  PARTICIPANT_CONTROLLER.getParticipantById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.updateParticipant),
  PARTICIPANT_CONTROLLER.updateParticipant
)

router.patch(
  '/:id/check-in',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.updateCheckIn),
  PARTICIPANT_CONTROLLER.updateCheckInStatus
)

router.patch(
  '/:id/attendance',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.updateAttendance),
  PARTICIPANT_CONTROLLER.updateAttendance
)

router.patch(
  '/:id/github-access',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.updateGithubAccess),
  PARTICIPANT_CONTROLLER.updateGithubAccessStatus
)

export default router
