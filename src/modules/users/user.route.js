import { Router } from 'express'

import { USER_CONTROLLER } from './user.controller.js'
import { USER_VALIDATION } from './user.validation.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'
import { requireRoles } from '#middlewares/policiesHandlingMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User profile, approval, status, and role assignment endpoints
 *
 * components:
 *   schemas:
 *     Pagination:
 *       type: object
 *       properties:
 *         currentPage:
 *           type: integer
 *           example: 1
 *         totalPages:
 *           type: integer
 *           example: 3
 *         pageSize:
 *           type: integer
 *           example: 10
 *         totalItems:
 *           type: integer
 *           example: 25
 *     UserListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Get users successfully
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         fullName:
 *           type: string
 *           minLength: 2
 *           maxLength: 120
 *           example: Updated Name
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
 *           maxLength: 500
 *           example: I build hackathon projects.
 *     CreateUserRequest:
 *       type: object
 *       required: [email, password, fullName, roles]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: judge.new@seal.local
 *         password:
 *           type: string
 *           minLength: 8
 *           maxLength: 128
 *           example: Password123!
 *         fullName:
 *           type: string
 *           minLength: 2
 *           maxLength: 120
 *           example: New Judge
 *         roles:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             type: string
 *             enum: [ADMIN, COORDINATOR, JUDGE, MENTOR, USER]
 *           example: [JUDGE]
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
 *           default: PENDING
 *         studentType:
 *           type: string
 *           enum: [FPT, EXTERNAL]
 *           description: Required when roles includes USER
 *           example: FPT
 *         studentId:
 *           type: string
 *           description: Required when roles includes USER
 *           example: SE123456
 *         schoolName:
 *           type: string
 *           description: Required when studentType is EXTERNAL
 *           example: University of Science
 *     UpdateStatusRequest:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
 *           example: APPROVED
 *     AssignRolesRequest:
 *       type: object
 *       required: [roles]
 *       properties:
 *         roles:
 *           type: array
 *           minItems: 1
 *           uniqueItems: true
 *           items:
 *             type: string
 *             enum: [ADMIN, COORDINATOR, JUDGE, MENTOR, USER]
 *           example: [USER, JUDGE]
 */

router.use(authorizationMiddleware)

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List users
 *     tags: [Users]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search by email or full name
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 *       401:
 *         description: Missing, invalid, or expired access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires ADMIN or COORDINATOR role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(USER_VALIDATION.listUsers),
  USER_CONTROLLER.listUsers
)

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a local user account with assigned roles
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSuccessResponse'
 *       400:
 *         description: Invalid request data or unknown role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires ADMIN or COORDINATOR role
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
  '/',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(USER_VALIDATION.createUser),
  USER_CONTROLLER.createUser
)

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update the current user's profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *       401:
 *         description: Missing, invalid, or expired access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/me',
  validationHandlingMiddleware(USER_VALIDATION.updateProfile),
  USER_CONTROLLER.updateMe
)

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by id
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{24}$'
 *         example: 664c3f6a3a6d4a5f3f93b003
 *     responses:
 *       200:
 *         description: User retrieved successfully
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
 *       403:
 *         description: Requires ADMIN or COORDINATOR role
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
  '/:id',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(USER_VALIDATION.getUserById),
  USER_CONTROLLER.getUserById
)

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Update a user's status
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/UpdateStatusRequest'
 *     responses:
 *       200:
 *         description: User status updated successfully
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
 *       403:
 *         description: Requires ADMIN or COORDINATOR role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/status',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(USER_VALIDATION.updateStatus),
  USER_CONTROLLER.updateStatus
)

/**
 * @swagger
 * /api/users/{id}/approve:
 *   patch:
 *     summary: Approve a user
 *     tags: [Users]
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
 *         description: User approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSuccessResponse'
 *       403:
 *         description: Requires ADMIN or COORDINATOR role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/approve',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(USER_VALIDATION.getUserById),
  USER_CONTROLLER.approveUser
)

/**
 * @swagger
 * /api/users/{id}/reject:
 *   patch:
 *     summary: Reject a user
 *     tags: [Users]
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
 *         description: User rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSuccessResponse'
 *       403:
 *         description: Requires ADMIN or COORDINATOR role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/reject',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(USER_VALIDATION.getUserById),
  USER_CONTROLLER.rejectUser
)

/**
 * @swagger
 * /api/users/{id}/suspend:
 *   patch:
 *     summary: Suspend a user
 *     tags: [Users]
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
 *         description: User suspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSuccessResponse'
 *       403:
 *         description: Requires ADMIN or COORDINATOR role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/suspend',
  requireRoles('ADMIN', 'COORDINATOR'),
  validationHandlingMiddleware(USER_VALIDATION.getUserById),
  USER_CONTROLLER.suspendUser
)

/**
 * @swagger
 * /api/users/{id}/roles:
 *   patch:
 *     summary: Assign roles to a user
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/AssignRolesRequest'
 *     responses:
 *       200:
 *         description: Roles assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSuccessResponse'
 *       400:
 *         description: Invalid role payload or unknown role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Requires ADMIN role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/roles',
  requireRoles('ADMIN'),
  validationHandlingMiddleware(USER_VALIDATION.assignRoles),
  USER_CONTROLLER.assignRoles
)

export default router
