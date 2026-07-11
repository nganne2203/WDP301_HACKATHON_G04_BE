import { Router } from 'express'

import { MEDIA_CONTROLLER } from './media.controller.js'
import { MEDIA_VALIDATION } from './media.validation.js'
import { MEDIA_MULTIPART } from './media.multipart.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'
import { createRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'

const router = Router()

const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many media upload requests. Please try again later.',
  keyGenerator: (req) => `media-upload:${req.user?.id || req.ip || 'unknown'}`
})

router.use(authorizationMiddleware)

router.post(
  '/upload',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  uploadRateLimiter,
  MEDIA_MULTIPART.multipartBodyParser,
  MEDIA_MULTIPART.mediaMultipartMiddleware,
  validationHandlingMiddleware(MEDIA_VALIDATION.uploadMedia),
  MEDIA_CONTROLLER.uploadMedia
)

router.get(
  '/my-history',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(MEDIA_VALIDATION.listMyHistory),
  MEDIA_CONTROLLER.listMyHistory
)

router.get(
  '/:mediaId/view-url',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(MEDIA_VALIDATION.viewUrl),
  MEDIA_CONTROLLER.getSignedUrl
)

router.delete(
  '/:mediaId',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(MEDIA_VALIDATION.deleteMedia),
  MEDIA_CONTROLLER.deleteMedia
)

export default router
