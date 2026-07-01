import { Router } from 'express'

import { USER_CONTROLLER } from './user.controller.js'
import { USER_VALIDATION } from './user.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'

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
 *         githubUsername:
 *           type: string
 *           nullable: true
 *           minLength: 1
 *           maxLength: 39
 *           pattern: '^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$'
 *           example: octocat
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
 *             enum: [ADMIN, EVENT_COORDINATOR, COORDINATOR, JUDGE, MENTOR, SPEAKER, PARTICIPANT]
 *           example: [JUDGE]
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, ACTIVE, REJECTED, SUSPENDED]
 *           default: PENDING
 *         githubUsername:
 *           type: string
 *           nullable: true
 *           minLength: 1
 *           maxLength: 39
 *           pattern: '^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$'
 *           example: octocat
 *         studentType:
 *           type: string
 *           enum: [FPT, EXTERNAL]
 *           description: Required when roles includes PARTICIPANT
 *           example: FPT
 *         studentId:
 *           type: string
 *           description: Required when roles includes PARTICIPANT
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
 *           enum: [PENDING, APPROVED, ACTIVE, REJECTED, SUSPENDED]
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
 *             enum: [ADMIN, EVENT_COORDINATOR, COORDINATOR, JUDGE, MENTOR, SPEAKER, PARTICIPANT]
 *           example: [PARTICIPANT, JUDGE]
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
 *           enum: [PENDING, APPROVED, ACTIVE, REJECTED, SUSPENDED]
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
 *         description: Requires USER_VIEW permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.USER_VIEW),
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
 *         description: Requires USER_CREATE permission
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
  permissionMiddleware(PERMISSIONS.USER_CREATE),
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
 *         description: Requires USER_VIEW permission
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
  permissionMiddleware(PERMISSIONS.USER_VIEW),
  validationHandlingMiddleware(USER_VALIDATION.getUserById),
  USER_CONTROLLER.getUserById
)

router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.USER_UPDATE),
  validationHandlingMiddleware(USER_VALIDATION.updateUser),
  USER_CONTROLLER.updateUser
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
 *         description: Requires USER_UPDATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/status',
  permissionMiddleware(PERMISSIONS.USER_UPDATE),
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
 *         description: Requires PARTICIPANT_APPROVE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/approve',
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
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
 *         description: Requires USER_UPDATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/reject',
  permissionMiddleware(PERMISSIONS.USER_UPDATE),
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
 *         description: Requires USER_UPDATE permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/suspend',
  permissionMiddleware(PERMISSIONS.USER_UPDATE),
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
 *         description: Requires USER_ROLE_ASSIGN permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  '/:id/roles',
  permissionMiddleware(PERMISSIONS.USER_ROLE_ASSIGN),
  validationHandlingMiddleware(USER_VALIDATION.assignRoles),
  USER_CONTROLLER.assignRoles
)

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     summary: Assign roles to a user by role IDs (replaces existing)
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
 *             type: object
 *             required: [roleIds]
 *             properties:
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["664c3f6a3a6d4a5f3f93b002"]
 *     responses:
 *       200:
 *         description: Roles assigned successfully
 *       400:
 *         description: Invalid role IDs
 *       403:
 *         description: Requires USER_ASSIGN_ROLE permission
 */
router.patch(
  '/:id/role',
  permissionMiddleware(PERMISSIONS.USER_ASSIGN_ROLE),
  validationHandlingMiddleware(USER_VALIDATION.assignRolesByIds),
  USER_CONTROLLER.assignRolesByIds
)

/**
 * @swagger
 * /api/users/{id}/effective-permissions:
 *   get:
 *     summary: Get a user's effective permissions (resolved from all assigned roles)
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
 *         description: Effective permissions retrieved successfully
 *       403:
 *         description: Requires USER_VIEW permission
 */
router.get(
  '/:id/effective-permissions',
  permissionMiddleware(PERMISSIONS.USER_VIEW),
  validationHandlingMiddleware(USER_VALIDATION.getUserById),
  USER_CONTROLLER.getEffectivePermissions
)

export default router
