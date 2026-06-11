import mongoose from 'mongoose'

import { PERMISSION_REPOSITORY } from './permission.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'

const deriveModule = (code = '') => {
  const parts = code.split('_')
  if (parts.length >= 2) return parts[0]
  return 'GENERAL'
}

const deriveName = (code = '') => {
  return code
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

const normalizePermission = (permission) => {
  if (!permission) return null
  return {
    id: permission._id?.toString() || permission.id,
    code: permission.code,
    name: permission.name || deriveName(permission.code),
    description: permission.description,
    module: permission.module || deriveModule(permission.code),
    isActive: permission.isActive !== false
  }
}

const ensureObjectId = (id, field = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${field}`])
  }
}

const ensurePermissionExists = async (id) => {
  ensureObjectId(id)
  const permission = await PERMISSION_REPOSITORY.findById(id)
  if (!permission) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Permission not found'])
  }
  return permission
}

const listPermissions = async (query = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = {}
  if (query.module) filter.module = query.module.toUpperCase()
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true
  const skip = (page - 1) * limit

  const [permissions, totalItems] = await Promise.all([
    PERMISSION_REPOSITORY.findAll({ filter, skip, limit }),
    PERMISSION_REPOSITORY.count(filter)
  ])

  return {
    permissions: permissions.map(normalizePermission),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const getGroupedPermissions = async () => {
  const permissions = await PERMISSION_REPOSITORY.findAll({ limit: 1000 })
  const grouped = {}

  for (const permission of permissions) {
    const mod = permission.module || deriveModule(permission.code)
    if (!grouped[mod]) grouped[mod] = []
    grouped[mod].push(normalizePermission(permission))
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, items]) => ({ module, permissions: items }))
}

const getPermissionById = async (id) => {
  const permission = await ensurePermissionExists(id)
  return normalizePermission(permission)
}

const updatePermission = async (id, payload = {}) => {
  await ensurePermissionExists(id)

  const allowedFields = ['name', 'description', 'module', 'isActive']
  const updateData = {}
  for (const field of allowedFields) {
    if (payload[field] !== undefined) updateData[field] = payload[field]
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['No valid fields to update'])
  }

  const updated = await PERMISSION_REPOSITORY.updateById(id, updateData)
  return normalizePermission(updated)
}

export const PERMISSION_SERVICE = {
  listPermissions,
  getGroupedPermissions,
  getPermissionById,
  updatePermission,
  normalizePermission,
  deriveModule,
  deriveName
}
