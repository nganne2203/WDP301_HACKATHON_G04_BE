import mongoose from 'mongoose'

import { USER_REPOSITORY } from './user.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'
import { EMAIL_SERVICE } from '#modules/notifications/email.service.js'
import { EMAIL_TEMPLATE_KEYS } from '#modules/notifications/email-templates.js'
import { AUDIT_LOG_SERVICE } from '#modules/audit-logs/audit-log.service.js'
import { MEDIA_SERVICE } from '#modules/media/media.service.js'
import { env } from '#configs/environment.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import {
  REGISTRATION_SOURCES,
  getRegistrationSource
} from '#utils/userAccountUtil.js'
import { migrateLegacyUserRoleNames, REMOVED_USER_ROLE_NAME, requiresParticipantProfile } from '#utils/userRoleMigrationUtil.js'

const PROFILE_FIELDS = ['fullName', 'avatarUrl', 'phone', 'bio', 'githubUsername']
const USER_UPDATE_FIELDS = ['email', 'fullName', 'avatarUrl', 'phone', 'bio', 'githubUsername', 'studentType', 'studentId', 'schoolName']
const ALLOWED_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED']
const EMAIL_NOTIFICATION_STATUSES = ['ACTIVE', 'REJECTED']
const ROLE_ASSIGN_PERMISSIONS = ['USER_ROLE_ASSIGN', 'USER_ASSIGN_ROLE']

const getId = (value) => value?._id?.toString?.() || value?.id || value?.toString?.()

const getLoginUrl = () => {
  const frontendUrl = env.client.frontendUrl || env.client.urls[0]
  if (!frontendUrl) return null

  return new URL('/login', frontendUrl).toString()
}

const buildStatusNotification = (status) => {
  if (status === 'ACTIVE') {
    return {
      title: 'Account activated',
      message: 'Your SEAL Hackathon account is now active.',
      emailTemplate: EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED,
      emailContext: {
        loginUrl: getLoginUrl()
      }
    }
  }

  return {
    title: 'Account registration not approved',
    message: 'Your SEAL Hackathon account registration was not approved.',
    emailTemplate: EMAIL_TEMPLATE_KEYS.ACCOUNT_REJECTED,
    emailContext: {}
  }
}

const buildUserFilter = (query = {}) => {
  const filter = {}

  if (query.status) {
    filter.status = query.status
  }

  if (query.search) {
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) {
      filter.$or = [
        { email: pattern },
        { fullName: pattern }
      ]
    }
  }

  return filter
}

const normalizeRoleQuery = (roles) => {
  if (!roles) return []
  const values = Array.isArray(roles) ? roles : String(roles).split(',')
  return migrateLegacyUserRoleNames(values.map(role => String(role).trim().toUpperCase()).filter(Boolean))
}

const cloneNormalizedRole = (role, normalizedName) => {
  if (typeof role === 'string' || role instanceof mongoose.Types.ObjectId) {
    return normalizedName
  }

  const plainRole = typeof role?.toObject === 'function'
    ? role.toObject({ getters: true, virtuals: false })
    : role

  return {
    ...plainRole,
    name: normalizedName,
    code: normalizedName
  }
}

const getNormalizedRoles = (user = {}) => {
  const roles = Array.isArray(user?.roles) ? user.roles : []
  if (roles.length === 0) return []

  const normalizedRoleNames = migrateLegacyUserRoleNames(
    roles.map(role => String(role?.name || role?.code || role).trim().toUpperCase()).filter(Boolean)
  )

  return normalizedRoleNames.map((normalizedRoleName) => {
    const matchingRole = roles.find((role) => {
      const currentRoleName = String(role?.name || role?.code || role).trim().toUpperCase()
      if (currentRoleName === normalizedRoleName) return true
      return normalizedRoleName === 'PARTICIPANT' && currentRoleName === 'USER'
    })

    return cloneNormalizedRole(matchingRole, normalizedRoleName)
  }).filter(Boolean)
}

