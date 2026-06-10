import { Router } from 'express'

import { PARTICIPANT_CONTROLLER } from './participant.controller.js'
import { PARTICIPANT_VALIDATION } from './participant.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Participants
 *     description: Event participant registration and check-in endpoints
 */

router.use(authorizationMiddleware)

/**
 * @swagger
 * /api/participants:
 *   get:
 *     summary: List participants
 *     tags: [Participants]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *       - in: query
 *         name: checkInStatus
 *         schema:
 *           type: string
 *           enum: [NOT_CHECKED_IN, CHECKED_IN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [INVITED, REGISTERED, ACTIVE, WITHDRAWN]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Participants retrieved successfully
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_VIEW),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.listParticipants),
  PARTICIPANT_CONTROLLER.listParticipants
)

/**
 * @swagger
 * /api/participants:
 *   post:
 *     summary: Register a participant for an event
 *     tags: [Participants]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId]
 *             properties:
 *               eventId:
 *                 type: string
 *               userId:
 *                 type: string
 *               chapterName:
 *                 type: string
 *               isGraduated:
 *                 type: boolean
 *               consentMediaUse:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Participant registered successfully
 *       409:
 *         description: User already registered for this event
 */
router.post(
  '/',
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.createParticipant),
  PARTICIPANT_CONTROLLER.registerParticipant
)

/**
 * @swagger
 * /api/participants/{id}:
 *   get:
 *     summary: Get a participant by id
 *     tags: [Participants]
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
 *         description: Participant retrieved successfully
 *       404:
 *         description: Participant not found
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_VIEW),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.getById),
  PARTICIPANT_CONTROLLER.getParticipantById
)

/**
 * @swagger
 * /api/participants/{id}:
 *   patch:
 *     summary: Update a participant
 *     tags: [Participants]
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
 *         description: Participant updated successfully
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.updateParticipant),
  PARTICIPANT_CONTROLLER.updateParticipant
)

/**
 * @swagger
 * /api/participants/{id}/check-in:
 *   patch:
 *     summary: Check in a participant
 *     tags: [Participants]
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
 *         description: Check-in successful
 *       400:
 *         description: Already checked in
 */
router.patch(
  '/:id/check-in',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  validationHandlingMiddleware(PARTICIPANT_VALIDATION.getById),
  PARTICIPANT_CONTROLLER.checkIn
)

export default router
