import { Router } from 'express'

import { WORKSHOP_CONTROLLER } from './workshop.controller.js'
import { WORKSHOP_VALIDATION } from './workshop.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Workshops
 *     description: Workshop schedule, questions, ratings, feedback, and Google Meet endpoints
 *
 * components:
 *   schemas:
 *     WorkshopSpeakerInfo:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           nullable: true
 *           example: Nguyen Van A
 *         title:
 *           type: string
 *           nullable: true
 *           example: Senior Engineer
 *         bio:
 *           type: string
 *           nullable: true
 *           example: Speaker on scalable systems.
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           example: speaker@seal.local
 *     UserSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b003
 *         fullName:
 *           type: string
 *           nullable: true
 *           example: Participant User
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           example: participant@seal.local
 *     CompetitionSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b101
 *         title:
 *           type: string
 *           example: SEAL Hackathon 2026
 *         seriesName:
 *           type: string
 *           nullable: true
 *           example: SEAL
 *         season:
 *           type: string
 *           nullable: true
 *           example: 2026A
 *         year:
 *           type: integer
 *           nullable: true
 *           example: 2026
 *         status:
 *           type: string
 *           nullable: true
 *           example: ONGOING
 *     WorkshopGoogleMeet:
 *       type: object
 *       properties:
 *         enabled:
 *           type: boolean
 *           example: true
 *         meetLink:
 *           type: string
 *           example: https://meet.google.com/abc-defg-hij
 *         calendarCompetitionId:
 *           type: string
 *           example: 4hj52jds9s7abcd
 *         htmlLink:
 *           type: string
 *           example: https://www.google.com/calendar/competition?eid=abc
 *         organizerUserId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b003
 *         organizerEmail:
 *           type: string
 *           format: email
 *           example: organizer@seal.local
 *         createdAt:
 *           type: string
 *           format: date-time
 *     Workshop:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b501
 *         competition:
 *           $ref: '#/components/schemas/CompetitionSummary'
 *         competitionId:
 *           type: string
 *           nullable: true
 *           example: 664c3f6a3a6d4a5f3f93b101
 *         timelineActivityId:
 *           type: string
 *           nullable: true
 *           example: 664c3f6a3a6d4a5f3f93b201
 *         title:
 *           type: string
 *           example: Pitching Workshop
 *         description:
 *           type: string
 *           nullable: true
 *           example: Learn how to pitch your product.
 *         presenter:
 *           $ref: '#/components/schemas/UserSummary'
 *         presenterId:
 *           type: string
 *           nullable: true
 *           example: 664c3f6a3a6d4a5f3f93b003
 *         speakerInfo:
 *           $ref: '#/components/schemas/WorkshopSpeakerInfo'
 *         meetLink:
 *           type: string
 *           nullable: true
 *           example: https://meet.google.com/abc-defg-hij
 *         googleMeet:
 *           $ref: '#/components/schemas/WorkshopGoogleMeet'
 *         startTime:
 *           type: string
 *           format: date-time
 *           example: 2026-05-30T08:00:00.000Z
 *         endTime:
 *           type: string
 *           format: date-time
 *           example: 2026-05-30T10:00:00.000Z
 *         questionnaire:
 *           type: array
 *           items:
 *             type: string
 *           example: ["How useful was this session?"]
 *         status:
 *           type: string
 *           enum: [SCHEDULED, LIVE, COMPLETED, CANCELLED]
 *           example: SCHEDULED
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     WorkshopListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Get workshops successfully
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Workshop'
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *     WorkshopResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Get workshop successfully
 *         data:
 *           $ref: '#/components/schemas/Workshop'
 *         pagination:
 *           nullable: true
 *           example: null
 *     WorkshopDeleteResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Delete workshop successfully
 *         data:
 *           nullable: true
 *           example: null
 *         pagination:
 *           nullable: true
 *           example: null
 *     CreateWorkshopRequest:
 *       type: object
 *       required: [competitionId, title, startTime, endTime]
 *       properties:
 *         competitionId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b101
 *         timelineActivityId:
 *           type: string
 *           nullable: true
 *           example: 664c3f6a3a6d4a5f3f93b201
 *         title:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *           example: Pitching Workshop
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 2000
 *           example: Learn how to pitch your product.
 *         presenterId:
 *           type: string
 *           nullable: true
 *           example: 664c3f6a3a6d4a5f3f93b003
 *         speakerInfo:
 *           $ref: '#/components/schemas/WorkshopSpeakerInfo'
 *         meetLink:
 *           type: string
 *           nullable: true
 *           example: https://meet.google.com/abc-defg-hij
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         questionnaire:
 *           type: array
 *           items:
 *             type: string
 *           example: ["How useful was this session?"]
 *         status:
 *           type: string
 *           enum: [SCHEDULED, LIVE, COMPLETED, CANCELLED]
 *           default: SCHEDULED
 *     UpdateWorkshopRequest:
 *       type: object
 *       properties:
 *         competitionId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b101
 *         timelineActivityId:
 *           type: string
 *           nullable: true
 *           example: 664c3f6a3a6d4a5f3f93b201
 *         title:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 2000
 *         presenterId:
 *           type: string
 *           nullable: true
 *         speakerInfo:
 *           $ref: '#/components/schemas/WorkshopSpeakerInfo'
 *         meetLink:
 *           type: string
 *           nullable: true
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         questionnaire:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [SCHEDULED, LIVE, COMPLETED, CANCELLED]
 *     CreateGoogleMeetRequest:
 *       type: object
 *       required: [organizerUserId]
 *       properties:
 *         organizerUserId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b003
 *         attendees:
 *           type: array
 *           items:
 *             type: string
 *             format: email
 *           example: ["guest@seal.local"]
 *     GoogleMeetResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Google Meet link created successfully
 *         data:
 *           type: object
 *           properties:
 *             meetLink:
 *               type: string
 *               example: https://meet.google.com/abc-defg-hij
 *             calendarCompetitionId:
 *               type: string
 *               example: 4hj52jds9s7abcd
 *             htmlLink:
 *               type: string
 *               example: https://www.google.com/calendar/competition?eid=abc
 *             organizerEmail:
 *               type: string
 *               format: email
 *               example: organizer@seal.local
 *         pagination:
 *           nullable: true
 *           example: null
 *     CreateWorkshopQuestionRequest:
 *       type: object
 *       required: [content]
 *       properties:
 *         content:
 *           type: string
 *           minLength: 2
 *           maxLength: 1000
 *           example: What are the key pitching metrics?
 *     WorkshopQuestionVote:
 *       type: object
 *       properties:
 *         voter:
 *           $ref: '#/components/schemas/UserSummary'
 *         votedAt:
 *           type: string
 *           format: date-time
 *     WorkshopQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b601
 *         workshopId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b501
 *         author:
 *           $ref: '#/components/schemas/UserSummary'
 *         content:
 *           type: string
 *           example: What are the key pitching metrics?
 *         voteCount:
 *           type: integer
 *           example: 3
 *         votes:
 *           type: array
 *           nullable: true
 *           items:
 *             $ref: '#/components/schemas/WorkshopQuestionVote'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     WorkshopQuestionListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Get workshop questions successfully
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/WorkshopQuestion'
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *     WorkshopQuestionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Create workshop question successfully
 *         data:
 *           $ref: '#/components/schemas/WorkshopQuestion'
 *         pagination:
 *           nullable: true
 *           example: null
 *     CreateWorkshopRatingRequest:
 *       type: object
 *       required: [rating]
 *       properties:
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *     WorkshopRating:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b701
 *         workshopId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b501
 *         author:
 *           $ref: '#/components/schemas/UserSummary'
 *         rating:
 *           type: integer
 *           example: 5
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     WorkshopRatingStats:
 *       type: object
 *       properties:
 *         averageRating:
 *           type: number
 *           format: float
 *           example: 4.5
 *         totalRatings:
 *           type: integer
 *           example: 12
 *     WorkshopRatingListData:
 *       type: object
 *       properties:
 *         ratings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/WorkshopRating'
 *         stats:
 *           $ref: '#/components/schemas/WorkshopRatingStats'
 *     WorkshopRatingListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Get workshop ratings successfully
 *         data:
 *           $ref: '#/components/schemas/WorkshopRatingListData'
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *     WorkshopRatingResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Create workshop rating successfully
 *         data:
 *           $ref: '#/components/schemas/WorkshopRating'
 *         pagination:
 *           nullable: true
 *           example: null
 *     CreateWorkshopFeedbackRequest:
 *       type: object
 *       required: [comment]
 *       properties:
 *         comment:
 *           type: string
 *           minLength: 2
 *           maxLength: 2000
 *           example: Great session with actionable tips.
 *     WorkshopFeedback:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b801
 *         workshopId:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b501
 *         author:
 *           $ref: '#/components/schemas/UserSummary'
 *         comment:
 *           type: string
 *           example: Great session with actionable tips.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     WorkshopFeedbackListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Get workshop feedback successfully
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/WorkshopFeedback'
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *     WorkshopFeedbackResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Create workshop feedback successfully
 *         data:
 *           $ref: '#/components/schemas/WorkshopFeedback'
 *         pagination:
 *           nullable: true
 *           example: null
 */