const normalizeUser = (user) => {
  if (!user) return null

  const plainUser = typeof user.toObject === 'function'
    ? user.toObject({ getters: true, virtuals: false })
    : user

  const roles = getNormalizedRoles(plainUser).map(role => {
    if (typeof role === 'string' || role instanceof mongoose.Types.ObjectId) {
      return { id: role.toString() }
    }

    return {
      id: role._id?.toString(),
      name: role.name,
      code: role.code || role.name,
      description: role.description,
      isSystemRole: role.isSystemRole || false,
      permissions: (role.permissions || []).map(permission => {
        if (typeof permission === 'string' || permission instanceof mongoose.Types.ObjectId) {
          return { id: permission.toString() }
        }

        return {
          id: permission._id?.toString(),
          code: permission.code,
          name: permission.name,
          description: permission.description,
          module: permission.module
        }
      })
    }
  })
  const effectivePermissions = getPermissionCodes({ roles })

  return {
    id: plainUser._id?.toString() || plainUser.id,
    email: plainUser.email,
    authProvider: plainUser.authProvider,
    registrationSource: getRegistrationSource(plainUser),
    fullName: plainUser.fullName,
    status: plainUser.status,
    mustChangePassword: Boolean(plainUser.mustChangePassword),
    roles,
    permissions: effectivePermissions,
    effectivePermissions,
    googleAuth: plainUser.googleAuth
      ? {
        googleId: plainUser.googleAuth.googleId,
        email: plainUser.googleAuth.email,
        name: plainUser.googleAuth.name,
        picture: plainUser.googleAuth.picture
      }
      : undefined,
    googleCalendar: plainUser.googleCalendar
      ? {
        connected: Boolean(plainUser.googleCalendar.connected),
        googleId: plainUser.googleCalendar.googleId,
        email: plainUser.googleCalendar.email,
        tokenExpiryDate: plainUser.googleCalendar.tokenExpiryDate,
        scope: plainUser.googleCalendar.scope || []
      }
      : undefined,
    avatarUrl: plainUser.avatarUrl,
    phone: plainUser.phone,
    bio: plainUser.bio,
    githubUsername: plainUser.githubUsername,
    studentType: plainUser.studentType,
    studentId: plainUser.studentId,
    schoolName: plainUser.schoolName,
    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt
  }
}

const getRoleNames = (user) => {
  return getNormalizedRoles(user)
    .map(role => role.name || role)
    .filter(Boolean)
}

const getPermissionCodes = (user) => {
  const directPermissions = user?.permissions || []
  const activeRoles = getNormalizedRoles(user).filter(role => {
    if (typeof role === 'string' || role instanceof mongoose.Types.ObjectId) return true
    return role.isActive !== false
  })
  const rolePermissions = activeRoles.flatMap(role => role.permissions || [])

  const permissionCodes = [...directPermissions, ...rolePermissions]
    .map(permission => {
      if (typeof permission === 'string') return permission
      if (permission.isActive === false) return null
      return permission.code
    })
    .filter(Boolean)

  return [...new Set(permissionCodes)]
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

const normalizeOptionalProfileValue = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = String(value).trim()
  return trimmed || null
}

const ensureGithubUsernameCanBeChanged = async (userId, existingGithubUsername, nextGithubUsername) => {
  const currentValue = normalizeOptionalProfileValue(existingGithubUsername)
  const nextValue = normalizeOptionalProfileValue(nextGithubUsername)
  if (currentValue === nextValue) return

  const blockingParticipant = await USER_REPOSITORY.findStartedJoinedParticipantByUserId(userId)
  if (!blockingParticipant) return

  const eventTitle = blockingParticipant.eventId?.title || 'a started event'
  throw new ApiError(ERROR_CODES.FORBIDDEN, [
    `GitHub username cannot be changed after joining ${eventTitle} because the event has already started`
  ])
}

const ensureGithubUsernameIsUnique = async (githubUsername, excludeUserId = null) => {
  const username = normalizeOptionalProfileValue(githubUsername)
  if (!username) return

  const existingUser = await USER_REPOSITORY.findByGithubUsername(username)
  if (existingUser && (!excludeUserId || getId(existingUser) !== String(excludeUserId))) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['GitHub username is already used by another account'])
  }
}

const listUsers = async (query = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = buildUserFilter(query)
  const skip = (page - 1) * limit

  const roleNames = normalizeRoleQuery(query.roles)
  if (roleNames.length > 0) {
    const roles = await USER_REPOSITORY.findRolesByNames(roleNames)
    filter.roles = { $in: roles.map(role => role._id) }
  }

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
  if (!roleNames.includes('ADMIN')) {
    return
  }

  const actorPermissions = actor.permissions || []
  if (!actorPermissions.includes(PERMISSIONS.USER_ROLE_ASSIGN)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only users with role assignment permission can create admin users'])
  }
}

const ensureCanAssignRoles = (actor = {}) => {
  const actorPermissions = actor.permissions || []
  if (!ROLE_ASSIGN_PERMISSIONS.some(permission => actorPermissions.includes(permission))) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['You do not have permission to update user roles'])
  }
}

