import { Router } from 'express'

import { GOOGLE_CONTROLLER } from './google.controller.js'
import { GOOGLE_VALIDATION } from './google.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Google
 *     description: Google OAuth and Calendar connection endpoints
 *
 * components:
 *   schemas:
 *     GoogleCalendarConnection:
 *       type: object
 *       properties:
 *         connected:
 *           type: boolean
 *           example: true
 *         googleId:
 *           type: string
 *           example: 10293847561029384756
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         tokenExpiryDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2026-05-27T03:20:15.000Z
 *         scope:
 *           type: array
 *           items:
 *             type: string
 *           example:
 *             - https://www.googleapis.com/auth/calendar
 *     GoogleCalendarConnectionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Connect Google Calendar successfully
 *         data:
 *           $ref: '#/components/schemas/GoogleCalendarConnection'
 *         pagination:
 *           nullable: true
 *           example: null
 */

/**
 * @swagger
 * /api/google/connect:
 *   get:
 *     summary: Start Google OAuth flow for Calendar connection
 *     tags: [Google]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth consent screen
 *         headers:
 *           Location:
 *             description: Google OAuth authorization URL
 *             schema:
 *               type: string
 *       401:
 *         description: Missing, invalid, or expired access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires GOOGLE_CONNECT permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/connect',
  authorizationMiddleware,
  permissionMiddleware(PERMISSIONS.GOOGLE_CONNECT),
  GOOGLE_CONTROLLER.redirectToGoogleConnect
)

/**
 * @swagger
 * /api/google/callback:
 *   get:
 *     summary: Google OAuth callback for Calendar connection
 *     tags: [Google]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *       - in: query
 *         name: authuser
 *         schema:
 *           type: string
 *       - in: query
 *         name: prompt
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirects to frontend callback URL when configured
 *         headers:
 *           Location:
 *             description: Frontend callback URL with success query params
 *             schema:
 *               type: string
 *       200:
 *         description: Google Calendar connected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GoogleCalendarConnectionResponse'
 *       400:
 *         description: Invalid authorization code or state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/callback',
  validationHandlingMiddleware(GOOGLE_VALIDATION.googleCallback),
  GOOGLE_CONTROLLER.googleConnectCallback
)

export default router
