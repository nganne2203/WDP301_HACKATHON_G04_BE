import mongoose from 'mongoose'

import { USER_REPOSITORY } from './user.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'

const PROFILE_FIELDS = ['fullName', 'avatarUrl', 'phone', 'bio']
const ALLOWED_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']
const PARTICIPANT_ROLE = 'USER'

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
    studentType: plainUser.studentType,
    studentId: plainUser.studentId,
    schoolName: plainUser.schoolName,
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

const ensureParticipantStudentInfo = (payload = {}) => {
  if (!payload.studentType || !payload.studentId) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Participant users must include studentType and studentId'])
  }

  if (payload.studentType === 'EXTERNAL' && !payload.schoolName) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['External students must include schoolName'])
  }
}

const ensureCanCreateRoles = (actor = {}, roleNames = []) => {
  if (!actor.roles?.includes('ADMIN') && roleNames.includes('ADMIN')) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['Coordinator cannot create admin users'])
  }
}

const createUser = async (payload = {}, actor = {}) => {
  const roleNames = (payload.roles || []).map(role => String(role).toUpperCase())
  if (roleNames.length === 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['At least one role is required'])
  }

  const existingUser = await USER_REPOSITORY.findByEmail(payload.email)
  if (existingUser) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['Email already exists'])
  }

  ensureCanCreateRoles(actor, roleNames)

  const roles = await USER_REPOSITORY.findRolesByNames(roleNames)
  if (roles.length !== roleNames.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more roles do not exist'])
  }

  if (roleNames.includes(PARTICIPANT_ROLE)) {
    ensureParticipantStudentInfo(payload)
  }

  const passwordHash = await BCRYPT_UTILS.hashPassword(payload.password)
  const createdUser = await USER_REPOSITORY.create({
    email: payload.email,
    fullName: payload.fullName,
    passwordHash,
    authProvider: 'LOCAL',
    status: payload.status || 'PENDING',
    roles: roles.map(role => role._id),
    phone: payload.phone,
    bio: payload.bio,
    avatarUrl: payload.avatarUrl,
    studentType: payload.studentType,
    studentId: payload.studentId,
    schoolName: payload.studentType === 'EXTERNAL' ? payload.schoolName : undefined
  })

  const user = await USER_REPOSITORY.findById(createdUser._id)

  return normalizeUser(user)
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
  createUser,
  updateProfile,
  updateStatus,
  approveUser,
  rejectUser,
  suspendUser,
  assignRoles,
  normalizeUser,
  getRoleNames
}
