import { Router } from 'express'

import { TIMELINE_CONTROLLER } from './timeline.controller.js'
import { TIMELINE_VALIDATION } from './timeline.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(TIMELINE_VALIDATION.listTimelines),
  TIMELINE_CONTROLLER.listTimelines
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(TIMELINE_VALIDATION.createTimeline),
  TIMELINE_CONTROLLER.createTimeline
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(TIMELINE_VALIDATION.getTimelineById),
  TIMELINE_CONTROLLER.getTimelineById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(TIMELINE_VALIDATION.updateTimeline),
  TIMELINE_CONTROLLER.updateTimeline
)

router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(TIMELINE_VALIDATION.getTimelineById),
  TIMELINE_CONTROLLER.deleteTimeline
)

export default router
