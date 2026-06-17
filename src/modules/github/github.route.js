import { Router } from 'express'

import { GITHUB_CONTROLLER } from './github.controller.js'
import { GITHUB_VALIDATION } from './github.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { sensitiveRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/config',
  permissionMiddleware(PERMISSIONS.GITHUB_CONFIGURE),
  validationHandlingMiddleware(GITHUB_VALIDATION.eventQuery),
  GITHUB_CONTROLLER.getConfig
)

router.post(
  '/config',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_CONFIGURE),
  validationHandlingMiddleware(GITHUB_VALIDATION.saveConfig),
  GITHUB_CONTROLLER.saveConfig
)

router.post(
  '/config/test',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_CONFIGURE),
  validationHandlingMiddleware(GITHUB_VALIDATION.testConnection),
  GITHUB_CONTROLLER.testConnection
)

router.post(
  '/repositories',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(GITHUB_VALIDATION.createRepository),
  GITHUB_CONTROLLER.createRepository
)

router.put(
  '/repositories/:repoName/collaborators/:username',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(GITHUB_VALIDATION.assignCollaborator),
  GITHUB_CONTROLLER.assignCollaborator
)

router.post(
  '/repositories/:repoName/webhooks/register',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(GITHUB_VALIDATION.registerRepositoryWebhook),
  GITHUB_CONTROLLER.registerRepositoryWebhook
)

router.delete(
  '/repositories/:repoName/collaborators/:username',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_ACCESS_REVOKE),
  validationHandlingMiddleware(GITHUB_VALIDATION.revokeCollaborator),
  GITHUB_CONTROLLER.revokeCollaborator
)

router.post(
  '/organization/invitations',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(GITHUB_VALIDATION.inviteOrganizationMember),
  GITHUB_CONTROLLER.inviteOrganizationMember
)

router.post(
  '/organization/revoke-members',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_ACCESS_REVOKE),
  validationHandlingMiddleware(GITHUB_VALIDATION.revokeMembers),
  GITHUB_CONTROLLER.revokeMembers
)

router.post(
  '/repositories/bulk',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(GITHUB_VALIDATION.bulkCreateRepositories),
  GITHUB_CONTROLLER.bulkCreateRepositories
)

export default router