router.use(authorizationMiddleware)

/**
 * @swagger
 * /api/workshops:
 *   get:
 *     summary: List workshops
 *     tags: [Workshops]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: competitionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: presenterId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, LIVE, COMPLETED, CANCELLED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *     responses:
 *       200:
 *         description: Workshops retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopListResponse'
 *       403:
 *         description: Requires WORKSHOP_VIEW permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.WORKSHOP_VIEW),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.listWorkshops),
  WORKSHOP_CONTROLLER.listWorkshops
)

/**
 * @swagger
 * /api/workshops:
 *   post:
 *     summary: Create a workshop
 *     tags: [Workshops]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWorkshopRequest'
 *     responses:
 *       201:
 *         description: Workshop created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopResponse'
 *       400:
 *         description: Invalid workshop payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires WORKSHOP_CREATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  permissionMiddleware(PERMISSIONS.WORKSHOP_CREATE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.createWorkshop),
  WORKSHOP_CONTROLLER.createWorkshop
)

/**
 * @swagger
 * /api/workshops/{id}:
 *   get:
 *     summary: Get a workshop by id
 *     tags: [Workshops]
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
 *         description: Workshop retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopResponse'
 *       403:
 *         description: Requires WORKSHOP_VIEW permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.WORKSHOP_VIEW),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.getWorkshopById),
  WORKSHOP_CONTROLLER.getWorkshopById
)

/**
 * @swagger
 * /api/workshops/{id}:
 *   patch:
 *     summary: Update a workshop
 *     tags: [Workshops]
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
 *             $ref: '#/components/schemas/UpdateWorkshopRequest'
 *     responses:
 *       200:
 *         description: Workshop updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopResponse'
 *       400:
 *         description: Invalid workshop payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires WORKSHOP_UPDATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.WORKSHOP_UPDATE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.updateWorkshop),
  WORKSHOP_CONTROLLER.updateWorkshop
)

/**
 * @swagger
 * /api/workshops/{id}:
 *   delete:
 *     summary: Delete a workshop
 *     tags: [Workshops]
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
 *         description: Workshop deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopDeleteResponse'
 *       403:
 *         description: Requires WORKSHOP_DELETE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.WORKSHOP_DELETE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.getWorkshopById),
  WORKSHOP_CONTROLLER.deleteWorkshop
)

/**
 * @swagger
 * /api/workshops/{id}/google-meet:
 *   post:
 *     summary: Create a Google Meet link for a workshop
 *     tags: [Workshops]
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
 *             $ref: '#/components/schemas/CreateGoogleMeetRequest'
 *     responses:
 *       200:
 *         description: Google Meet link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GoogleMeetResponse'
 *       400:
 *         description: Invalid request or workshop timing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires WORKSHOP_MEET_CREATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop or organizer user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/google-meet',
  permissionMiddleware(PERMISSIONS.WORKSHOP_MEET_CREATE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.createGoogleMeet),
  WORKSHOP_CONTROLLER.createGoogleMeet
)

/**
 * @swagger
 * /api/workshops/{id}/questions:
 *   post:
 *     summary: Submit a workshop question
 *     tags: [Workshops]
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
 *             $ref: '#/components/schemas/CreateWorkshopQuestionRequest'
 *     responses:
 *       201:
 *         description: Question created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopQuestionResponse'
 *       400:
 *         description: Invalid payload or workshop not accepting questions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires WORKSHOP_QUESTION_CREATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/questions',
  permissionMiddleware(PERMISSIONS.WORKSHOP_QUESTION_CREATE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.createQuestion),
  WORKSHOP_CONTROLLER.createQuestion
)

/**
 * @swagger
 * /api/workshops/{id}/questions:
 *   get:
 *     summary: List workshop questions
 *     tags: [Workshops]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Workshop questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopQuestionListResponse'
 *       403:
 *         description: Requires WORKSHOP_QUESTION_VIEW permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id/questions',
  validationHandlingMiddleware(WORKSHOP_VALIDATION.listQuestions),
  WORKSHOP_CONTROLLER.listQuestions
)

/**
 * @swagger
 * /api/workshops/questions/{questionId}/vote:
 *   post:
 *     summary: Vote for a workshop question
 *     tags: [Workshops]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *     responses:
 *       200:
 *         description: Question voted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopQuestionResponse'
 *       404:
 *         description: Workshop question not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Already voted for this question
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/questions/:questionId/vote',
  permissionMiddleware(PERMISSIONS.WORKSHOP_QUESTION_VOTE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.voteQuestion),
  WORKSHOP_CONTROLLER.voteQuestion
)

/**
 * @swagger
 * /api/workshops/{id}/ratings:
 *   post:
 *     summary: Submit a workshop rating
 *     tags: [Workshops]
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
 *             $ref: '#/components/schemas/CreateWorkshopRatingRequest'
 *     responses:
 *       201:
 *         description: Rating created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopRatingResponse'
 *       400:
 *         description: Workshop is not accepting ratings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires WORKSHOP_RATING_CREATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Already rated this workshop
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/ratings',
  permissionMiddleware(PERMISSIONS.WORKSHOP_RATING_CREATE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.createRating),
  WORKSHOP_CONTROLLER.createRating
)

router.get(
  '/:id/ratings/stats',
  validationHandlingMiddleware(WORKSHOP_VALIDATION.getRatingStats),
  WORKSHOP_CONTROLLER.getRatingStats
)

/**
 * @swagger
 * /api/workshops/{id}/ratings:
 *   get:
 *     summary: List workshop ratings
 *     tags: [Workshops]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Workshop ratings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopRatingListResponse'
 *       403:
 *         description: Requires WORKSHOP_RATING_VIEW permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id/ratings',
  validationHandlingMiddleware(WORKSHOP_VALIDATION.listRatings),
  WORKSHOP_CONTROLLER.listRatings
)

/**
 * @swagger
 * /api/workshops/{id}/feedback:
 *   post:
 *     summary: Submit workshop feedback
 *     tags: [Workshops]
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
 *             $ref: '#/components/schemas/CreateWorkshopFeedbackRequest'
 *     responses:
 *       201:
 *         description: Feedback created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopFeedbackResponse'
 *       400:
 *         description: Workshop is not accepting feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires WORKSHOP_FEEDBACK_CREATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Already submitted feedback for this workshop
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/feedback',
  permissionMiddleware(PERMISSIONS.WORKSHOP_FEEDBACK_CREATE),
  validationHandlingMiddleware(WORKSHOP_VALIDATION.createFeedback),
  WORKSHOP_CONTROLLER.createFeedback
)

/**
 * @swagger
 * /api/workshops/{id}/feedback:
 *   get:
 *     summary: List workshop feedback
 *     tags: [Workshops]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Workshop feedback retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkshopFeedbackListResponse'
 *       403:
 *         description: Requires WORKSHOP_FEEDBACK_VIEW permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id/feedback',
  validationHandlingMiddleware(WORKSHOP_VALIDATION.listFeedback),
  WORKSHOP_CONTROLLER.listFeedback
)

export default router
