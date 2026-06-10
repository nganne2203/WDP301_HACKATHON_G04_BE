import { Router } from 'express'

import { TIMELINE_CONTROLLER } from './timeline.controller.js'
import { TIMELINE_VALIDATION } from './timeline.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Timelines
 *     description: Event timeline/schedule management endpoints
 */

router.use(authorizationMiddleware)

/**
 * @swagger
 * /api/timelines:
 *   get:
 *     summary: List timeline events
 *     tags: [Timelines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [WORKSHOP, CHECK_IN, ROUND, RESULT_PUBLISHING, CEREMONY, OTHER]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, ONGOING, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Timelines retrieved successfully
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(TIMELINE_VALIDATION.listTimelines),
  TIMELINE_CONTROLLER.listTimelines
)

/**
 * @swagger
 * /api/timelines:
 *   post:
 *     summary: Create a timeline event
 *     tags: [Timelines]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, title]
 *             properties:
 *               eventId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               eventType:
 *                 type: string
 *                 enum: [WORKSHOP, CHECK_IN, ROUND, RESULT_PUBLISHING, CEREMONY, OTHER]
 *               status:
 *                 type: string
 *                 enum: [SCHEDULED, ONGOING, COMPLETED, CANCELLED]
 *     responses:
 *       201:
 *         description: Timeline created successfully
 */
router.post(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(TIMELINE_VALIDATION.createTimeline),
  TIMELINE_CONTROLLER.createTimeline
)

/**
 * @swagger
 * /api/timelines/{id}:
 *   get:
 *     summary: Get a timeline event by id
 *     tags: [Timelines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timeline retrieved successfully
 *       404:
 *         description: Timeline not found
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(TIMELINE_VALIDATION.getById),
  TIMELINE_CONTROLLER.getTimelineById
)

/**
 * @swagger
 * /api/timelines/{id}:
 *   patch:
 *     summary: Update a timeline event
 *     tags: [Timelines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timeline updated successfully
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(TIMELINE_VALIDATION.updateTimeline),
  TIMELINE_CONTROLLER.updateTimeline
)

/**
 * @swagger
 * /api/timelines/{id}:
 *   delete:
 *     summary: Delete a timeline event
 *     tags: [Timelines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timeline deleted successfully
 */
router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(TIMELINE_VALIDATION.getById),
  TIMELINE_CONTROLLER.deleteTimeline
)

export default router