const ensureRemovedUserRoleIsNotRequested = (roleNames = []) => {
  if (roleNames.includes(REMOVED_USER_ROLE_NAME)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['The USER role has been removed. Use PARTICIPANT instead.'])
  }
}

const createUser = async (payload = {}, actor = {}) => {
  const roleNames = (payload.roles || []).map(role => String(role).toUpperCase())
  ensureRemovedUserRoleIsNotRequested(roleNames)
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

  if (requiresParticipantProfile(roleNames)) {
    ensureParticipantStudentInfo(payload)
  }

  await ensureGithubUsernameIsUnique(payload.githubUsername)

  const passwordHash = await BCRYPT_UTILS.hashPassword(payload.password)
  const createdUser = await USER_REPOSITORY.create({
    email: payload.email,
    fullName: payload.fullName,
    passwordHash,
    mustChangePassword: true,
    authProvider: 'LOCAL',
    registrationSource: REGISTRATION_SOURCES.FORM,
    status: payload.status || 'ACTIVE',
    roles: roles.map(role => role._id),
    phone: payload.phone,
    bio: payload.bio,
    githubUsername: payload.githubUsername,
    avatarUrl: payload.avatarUrl,
    studentType: payload.studentType,
    studentId: payload.studentId,
    schoolName: payload.studentType === 'EXTERNAL' ? payload.schoolName : undefined
  })

  const user = await USER_REPOSITORY.findById(createdUser._id)
  const normalizedUser = normalizeUser(user)

  if (user?.status === 'ACTIVE') {
    normalizedUser.emailNotification = await EMAIL_SERVICE.sendTemplateEmail({
      to: user.email,
      template: EMAIL_TEMPLATE_KEYS.TEMPORARY_ACCOUNT,
      context: {
        fullName: user.fullName,
        email: user.email,
        temporaryPassword: payload.password,
        loginUrl: getLoginUrl()
      },
      metadata: {
        source: 'admin-create-user',
        actorId: actor.id || actor._id?.toString?.() || null,
        userId: user._id?.toString()
      }
    })
  }

  return normalizedUser
}

const updateUser = async (id, payload = {}, actor = {}) => {
  const existingUser = await ensureUserExists(id)
  const safePayload = pickSafeFields(payload, USER_UPDATE_FIELDS)
  const updatePayload = { ...safePayload }
  let roleNames = getRoleNames(existingUser).map(roleName => String(roleName).toUpperCase())

  if (safePayload.email && safePayload.email !== existingUser.email) {
    const emailOwner = await USER_REPOSITORY.findByEmail(safePayload.email)
    if (emailOwner && emailOwner._id?.toString() !== id) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Email already exists'])
    }
  }

  if (Object.prototype.hasOwnProperty.call(safePayload, 'githubUsername')) {
    await ensureGithubUsernameIsUnique(safePayload.githubUsername, id)
  }

  if (payload.roles) {
    roleNames = payload.roles.map(role => String(role).toUpperCase())
    ensureRemovedUserRoleIsNotRequested(roleNames)
    ensureCanAssignRoles(actor)
    ensureCanCreateRoles(actor, roleNames)

    const roles = await USER_REPOSITORY.findRolesByNames(roleNames)
    if (roles.length !== roleNames.length) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more roles do not exist'])
    }
    updatePayload.roles = roles.map(role => role._id)
  }

  const finalStudentType = safePayload.studentType !== undefined ? safePayload.studentType : existingUser.studentType
  const finalStudentId = safePayload.studentId !== undefined ? safePayload.studentId : existingUser.studentId
  const finalSchoolName = safePayload.schoolName !== undefined ? safePayload.schoolName : existingUser.schoolName

  if (requiresParticipantProfile(roleNames)) {
    ensureParticipantStudentInfo({
      studentType: finalStudentType,
      studentId: finalStudentId,
      schoolName: finalSchoolName
    })
  }

  if (safePayload.studentType && safePayload.studentType !== 'EXTERNAL') {
    updatePayload.schoolName = null
  }

  const updatedUser = await USER_REPOSITORY.updateById(id, updatePayload)
  return normalizeUser(updatedUser)
}

const updateProfile = async (id, payload = {}) => {
  const existingUser = await ensureUserExists(id)

  const safePayload = pickSafeFields(payload, PROFILE_FIELDS)
  if (Object.prototype.hasOwnProperty.call(safePayload, 'githubUsername')) {
    await ensureGithubUsernameCanBeChanged(id, existingUser.githubUsername, safePayload.githubUsername)
    await ensureGithubUsernameIsUnique(safePayload.githubUsername, id)
  }

  const updatedUser = await USER_REPOSITORY.updateById(id, safePayload)

  return normalizeUser(updatedUser)
}

