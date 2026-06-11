import mongoose from 'mongoose'

import { ROLE_REPOSITORY } from './role.repository.js'
import { PERMISSION_REPOSITORY } from '#modules/permissions/permission.repository.js'
import { PERMISSION_SERVICE } from '#modules/permissions/permission.service.js'
import { AUDIT_LOG_SERVICE } from '#modules/audit-logs/audit-log.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'

const SYSTEM_ROLE_NAMES = new Set(['ADMIN', 'COORDINATOR', 'EVENT_COORDINATOR', 'JUDGE', 'MENTOR', 'SPEAKER', 'USER', 'PARTICIPANT'])

const normalizeRole = (role) => {
  if (!role) return null
  return {
    id: role._id?.toString() || role.id,
    name: role.name,
    code: role.code || role.name,
    description: role.description,
    isSystemRole: role.isSystemRole || false,
    isActive: role.isActive !== false,
    permissions: (role.permissions || []).map(p => PERMISSION_SERVICE.normalizePermission(p)),
    permissionCount: (role.permissions || []).length,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt
  }
}

const ensureObjectId = (id, field = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${field}`])
  }
}

const ensureRoleExists = async (id) => {
  ensureObjectId(id)
  const role = await ROLE_REPOSITORY.findById(id)
  if (!role) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Role not found'])
  }
  return role
}

const ensureNotSystemRole = (role, action = 'modify') => {
  if (SYSTEM_ROLE_NAMES.has(role.name)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, [`Cannot ${action} system role "${role.name}"`])
  }
}

const listRoles = async (query = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = {}
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true
  if (query.isSystemRole !== undefined) filter.isSystemRole = query.isSystemRole === 'true' || query.isSystemRole === true
  const skip = (page - 1) * limit

  const [roles, totalItems] = await Promise.all([
    ROLE_REPOSITORY.findAll({ filter, skip, limit }),
    ROLE_REPOSITORY.count(filter)
  ])

  return {
    roles: roles.map(normalizeRole),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const getRoleById = async (id) => {
  const role = await ensureRoleExists(id)
  return normalizeRole(role)
}

const createRole = async (payload = {}, actorId = null) => {
  const name = payload.name.toUpperCase().trim()

  const existing = await ROLE_REPOSITORY.findByName(name)
  if (existing) {
    throw new ApiError(ERROR_CODES.CONFLICT, [`Role "${name}" already exists`])
  }

  let permissionIds = []
  if (payload.permissions && payload.permissions.length > 0) {
    const permissions = await PERMISSION_REPOSITORY.findByIds(payload.permissions)
    if (permissions.length !== payload.permissions.length) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more permission IDs are invalid'])
    }
    permissionIds = permissions.map(p => p._id)
  }

  const created = await ROLE_REPOSITORY.create({
    name,
    code: payload.code || name,
    description: payload.description,
    permissions: permissionIds,
    isSystemRole: false,
    isActive: true
  })

  const role = await ROLE_REPOSITORY.findById(created._id)

  if (actorId) {
    AUDIT_LOG_SERVICE.createAuditLog({
      userId: actorId,
      action: 'ROLE_CREATE',
      resourceType: 'Role',
      resourceId: role._id,
      metadata: { name, permissionCount: permissionIds.length }
    }).catch(() => {})
  }

  return normalizeRole(role)
}

const updateRole = async (id, payload = {}, actorId = null) => {
  const role = await ensureRoleExists(id)

  const allowedFields = ['description', 'isActive', 'code']
  const updateData = {}
  for (const field of allowedFields) {
    if (payload[field] !== undefined) updateData[field] = payload[field]
  }

  if (payload.name !== undefined) {
    const newName = payload.name.toUpperCase().trim()
    if (newName !== role.name) {
      ensureNotSystemRole(role, 'rename')
      const existing = await ROLE_REPOSITORY.findByName(newName)
      if (existing) {
        throw new ApiError(ERROR_CODES.CONFLICT, [`Role "${newName}" already exists`])
      }
      updateData.name = newName
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['No valid fields to update'])
  }

  const updated = await ROLE_REPOSITORY.updateById(id, updateData)

  if (actorId) {
    AUDIT_LOG_SERVICE.createAuditLog({
      userId: actorId,
      action: 'ROLE_UPDATE',
      resourceType: 'Role',
      resourceId: role._id,
      metadata: { changes: Object.keys(updateData) }
    }).catch(() => {})
  }

  return normalizeRole(updated)
}

const deleteRole = async (id, actorId = null) => {
  const role = await ensureRoleExists(id)
  ensureNotSystemRole(role, 'delete')

  await ROLE_REPOSITORY.softDeleteById(id)

  if (actorId) {
    AUDIT_LOG_SERVICE.createAuditLog({
      userId: actorId,
      action: 'ROLE_DELETE',
      resourceType: 'Role',
      resourceId: role._id,
      metadata: { name: role.name }
    }).catch(() => {})
  }

  return { id, name: role.name, deleted: true }
}

const getRolePermissions = async (id) => {
  const role = await ensureRoleExists(id)
  return {
    roleId: id,
    roleName: role.name,
    permissions: (role.permissions || []).map(p => PERMISSION_SERVICE.normalizePermission(p))
  }
}

const setRolePermissions = async (id, permissionIds = [], actorId = null) => {
  const role = await ensureRoleExists(id)

  const permissions = await PERMISSION_REPOSITORY.findByIds(permissionIds)
  if (permissions.length !== permissionIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more permission IDs are invalid'])
  }

  const before = (role.permissions || []).map(p => (p._id || p).toString())
  const updated = await ROLE_REPOSITORY.updateById(id, { permissions: permissions.map(p => p._id) })

  if (actorId) {
    AUDIT_LOG_SERVICE.createAuditLog({
      userId: actorId,
      action: 'ROLE_ASSIGN_PERMISSION',
      resourceType: 'Role',
      resourceId: role._id,
      metadata: {
        roleName: role.name,
        before,
        after: permissions.map(p => p._id.toString()),
        action: 'SET'
      }
    }).catch(() => {})
  }

  return {
    roleId: id,
    roleName: updated.name,
    permissions: (updated.permissions || []).map(p => PERMISSION_SERVICE.normalizePermission(p))
  }
}

const addPermissionsToRole = async (id, permissionIds = [], actorId = null) => {
  const role = await ensureRoleExists(id)

  const permissions = await PERMISSION_REPOSITORY.findByIds(permissionIds)
  if (permissions.length !== permissionIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more permission IDs are invalid'])
  }

  const existingIds = new Set((role.permissions || []).map(p => (p._id || p).toString()))
  const newIds = permissions.map(p => p._id).filter(pid => !existingIds.has(pid.toString()))

  const allIds = [
    ...(role.permissions || []).map(p => p._id || p),
    ...newIds
  ]

  const updated = await ROLE_REPOSITORY.updateById(id, { permissions: allIds })

  if (actorId) {
    AUDIT_LOG_SERVICE.createAuditLog({
      userId: actorId,
      action: 'ROLE_ASSIGN_PERMISSION',
      resourceType: 'Role',
      resourceId: role._id,
      metadata: { roleName: role.name, added: newIds.map(i => i.toString()), action: 'ADD' }
    }).catch(() => {})
  }

  return {
    roleId: id,
    roleName: updated.name,
    permissions: (updated.permissions || []).map(p => PERMISSION_SERVICE.normalizePermission(p))
  }
}

const removePermissionFromRole = async (id, permissionId, actorId = null) => {
  ensureObjectId(permissionId, 'permissionId')
  const role = await ensureRoleExists(id)

  const existingIds = (role.permissions || []).map(p => (p._id || p).toString())
  const filtered = existingIds.filter(pid => pid !== permissionId)

  if (filtered.length === existingIds.length) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Permission not found in this role'])
  }

  const updated = await ROLE_REPOSITORY.updateById(id, { permissions: filtered })

  if (actorId) {
    AUDIT_LOG_SERVICE.createAuditLog({
      userId: actorId,
      action: 'ROLE_ASSIGN_PERMISSION',
      resourceType: 'Role',
      resourceId: role._id,
      metadata: { roleName: role.name, removed: permissionId, action: 'REMOVE' }
    }).catch(() => {})
  }

  return {
    roleId: id,
    roleName: updated.name,
    permissions: (updated.permissions || []).map(p => PERMISSION_SERVICE.normalizePermission(p))
  }
}

export const ROLE_SERVICE = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
  addPermissionsToRole,
  removePermissionFromRole,
  normalizeRole
}
