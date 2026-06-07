import { Router } from 'express'

import { RESULT_CONTROLLER } from './result.controller.js'
import { RESULT_VALIDATION } from './result.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.post(
  '/publish',
  permissionMiddleware(PERMISSIONS.RESULT_PUBLISH),
  validationHandlingMiddleware(RESULT_VALIDATION.publishResults),
  RESULT_CONTROLLER.publishResults
)

export default router
