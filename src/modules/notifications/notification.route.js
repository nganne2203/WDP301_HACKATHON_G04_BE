import { Router } from 'express'

import { NOTIFICATION_CONTROLLER } from './notification.controller.js'
import { NOTIFICATION_VALIDATION } from './notification.validation.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  validationHandlingMiddleware(NOTIFICATION_VALIDATION.listNotifications),
  NOTIFICATION_CONTROLLER.listMine
)

router.patch(
  '/read-all',
  NOTIFICATION_CONTROLLER.markAllAsRead
)

router.patch(
  '/:id/read',
  validationHandlingMiddleware(NOTIFICATION_VALIDATION.notificationId),
  NOTIFICATION_CONTROLLER.markAsRead
)

export default router
