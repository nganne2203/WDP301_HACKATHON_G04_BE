import { Router } from 'express'

import { AI_REVIEW_CONTROLLER } from '#modules/ai-reviews/ai-review.controller.js'
import { AI_REVIEW_VALIDATION } from '#modules/ai-reviews/ai-review.validation.js'
import { REPOSITORY_CONTROLLER } from './repository.controller.js'
import { REPOSITORY_VALIDATION } from './repository.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { sensitiveRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositories),
  REPOSITORY_CONTROLLER.listRepositories
)

router.post(
  '/',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.createRepository),
  REPOSITORY_CONTROLLER.createRepository
)

router.get(
  '/missing-confirmed-teams',
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.missingConfirmedTeams),
  REPOSITORY_CONTROLLER.listConfirmedTeamsMissingRepositories
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.getRepositoryById),
  REPOSITORY_CONTROLLER.getRepositoryById
)

router.get(
  '/:id/commits',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryCommits),
  REPOSITORY_CONTROLLER.listRepositoryCommits
)

router.get(
  '/:id/static-analysis',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryCommits),
  REPOSITORY_CONTROLLER.listStaticAnalysis
)

router.get(
  '/:id/ai-reviews',
  permissionMiddleware(PERMISSIONS.AI_REVIEW_VIEW),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.repositoryAiReviews),
  AI_REVIEW_CONTROLLER.listRepositoryAiReviews
)

router.get(
  '/:id/commit-diffs',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryCommits),
  REPOSITORY_CONTROLLER.listCommitDiffs
)

router.get(
  '/:id/impact-decisions',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryCommits),
  REPOSITORY_CONTROLLER.listImpactDecisions
)

router.post(
  '/:id/sync-commits',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.syncRepositoryCommits),
  REPOSITORY_CONTROLLER.syncRepositoryCommits
)

router.patch(
  '/:id',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.updateRepository),
  REPOSITORY_CONTROLLER.updateRepository
)

router.post(
  '/:id/ai-reviews/per-push',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.AI_REVIEW_TRIGGER),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.createPerPushAudit),
  AI_REVIEW_CONTROLLER.createPerPushAudit
)

router.post(
  '/:id/ai-reviews/team-aggregate',
  sensitiveRateLimiter,
  permissionMiddleware(PERMISSIONS.AI_REVIEW_TRIGGER),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.createTeamAggregateAudit),
  AI_REVIEW_CONTROLLER.createTeamAggregateAudit
)

export default router
