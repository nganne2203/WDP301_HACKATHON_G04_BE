import { Router } from 'express'

import { TRACK_CONTROLLER } from './track.controller.js'
import { TRACK_VALIDATION } from './track.validation.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { requireRoles } from '#middlewares/policiesHandlingMiddleware.js'
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
 *         event:
 *           type: object
 *           nullable: true
 *         name:
 *           type: string
 *           example: Web Development
 *         description:
 *           type: string
 *           nullable: true
 *           example: Web-focused projects
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     TrackRequest:
 *       type: object
 *       required: [eventId, name]
 *       properties:
 *         eventId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b101
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 120
 *           example: Web Development
 *         description:
 *           type: string
 *           nullable: true
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
 *         name: eventId
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
 *         description: Requires ADMIN or COORDINATOR role
 *       409:
 *         description: Track name already exists in this event
 */
router.post(
  '/',
  requireRoles('ADMIN', 'COORDINATOR'),
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
 *         description: Requires ADMIN or COORDINATOR role
 */
router.patch(
  '/:id',
  requireRoles('ADMIN', 'COORDINATOR'),
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
 *         description: Requires ADMIN or COORDINATOR role
 */
router.delete(
  '/:id',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(TRACK_VALIDATION.getTrackById),
  TRACK_CONTROLLER.deleteTrack
)

export default router
