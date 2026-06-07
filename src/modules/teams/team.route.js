import { Router } from 'express'

import { AI_REVIEW_CONTROLLER } from '#modules/ai-reviews/ai-review.controller.js'
import { AI_REVIEW_VALIDATION } from '#modules/ai-reviews/ai-review.validation.js'
import { TEAM_CONTROLLER } from './team.controller.js'
import { TEAM_VALIDATION } from './team.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

router.post(
  '/invitations/:token/accept',
  validationHandlingMiddleware(TEAM_VALIDATION.acceptInvitation),
  TEAM_CONTROLLER.acceptInvitation
)

router.post(
  '/invitations/:token/decline',
  validationHandlingMiddleware(TEAM_VALIDATION.declineInvitation),
  TEAM_CONTROLLER.declineInvitation
)

router.use(authorizationMiddleware)

router.get(
  '/',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(TEAM_VALIDATION.listTeams),
  TEAM_CONTROLLER.listTeams
)

router.post(
  '/',
  permissionMiddleware(PERMISSIONS.TEAM_CREATE),
  validationHandlingMiddleware(TEAM_VALIDATION.createTeam),
  TEAM_CONTROLLER.createTeam
)

router.get(
  '/my',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(TEAM_VALIDATION.getMyTeam),
  TEAM_CONTROLLER.getMyTeam
)

router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(TEAM_VALIDATION.getTeamById),
  TEAM_CONTROLLER.getTeamById
)

router.get(
  '/:teamId/ai-audit-summary',
  permissionMiddleware(PERMISSIONS.AI_REVIEW_VIEW),
  validationHandlingMiddleware(AI_REVIEW_VALIDATION.getTeamAiAuditSummary),
  AI_REVIEW_CONTROLLER.getTeamAiAuditSummary
)

router.patch(
  '/:id/status',
  permissionMiddleware(PERMISSIONS.TEAM_UPDATE),
  validationHandlingMiddleware(TEAM_VALIDATION.updateTeamStatus),
  TEAM_CONTROLLER.updateTeamStatus
)

router.patch(
  '/:id/placement',
  permissionMiddleware(PERMISSIONS.TEAM_UPDATE),
  validationHandlingMiddleware(TEAM_VALIDATION.updateTeamPlacement),
  TEAM_CONTROLLER.updateTeamPlacement
)

router.post(
  '/:id/invitations',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(TEAM_VALIDATION.inviteMembers),
  TEAM_CONTROLLER.inviteMembers
)

router.patch(
  '/:teamId/invitations/:invitationId/replace',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(TEAM_VALIDATION.replaceInvitation),
  TEAM_CONTROLLER.replaceInvitation
)

router.delete(
  '/:teamId/invitations/:invitationId',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(TEAM_VALIDATION.cancelInvitation),
  TEAM_CONTROLLER.cancelInvitation
)

export default router
