import { Router } from 'express'

import { PERMISSION_CONTROLLER } from './permission.controller.js'
import { PERMISSION_VALIDATION } from './permission.validation.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { authorizationMiddleware } from '#middlewares/authHandlingMiddleware.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'
import { permissionMiddleware } from '#middlewares/permission.middleware.js'

const router = Router()

router.use(authorizationMiddleware)

/**
 * @swagger
 * tags:
 *   - name: Permissions
 *     description: Permission management endpoints
 */

/**
 * @swagger
 * /api/permissions:
 *   get:
 *     summary: List all permissions
 *     tags: [Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: module
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 */
router.get(
  '/',
  permissionMiddleware(PERMISSIONS.PERMISSION_VIEW),
  validationHandlingMiddleware(PERMISSION_VALIDATION.listPermissions),
  PERMISSION_CONTROLLER.listPermissions
)

/**
 * @swagger
 * /api/permissions/grouped:
 *   get:
 *     summary: Get permissions grouped by module
 *     tags: [Permissions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Grouped permissions retrieved successfully
 */
router.get(
  '/grouped',
  permissionMiddleware(PERMISSIONS.PERMISSION_VIEW),
  PERMISSION_CONTROLLER.getGroupedPermissions
)

/**
 * @swagger
 * /api/permissions/{id}:
 *   get:
 *     summary: Get a permission by id
 *     tags: [Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission retrieved successfully
 *       404:
 *         description: Permission not found
 */
router.get(
  '/:id',
  permissionMiddleware(PERMISSIONS.PERMISSION_VIEW),
  validationHandlingMiddleware(PERMISSION_VALIDATION.getPermissionById),
  PERMISSION_CONTROLLER.getPermissionById
)

/**
 * @swagger
 * /api/permissions/{id}:
 *   patch:
 *     summary: Update a permission (name, description, module, isActive)
 *     tags: [Permissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               module: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Permission updated successfully
 */
router.patch(
  '/:id',
  permissionMiddleware(PERMISSIONS.PERMISSION_UPDATE),
  validationHandlingMiddleware(PERMISSION_VALIDATION.updatePermission),
  PERMISSION_CONTROLLER.updatePermission
)

export default router
