import { Router } from 'express'

import { REPOSITORY_CONTROLLER } from './repository.controller.js'
import { REPOSITORY_VALIDATION } from './repository.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositories),
  REPOSITORY_CONTROLLER.listRepositories
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.createRepository),
  REPOSITORY_CONTROLLER.createRepository
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.getRepositoryById),
  REPOSITORY_CONTROLLER.getRepositoryById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.updateRepository),
  REPOSITORY_CONTROLLER.updateRepository
)

export default router
