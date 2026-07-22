import { Router } from 'express'

import { TRACK_CONTROLLER } from './track.controller.js'
import { TRACK_VALIDATION } from './track.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Tracks
 *     description: Competition track/category endpoints
 *
 * components:
 *   schemas:
 *     Track:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b201
 *         competition:
 *           type: object
 *           nullable: true
 *         code:
 *           type: string
 *           example: A
 *         name:
 *           type: string
 *           example: Bang A
 *         description:
 *           type: string
 *           nullable: true
 *           example: AI for requirements and design
 *         topic:
 *           type: string
 *           nullable: true
 *           example: AI-Powered Requirements Engineering
 *         problemStatement:
 *           type: string
 *           nullable: true
 *           example: Build tools that improve requirement elicitation and design quality.
 *         type:
 *           type: string
 *           example: PRELIMINARY_GROUP
 *         teamIds:
 *           type: array
 *           items:
 *             type: string
 *         maxTeams:
 *           type: integer
 *           example: 20
 *         status:
 *           type: string
 *           example: LOCKED
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     TrackRequest:
 *       type: object
 *       required: [competitionId, name]
 *       properties:
 *         competitionId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b101
 *         code:
 *           type: string
 *           example: A
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 120
 *           example: Bang A
 *         description:
 *           type: string
 *           nullable: true
 *         topic:
 *           type: string
 *           nullable: true
 *         problemStatement:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [PRELIMINARY_GROUP, FINAL_POOL, GENERAL]
 *         teamIds:
 *           type: array
 *           items:
 *             type: string
 *         maxTeams:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [DRAFT, OPEN, LOCKED, COMPLETED]
 */

router.use(authorizationMiddleware)

/**
 * @swagger
 * /api/tracks:
 *   get:
 *     summary: List tracks
 *     tags: [Tracks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: competitionId
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
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
 *         description: Tracks retrieved successfully
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.TRACK_VIEW),
  validationHandlingMiddleware(TRACK_VALIDATION.listTracks),
  TRACK_CONTROLLER.listTracks
)

/**
 * @swagger
 * /api/tracks:
 *   post:
 *     summary: Create a track
 *     tags: [Tracks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TrackRequest'
 *     responses:
 *       201:
 *         description: Track created successfully
 *       403:
 *         description: Requires TRACK_CREATE permission
 *       409:
 *         description: Track name already exists in this competition
 */
router.post(
  '/',
  permissionMiddleware(PERMISSIONS.TRACK_CREATE),
  validationHandlingMiddleware(TRACK_VALIDATION.createTrack),
  TRACK_CONTROLLER.createTrack
)

/**
 * @swagger
 * /api/tracks/{id}:
 *   get:
 *     summary: Get a track by id
 *     tags: [Tracks]
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
 *         description: Track retrieved successfully
 *       404:
 *         description: Track not found
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.TRACK_VIEW),
  validationHandlingMiddleware(TRACK_VALIDATION.getTrackById),
  TRACK_CONTROLLER.getTrackById
)

/**
 * @swagger
 * /api/tracks/{id}:
 *   patch:
 *     summary: Update a track
 *     tags: [Tracks]
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
 *             $ref: '#/components/schemas/TrackRequest'
 *     responses:
 *       200:
 *         description: Track updated successfully
 *       403:
 *         description: Requires TRACK_UPDATE permission
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.TRACK_UPDATE),
  validationHandlingMiddleware(TRACK_VALIDATION.updateTrack),
  TRACK_CONTROLLER.updateTrack
)

/**
 * @swagger
 * /api/tracks/{id}:
 *   delete:
 *     summary: Delete a track
 *     tags: [Tracks]
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
 *         description: Track deleted successfully
 *       403:
 *         description: Requires TRACK_DELETE permission
 */
router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.TRACK_DELETE),
  validationHandlingMiddleware(TRACK_VALIDATION.getTrackById),
  TRACK_CONTROLLER.deleteTrack
)

export default router