const updateProfileAvatar = async (id, file, actor = {}) => {
  await ensureUserExists(id)

  const upload = await MEDIA_SERVICE.uploadProfileAvatar(file, actor)
  const updatedUser = await USER_REPOSITORY.updateById(id, { avatarUrl: upload.avatarUrl })

  return normalizeUser(updatedUser)
}

const updateStatus = async (id, status) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid user status'])
  }

  const existingUser = await ensureUserExists(id)

  const updatedUser = await USER_REPOSITORY.updateById(id, { status })
  const normalizedUser = normalizeUser(updatedUser)

  if (existingUser.status !== status && EMAIL_NOTIFICATION_STATUSES.includes(status)) {
    const notification = buildStatusNotification(status)
    const delivery = await NOTIFICATION_SERVICE.notifyUser({
      user: updatedUser,
      type: 'SYSTEM',
      title: notification.title,
      message: notification.message,
      emailTemplate: notification.emailTemplate,
      emailContext: notification.emailContext,
      metadata: {
        userId: updatedUser._id?.toString(),
        status
      }
    })

    normalizedUser.notification = delivery.notification
    normalizedUser.emailNotification = delivery.email
  }

  return normalizedUser
}

const approveUser = async (id) => {
  return await updateStatus(id, 'ACTIVE')
}

const rejectUser = async (id) => {
  return await updateStatus(id, 'REJECTED')
}

const suspendUser = async (id) => {
  return await updateStatus(id, 'SUSPENDED')
}

const getRoleAuditSnapshot = (user) => {
  return (user?.roles || []).map(role => ({
    id: role._id?.toString?.() || role.id?.toString?.() || role.toString?.(),
    name: role.name,
    code: role.code || role.name
  }))
}

const writeRoleAssignmentAudit = ({ actorId, userId, before, after, method }) => {
  if (!actorId) return

  AUDIT_LOG_SERVICE.createAuditLog({
    userId: actorId,
    action: 'USER_ASSIGN_ROLE',
    resourceType: 'User',
    resourceId: userId,
    metadata: { before, after, method }
  }).catch(() => {})
}

const assignRoles = async (id, roleNames = [], actorId = null) => {
  const existingUser = await ensureUserExists(id)
  ensureRemovedUserRoleIsNotRequested(roleNames)

  const roles = await USER_REPOSITORY.findRolesByNames(roleNames)
  if (roles.length !== roleNames.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more roles do not exist or are inactive'])
  }

  const updatedUser = await USER_REPOSITORY.updateById(id, {
    roles: roles.map(role => role._id)
  })

  writeRoleAssignmentAudit({
    actorId,
    userId: id,
    before: getRoleAuditSnapshot(existingUser),
    after: getRoleAuditSnapshot(updatedUser),
    method: 'BY_NAME'
  })

  return normalizeUser(updatedUser)
}

const assignRolesByIds = async (id, roleIds = [], actorId = null) => {
  const existingUser = await ensureUserExists(id)

  const roles = await USER_REPOSITORY.findRolesByIds(roleIds)
  if (roles.length !== roleIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more role IDs are invalid or inactive'])
  }
  ensureRemovedUserRoleIsNotRequested(roles.map((role) => role.name))

  const updatedUser = await USER_REPOSITORY.updateById(id, {
    roles: roles.map(role => role._id)
  })

  writeRoleAssignmentAudit({
    actorId,
    userId: id,
    before: getRoleAuditSnapshot(existingUser),
    after: getRoleAuditSnapshot(updatedUser),
    method: 'BY_ID'
  })

  return normalizeUser(updatedUser)
}

const getEffectivePermissions = async (id) => {
  const user = await ensureUserExists(id)
  const normalizedUser = normalizeUser(user)
  return {
    userId: id,
    roles: normalizedUser.roles.map(r => ({ id: r.id, name: r.name, code: r.code })),
    effectivePermissions: normalizedUser.effectivePermissions
  }
}

export const USER_SERVICE = {
  listUsers,
  getUserById,
  getRawUserById,
  getUserByEmail,
  createUser,
  updateUser,
  updateProfile,
  updateProfileAvatar,
  updateStatus,
  approveUser,
  rejectUser,
  suspendUser,
  assignRoles,
  assignRolesByIds,
  getEffectivePermissions,
  normalizeUser,
  getRoleNames,
  getPermissionCodes
}
