import { Router } from 'express'

import { MEDIA_CONTROLLER } from './media.controller.js'
import { MEDIA_VALIDATION } from './media.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/config',
  permissionMiddleware(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  MEDIA_CONTROLLER.getStorageConfig
)

router.put(
  '/config',
  permissionMiddleware(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validationHandlingMiddleware(MEDIA_VALIDATION.config),
  MEDIA_CONTROLLER.saveStorageConfig
)

router.get(
  '/statistics',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(MEDIA_VALIDATION.statistics),
  MEDIA_CONTROLLER.getStatistics
)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(MEDIA_VALIDATION.listAdminMedia),
  MEDIA_CONTROLLER.listAdminMedia
)

router.patch(
  '/:mediaId/approve',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(MEDIA_VALIDATION.approveMedia),
  MEDIA_CONTROLLER.approveMedia
)

router.patch(
  '/:mediaId/reject',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(MEDIA_VALIDATION.rejectMedia),
  MEDIA_CONTROLLER.rejectMedia
)

router.delete(
  '/:mediaId',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(MEDIA_VALIDATION.deleteMedia),
  MEDIA_CONTROLLER.deleteMedia
)

export default router
