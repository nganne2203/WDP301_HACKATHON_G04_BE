import { Router } from 'express'

import { CHAT_CONTROLLER } from './chat.controller.js'
import { CHAT_VALIDATION } from './chat.validation.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/rooms',
  validationHandlingMiddleware(CHAT_VALIDATION.listRooms),
  CHAT_CONTROLLER.listRooms
)

router.get(
  '/rooms/:id/messages',
  validationHandlingMiddleware(CHAT_VALIDATION.listMessages),
  CHAT_CONTROLLER.listMessages
)

router.post(
  '/rooms/:id/seen',
  validationHandlingMiddleware(CHAT_VALIDATION.markRoomSeen),
  CHAT_CONTROLLER.markRoomSeen
)

router.post(
  '/messages',
  validationHandlingMiddleware(CHAT_VALIDATION.sendMessage),
  CHAT_CONTROLLER.sendMessage
)

router.get('/unread-count', CHAT_CONTROLLER.getUnreadCount)

export default router
