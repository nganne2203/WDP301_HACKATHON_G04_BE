import { Router } from 'express'

import { EVENT_CONTROLLER } from './event.controller.js'
import { EVENT_VALIDATION } from './event.validation.js'
import { MEDIA_CONTROLLER } from '#modules/media/media.controller.js'
import { MEDIA_VALIDATION } from '#modules/media/media.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Events
 *     description: Hackathon event lifecycle endpoints
 *
 * components:
 *   schemas:
 *     Event:
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
 *     EventRequest:
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
 * /api/events:
 *   get:
 *     summary: List events
 *     tags: [Events]
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
 *         description: Events retrieved successfully
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(EVENT_VALIDATION.listEvents),
  EVENT_CONTROLLER.listEvents
)

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create an event
 *     tags: [Events]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EventRequest'
 *     responses:
 *       201:
 *         description: Event created successfully
 *       403:
 *         description: Requires EVENT_CREATE permission
 */
router.post(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_CREATE),
  validationHandlingMiddleware(EVENT_VALIDATION.createEvent),
  EVENT_CONTROLLER.createEvent
)

/**
 * @swagger
 * /api/events/{id}/invitations:
 *   post:
 *     summary: Send participant invitation emails for an event
 *     tags: [Events]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/:id/invitations',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(EVENT_VALIDATION.sendInvitations),
  EVENT_CONTROLLER.sendInvitations
)

/**
 * @swagger
 * /api/events/{id}/gallery:
 *   get:
 *     summary: Get approved event media gallery
 *     tags: [Events]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/:id/gallery',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(MEDIA_VALIDATION.eventGallery),
  MEDIA_CONTROLLER.getEventGallery
)

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get an event by id
 *     tags: [Events]
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
 *         description: Event retrieved successfully
 *       404:
 *         description: Event not found
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(EVENT_VALIDATION.getEventById),
  EVENT_CONTROLLER.getEventById
)

/**
 * @swagger
 * /api/events/{id}:
 *   patch:
 *     summary: Update an event
 *     tags: [Events]
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
 *             $ref: '#/components/schemas/EventRequest'
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       403:
 *         description: Requires EVENT_UPDATE permission
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(EVENT_VALIDATION.updateEvent),
  EVENT_CONTROLLER.updateEvent
)

/**
 * @swagger
 * /api/events/{id}/status:
 *   patch:
 *     summary: Update an event status
 *     tags: [Events]
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
 *         description: Event status updated successfully
 */
router.patch(
  '/:id/status',
  permissionMiddleware(PERMISSIONS.EVENT_UPDATE),
  validationHandlingMiddleware(EVENT_VALIDATION.updateEventStatus),
  EVENT_CONTROLLER.updateEventStatus
)

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
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
 *         description: Event deleted successfully
 *       403:
 *         description: Requires EVENT_DELETE permission
 */
router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.EVENT_DELETE),
  validationHandlingMiddleware(EVENT_VALIDATION.getEventById),
  EVENT_CONTROLLER.deleteEvent
)

export default router
