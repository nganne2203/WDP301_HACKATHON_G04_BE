import { Router } from 'express'

import { AUTH_CONTROLLER } from './auth.controller.js'
import { AUTH_VALIDATION } from './auth.validation.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { authRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and session endpoints
 *
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         code:
 *           type: string
 *           example: VALIDATION_ERROR
 *         message:
 *           type: string
 *           example: Có lỗi xác thực trong yêu cầu.
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *           example:
 *             - Email or password is incorrect
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b001
 *         code:
 *           type: string
 *           example: USER_VIEW
 *         description:
 *           type: string
 *           example: View users
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b002
 *         name:
 *           type: string
 *           example: USER
 *         description:
 *           type: string
 *           example: Basic authenticated user
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Permission'
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 664c3f6a3a6d4a5f3f93b003
 *         email:
 *           type: string
 *           format: email
 *           example: participant@seal.local
 *         authProvider:
 *           type: string
 *           enum: [GOOGLE, LOCAL]
 *           example: LOCAL
 *         fullName:
 *           type: string
 *           example: Participant User
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
 *           example: APPROVED
 *         roles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Role'
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           example: [EVENT_VIEW, WORKSHOP_VIEW, TEAM_VIEW]
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *           example: https://example.com/avatar.png
 *         phone:
 *           type: string
 *           nullable: true
 *           example: '+84901234567'
 *         bio:
 *           type: string
 *           nullable: true
 *           example: Full-stack developer
 *         githubUsername:
 *           type: string
 *           nullable: true
 *           example: octocat
 *         studentType:
 *           type: string
 *           nullable: true
 *           enum: [FPT, EXTERNAL]
 *           example: FPT
 *         studentId:
 *           type: string
 *           nullable: true
 *           example: SE123456
 *         schoolName:
 *           type: string
 *           nullable: true
 *           example: FPT University
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     TokenPair:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     AuthData:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         tokens:
 *           $ref: '#/components/schemas/TokenPair'
 *     AuthSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Login successfully
 *         data:
 *           $ref: '#/components/schemas/AuthData'
 *         pagination:
 *           nullable: true
 *           example: null
 *     UserSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Get current user successfully
 *         data:
 *           $ref: '#/components/schemas/User'
 *         pagination:
 *           nullable: true
 *           example: null
 *     RegisterRequest:
 *       type: object
 *       required: [email, password, fullName, githubUsername, studentType, studentId]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: new.user@seal.local
 *         password:
 *           type: string
 *           minLength: 8
 *           maxLength: 128
 *           example: Password123!
 *         fullName:
 *           type: string
 *           minLength: 2
 *           maxLength: 120
 *           example: New User
 *         githubUsername:
 *           type: string
 *           minLength: 1
 *           maxLength: 39
 *           pattern: '^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$'
 *           example: octocat
 *         studentType:
 *           type: string
 *           enum: [FPT, EXTERNAL]
 *           description: FPT for FPT students, EXTERNAL for students from another school
 *           example: FPT
 *         studentId:
 *           type: string
 *           description: FPT student code or external school student code
 *           example: SE123456
 *         schoolName:
 *           type: string
 *           description: Required when studentType is EXTERNAL
 *           example: University of Science
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: admin@seal.local
 *         password:
 *           type: string
 *           example: Password123!
 *     GoogleLoginRequest:
 *       type: object
 *       required: [googleId, email, name, avatar]
 *       properties:
 *         googleId:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         name:
 *           type: string
 *         avatar:
 *           type: string
 *           format: uri
 *           nullable: true
 *     GoogleRegisterRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/GoogleLoginRequest'
 *         - type: object
 *           required: [githubUsername]
 *           properties:
 *             githubUsername:
 *               type: string
 *               minLength: 1
 *               maxLength: 39
 *               pattern: '^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$'
 *     RefreshTokenRequest:
 *       type: object
 *       required: [refreshToken]
 *       properties:
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a local user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Account created and pending approval
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSuccessResponse'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/register',
  authRateLimiter,
  validationHandlingMiddleware(AUTH_VALIDATION.register),
  AUTH_CONTROLLER.register
)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account is not approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/login',
  authRateLimiter,
  validationHandlingMiddleware(AUTH_VALIDATION.login),
  AUTH_CONTROLLER.login
)

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Login to an existing approved account with a Google profile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoogleLoginRequest'
 *     responses:
 *       200:
 *         description: Google login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 */
router.post(
  '/google',
  authRateLimiter,
  validationHandlingMiddleware(AUTH_VALIDATION.googleLogin),
  AUTH_CONTROLLER.googleLogin
)

/**
 * @swagger
 * /api/auth/google/register:
 *   post:
 *     summary: Register a participant with a Google profile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoogleRegisterRequest'
 *     responses:
 *       201:
 *         description: Account created and pending approval
 */
router.post(
  '/google/register',
  authRateLimiter,
  validationHandlingMiddleware(AUTH_VALIDATION.googleRegister),
  AUTH_CONTROLLER.googleRegister
)

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Issue a new token pair from a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refresh successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/refresh-token',
  authRateLimiter,
  validationHandlingMiddleware(AUTH_VALIDATION.refreshToken),
  AUTH_CONTROLLER.refreshToken
)

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the current authenticated user
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSuccessResponse'
 *       401:
 *         description: Missing, invalid, or expired access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', authorizationMiddleware, AUTH_CONTROLLER.getMe)

router.post(
  '/change-password',
  authorizationMiddleware,
  validationHandlingMiddleware(AUTH_VALIDATION.changePassword),
  AUTH_CONTROLLER.changePassword
)

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout the current user
 *     description: Stateless JWT logout endpoint. Clients should remove stored tokens after this call.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *                 pagination:
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Missing, invalid, or expired access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authorizationMiddleware, AUTH_CONTROLLER.logout)

export default router
