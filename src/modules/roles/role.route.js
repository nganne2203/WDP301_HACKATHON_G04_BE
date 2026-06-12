import { Router } from 'express'

import { ROLE_CONTROLLER } from './role.controller.js'
import { ROLE_VALIDATION } from './role.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'

const router = Router()

router.use(authorizationMiddleware)

/**
 * @swagger
 * tags:
 *   - name: Roles
 *     description: Role management and permission assignment endpoints
 */

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: List all roles
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.ROLE_VIEW),
  validationHandlingMiddleware(ROLE_VALIDATION.listRoles),
  ROLE_CONTROLLER.listRoles
)

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Role created successfully
 */
router.post(
  '/',
  permissionMiddleware(PERMISSIONS.ROLE_CREATE),
  validationHandlingMiddleware(ROLE_VALIDATION.createRole),
  ROLE_CONTROLLER.createRole
)

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get a role by id
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.ROLE_VIEW),
  validationHandlingMiddleware(ROLE_VALIDATION.getRoleById),
  ROLE_CONTROLLER.getRoleById
)

/**
 * @swagger
 * /api/roles/{id}:
 *   patch:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role updated successfully
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.ROLE_UPDATE),
  validationHandlingMiddleware(ROLE_VALIDATION.updateRole),
  ROLE_CONTROLLER.updateRole
)

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Soft-delete a role (cannot delete system roles)
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role deleted successfully
 */
router.delete(
  '/:id',
  permissionMiddleware(PERMISSIONS.ROLE_DELETE),
  validationHandlingMiddleware(ROLE_VALIDATION.deleteRole),
  ROLE_CONTROLLER.deleteRole
)

/**
 * @swagger
 * /api/roles/{id}/permissions:
 *   get:
 *     summary: Get all permissions assigned to a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role permissions retrieved successfully
 */
router.get(
  '/:id/permissions',
  permissionMiddleware(PERMISSIONS.ROLE_VIEW),
  validationHandlingMiddleware(ROLE_VALIDATION.getRoleById),
  ROLE_CONTROLLER.getRolePermissions
)

/**
 * @swagger
 * /api/roles/{id}/permissions:
 *   put:
 *     summary: Replace all permissions on a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions replaced successfully
 */
router.put(
  '/:id/permissions',
  permissionMiddleware(PERMISSIONS.ROLE_ASSIGN_PERMISSION),
  validationHandlingMiddleware(ROLE_VALIDATION.setPermissions),
  ROLE_CONTROLLER.setRolePermissions
)

/**
 * @swagger
 * /api/roles/{id}/permissions:
 *   post:
 *     summary: Add permissions to a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions added successfully
 */
router.post(
  '/:id/permissions',
  permissionMiddleware(PERMISSIONS.ROLE_ASSIGN_PERMISSION),
  validationHandlingMiddleware(ROLE_VALIDATION.addPermissions),
  ROLE_CONTROLLER.addPermissionsToRole
)

/**
 * @swagger
 * /api/roles/{id}/permissions/{permissionId}:
 *   delete:
 *     summary: Remove a permission from a role
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission removed successfully
 */
router.delete(
  '/:id/permissions/:permissionId',
  permissionMiddleware(PERMISSIONS.ROLE_ASSIGN_PERMISSION),
  validationHandlingMiddleware(ROLE_VALIDATION.removePermission),
  ROLE_CONTROLLER.removePermissionFromRole
)

export default router
