import { Router } from 'express'

import { AI_REVIEW_CONTROLLER } from '#modules/ai-reviews/ai-review.controller.js'
import { AI_REVIEW_VALIDATION } from '#modules/ai-reviews/ai-review.validation.js'
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

router.get(
  '/:id/commits',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryCommits),
  REPOSITORY_CONTROLLER.listRepositoryCommits
)

router.get(
  '/:id/commit-diffs',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryCommitDiffs),
  REPOSITORY_CONTROLLER.listRepositoryCommitDiffs
)

router.get(
  '/:id/static-analysis',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryStaticAnalysis),
  REPOSITORY_CONTROLLER.listRepositoryStaticAnalysis
)

router.get(
  '/:id/impact-decisions',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.listRepositoryImpactDecisions),
  REPOSITORY_CONTROLLER.listRepositoryImpactDecisions
)

router.get(
  '/:id/ai-reviews',
  permissionMiddleware(PERMISSIONS.AI_REVIEW_VIEW),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.repositoryAiReviews),
  AI_REVIEW_CONTROLLER.listRepositoryAiReviews
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.updateRepository),
  REPOSITORY_CONTROLLER.updateRepository
)

router.post(
  '/:id/sync-commits',
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.syncRepositoryCommits),
  REPOSITORY_CONTROLLER.syncRepositoryCommits
)

router.post(
  '/:id/analyze-commit',
  permissionMiddleware(PERMISSIONS.GITHUB_REPOSITORY_CREATE),
  validationHandlingMiddleware(REPOSITORY_VALIDATION.analyzeCommit),
  REPOSITORY_CONTROLLER.analyzeCommit
)

router.post(
  '/:id/ai-reviews/per-push',
  permissionMiddleware(PERMISSIONS.AI_REVIEW_TRIGGER),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.createPerPushAudit),
  AI_REVIEW_CONTROLLER.createPerPushAudit
)

router.post(
  '/:id/ai-reviews/team-aggregate',
  permissionMiddleware(PERMISSIONS.AI_REVIEW_TRIGGER),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.createTeamAggregateAudit),
  AI_REVIEW_CONTROLLER.createTeamAggregateAudit
)

export default router
