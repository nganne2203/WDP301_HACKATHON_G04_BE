import { Router } from 'express'

import { COMPETITION_CONTROLLER } from './competition.controller.js'
import { COMPETITION_VALIDATION } from './competition.validation.js'
import { MEDIA_CONTROLLER } from '#modules/media/media.controller.js'
import { MEDIA_VALIDATION } from '#modules/media/media.validation.js'
import { TEAM_CONTROLLER } from '#modules/teams/team.controller.js'
import { TEAM_VALIDATION } from '#modules/teams/team.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Competitions
 *     description: Hackathon competition lifecycle endpoints
 *
 * components:
 *   schemas:
 *     Competition:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b101
 *         title:
 *           type: string
 *           example: SEAL Hackathon 2026
 *         description:
 *           type: string
 *           nullable: true
 *           example: University hackathon for software engineering teams
 *         semester:
 *           type: string
 *           nullable: true
 *           example: 2026A
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [DRAFT, OPEN_REGISTRATION, ONGOING, SCORING, COMPLETED, ARCHIVED]
 *           example: DRAFT
 *         createdBy:
 *           type: object
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CompetitionRequest:
 *       type: object
 *       required: [title]
 *       properties:
 *         title:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *         description:
 *           type: string
 *           nullable: true
 *         semester:
 *           type: string
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [DRAFT, OPEN_REGISTRATION, ONGOING, SCORING, COMPLETED, ARCHIVED]
 *           default: DRAFT
 */

router.use(authorizationMiddleware)

/**
 * @swagger
 * /api/competitions:
 *   get:
 *     summary: List competitions
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, OPEN_REGISTRATION, ONGOING, SCORING, COMPLETED, ARCHIVED]
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Competitions retrieved successfully
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(COMPETITION_VALIDATION.listCompetitions),
  COMPETITION_CONTROLLER.listCompetitions
)

/**
 * @swagger
 * /api/competitions:
 *   post:
 *     summary: Create an competition
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompetitionRequest'
 *     responses:
 *       201:
 *         description: Competition created successfully
 *       403:
 *         description: Requires COMPETITION_CREATE permission
 */
router.post(
  '/',
  permissionMiddleware(PERMISSIONS.COMPETITION_CREATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.createCompetition),
  COMPETITION_CONTROLLER.createCompetition
)

/**
 * @swagger
 * /api/competitions/{id}/invitations:
 *   post:
 *     summary: Send participant invitation emails for an competition
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/:id/invitations',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.sendInvitations),
  COMPETITION_CONTROLLER.sendInvitations
)

/**
 * @swagger
 * /api/competitions/{id}/gallery:
 *   get:
 *     summary: Get approved competition media gallery
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/:id/gallery',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(MEDIA_VALIDATION.eventGallery),
  MEDIA_CONTROLLER.getCompetitionGallery
)

router.get(
  '/:competitionId/teams/capacity',
  permissionMiddleware(PERMISSIONS.TEAM_VIEW),
  validationHandlingMiddleware(TEAM_VALIDATION.getCompetitionCapacity),
  TEAM_CONTROLLER.getCompetitionTeamCapacity
)

/**
 * @swagger
 * /api/competitions/{id}:
 *   get:
 *     summary: Get an competition by id
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *     responses:
 *       200:
 *         description: Competition retrieved successfully
 *       404:
 *         description: Competition not found
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.COMPETITION_VIEW),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.getCompetitionById
)

/**
 * @swagger
 * /api/competitions/{id}:
 *   patch:
 *     summary: Update an competition
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompetitionRequest'
 *     responses:
 *       200:
 *         description: Competition updated successfully
 *       403:
 *         description: Requires COMPETITION_UPDATE permission
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.updateCompetition),
  COMPETITION_CONTROLLER.updateCompetition
)

/**
 * @swagger
 * /api/competitions/{id}/status:
 *   patch:
 *     summary: Update an competition status
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, OPEN_REGISTRATION, ONGOING, SCORING, COMPLETED, ARCHIVED]
 *     responses:
 *       200:
 *         description: Competition status updated successfully
 */
router.patch(
  '/:id/status',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.updateCompetitionStatus),
  COMPETITION_CONTROLLER.updateCompetitionStatus
)

router.post(
  '/:id/open-registration',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.openRegistration
)

router.post(
  '/:id/close-registration',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.closeRegistration
)

router.post(
  '/:id/start',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.startCompetition
)

router.post(
  '/:id/start-scoring',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.startScoring
)

router.post(
  '/:id/complete',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.completeCompetition
)

router.post(
  '/:id/archive',
  permissionMiddleware(PERMISSIONS.COMPETITION_UPDATE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.archiveCompetition
)

/**
 * @swagger
 * /api/competitions/{id}:
 *   delete:
 *     summary: Delete an competition
 *     tags: [Competitions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *     responses:
 *       200:
 *         description: Competition deleted successfully
 *       403:
 *         description: Requires COMPETITION_DELETE permission
 */
router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.COMPETITION_DELETE),
  validationHandlingMiddleware(COMPETITION_VALIDATION.getCompetitionById),
  COMPETITION_CONTROLLER.deleteCompetition
)

export default router
