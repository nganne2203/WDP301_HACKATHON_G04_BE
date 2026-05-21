import mongoose from 'mongoose'

import { USER_REPOSITORY } from './user.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { normalizePaginationQuery } from '#utils/pagination.js'

const PROFILE_FIELDS = ['fullName', 'avatarUrl', 'phone', 'bio']
const ALLOWED_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']

const buildUserFilter = (query = {}) => {
  const filter = {}

  if (query.status) {
    filter.status = query.status
  }

  if (query.search) {
    const pattern = new RegExp(query.search, 'i')
    filter.$or = [
      { email: pattern },
      { fullName: pattern }
    ]
  }

  return filter
}

const normalizeUser = (user) => {
  if (!user) return null

  const plainUser = typeof user.toObject === 'function'
    ? user.toObject({ getters: true, virtuals: false })
    : user

  const roles = (plainUser.roles || []).map(role => {
    if (typeof role === 'string' || role instanceof mongoose.Types.ObjectId) {
      return { id: role.toString() }
    }

    return {
      id: role._id?.toString(),
      name: role.name,
      description: role.description,
      permissions: (role.permissions || []).map(permission => {
        if (typeof permission === 'string' || permission instanceof mongoose.Types.ObjectId) {
          return { id: permission.toString() }
        }

        return {
          id: permission._id?.toString(),
          code: permission.code,
          description: permission.description
        }
      })
    }
  })

  return {
    id: plainUser._id?.toString() || plainUser.id,
    email: plainUser.email,
    authProvider: plainUser.authProvider,
    fullName: plainUser.fullName,
    status: plainUser.status,
    roles,
    avatarUrl: plainUser.avatarUrl,
    phone: plainUser.phone,
    bio: plainUser.bio,
    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt
  }
}

const getRoleNames = (user) => {
  return (user?.roles || [])
    .map(role => role.name || role)
    .filter(Boolean)
}

const ensureObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid user id'])
  }
}

const ensureUserExists = async (id) => {
  ensureObjectId(id)

  const user = await USER_REPOSITORY.findById(id)
  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['User not found'])
  }

  return user
}

const listUsers = async (query = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = buildUserFilter(query)
  const skip = (page - 1) * limit

  const [users, totalItems] = await Promise.all([
    USER_REPOSITORY.findAll({ filter, skip, limit }),
    USER_REPOSITORY.count(filter)
  ])

  return {
    users: users.map(normalizeUser),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const getUserById = async (id) => {
  const user = await ensureUserExists(id)
  return normalizeUser(user)
}

const getRawUserById = async (id) => {
  return await ensureUserExists(id)
}

const getUserByEmail = async (email) => {
  return await USER_REPOSITORY.findByEmail(email)
}

const updateProfile = async (id, payload = {}) => {
  await ensureUserExists(id)

  const safePayload = pickSafeFields(payload, PROFILE_FIELDS)
  const updatedUser = await USER_REPOSITORY.updateById(id, safePayload)

  return normalizeUser(updatedUser)
}

const updateStatus = async (id, status) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid user status'])
  }

  await ensureUserExists(id)
  const updatedUser = await USER_REPOSITORY.updateById(id, { status })

  return normalizeUser(updatedUser)
}

const approveUser = async (id) => {
  return await updateStatus(id, 'APPROVED')
}

const rejectUser = async (id) => {
  return await updateStatus(id, 'REJECTED')
}

const suspendUser = async (id) => {
  return await updateStatus(id, 'SUSPENDED')
}

const assignRoles = async (id, roleNames = []) => {
  await ensureUserExists(id)

  const roles = await USER_REPOSITORY.findRolesByNames(roleNames)
  if (roles.length !== roleNames.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more roles do not exist'])
  }

  const updatedUser = await USER_REPOSITORY.updateById(id, {
    roles: roles.map(role => role._id)
  })

  return normalizeUser(updatedUser)
}

export const USER_SERVICE = {
  listUsers,
  getUserById,
  getRawUserById,
  getUserByEmail,
  updateProfile,
  updateStatus,
  approveUser,
  rejectUser,
  suspendUser,
  assignRoles,
  normalizeUser,
  getRoleNames
}
