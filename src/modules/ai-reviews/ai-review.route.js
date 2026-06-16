import { Router } from 'express'

import { AI_REVIEW_CONTROLLER } from './ai-review.controller.js'
import { AI_REVIEW_VALIDATION } from './ai-review.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.post(
  '/:id/callback',
  AI_REVIEW_CONTROLLER.handleCallback
)

router.use(authorizationMiddleware)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.AI_REVIEW_VIEW),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.getAiReviewById),
  AI_REVIEW_CONTROLLER.getAiReviewById
)

router.post(
  '/:id/redispatch',
  permissionMiddleware(PERMISSIONS.AI_REVIEW_TRIGGER),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.redispatchAiReview),
  AI_REVIEW_CONTROLLER.redispatchAiReview
)

export default router
