import { AUTH_REPOSITORY } from './auth.repository.js'
import { USER_SERVICE } from '#modules/users/user.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { JWT_UTILS } from '#utils/jwtUtil.js'
import {
  REGISTRATION_SOURCES,
  canAccessAuthenticatedRoutes,
  getRegistrationSource,
  isGoogleAccount
} from '#utils/userAccountUtil.js'

const FORM_REGISTRATION_FIELDS = [
  'email',
  'password',
  'fullName',
  'githubUsername',
  'studentType',
  'studentId'
]

export const isCompleteFormRegistrationPayload = (payload = {}) => {
  const hasRequiredFields = FORM_REGISTRATION_FIELDS.every(field => {
    const value = payload[field]
    return value !== undefined && value !== null && String(value).trim() !== ''
  })

  if (!hasRequiredFields) return false
  return payload.studentType !== 'EXTERNAL' || Boolean(payload.schoolName?.trim())
}

export const isGoogleLoginFallback = (payload = {}) => {
  return Boolean(payload.googleId) && !isCompleteFormRegistrationPayload(payload)
}

const buildTokenPayload = (user) => {
  return {
    id: user._id.toString(),
    email: user.email,
    roles: USER_SERVICE.getRoleNames(user),
    permissions: USER_SERVICE.getPermissionCodes(user)
  }
}

const buildAuthResponse = (user) => {
  const tokenPayload = buildTokenPayload(user)

  return {
    user: USER_SERVICE.normalizeUser(user),
    tokens: JWT_UTILS.generateTokens(tokenPayload)
  }
}

const ensureApproved = (user) => {
  if (user.status !== 'APPROVED') {
    throw new ApiError(ERROR_CODES.FORBIDDEN, [`Account status is ${user.status}`])
  }
}

const ensureAccountCanAccess = (user) => {
  if (!canAccessAuthenticatedRoutes(user)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, [`Account status is ${user.status}`])
  }
}

const register = async (payload) => {
  if (isGoogleLoginFallback(payload)) {
    return await googleLogin(payload)
  }

  const existingUser = await AUTH_REPOSITORY.findUserByEmail(payload.email)
  if (existingUser) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['Email already exists'])
  }

  const userRole = await AUTH_REPOSITORY.findRoleByName('USER')
  const passwordHash = await BCRYPT_UTILS.hashPassword(payload.password)

  const createdUser = await AUTH_REPOSITORY.createUser({
    email: payload.email,
    fullName: payload.fullName,
    githubUsername: payload.githubUsername,
    studentType: payload.studentType,
    studentId: payload.studentId,
    schoolName: payload.studentType === 'EXTERNAL' ? payload.schoolName : undefined,
    passwordHash,
    authProvider: 'LOCAL',
    registrationSource: REGISTRATION_SOURCES.FORM,
    status: 'PENDING',
    roles: userRole ? [userRole._id] : []
  })

  const user = await AUTH_REPOSITORY.findUserById(createdUser._id)

  return USER_SERVICE.normalizeUser(user)
}

const googleLogin = async ({ googleId, email, name, avatar }) => {
  const googleAuth = {
    googleId,
    email,
    name,
    picture: avatar || undefined
  }

  const existingUser = await AUTH_REPOSITORY.findUserByGoogleId(googleId) ||
    await AUTH_REPOSITORY.findUserByEmail(email)

  if (!existingUser) {
    throw new ApiError(ERROR_CODES.GOOGLE_ACCOUNT_NOT_FOUND, [
      `No account exists for ${email}. Register with the registration form first.`
    ])
  }

  if (existingUser.email.toLowerCase() !== email.toLowerCase()) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Google identity does not match the account email'])
  }

  const linkedGoogleId = existingUser.googleAuth?.googleId || existingUser.googleId
  if (linkedGoogleId && linkedGoogleId !== googleId) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['This email is linked to a different Google account'])
  }

  const registrationSource = getRegistrationSource(existingUser)
  if (isGoogleAccount(existingUser)) {
    if (['REJECTED', 'SUSPENDED'].includes(existingUser.status)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, [`Account status is ${existingUser.status}`])
    }
  } else {
    ensureApproved(existingUser)
  }

  const updates = {
    googleId,
    googleAuth,
    registrationSource,
    avatarUrl: existingUser.avatarUrl || avatar || undefined
  }

  if (registrationSource === REGISTRATION_SOURCES.GOOGLE) {
    updates.authProvider = 'GOOGLE'
    updates.status = 'ACTIVE'
  }

  const user = await AUTH_REPOSITORY.updateUserById(existingUser._id, updates)
  return buildAuthResponse(user)
}

const login = async ({ email, password }) => {
  const user = await AUTH_REPOSITORY.findUserByEmail(email)
  if (!user || !user.passwordHash) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Email or password is incorrect'])
  }

  const passwordMatched = await BCRYPT_UTILS.comparePassword(password, user.passwordHash)
  if (!passwordMatched) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Email or password is incorrect'])
  }

  ensureApproved(user)

  return buildAuthResponse(user)
}

const refreshToken = async (refreshTokenValue) => {
  const decoded = JWT_UTILS.verifyRefreshToken(refreshTokenValue)
  const user = await AUTH_REPOSITORY.findUserById(decoded.id)

  if (!user) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Invalid refresh token'])
  }

  ensureAccountCanAccess(user)

  return buildAuthResponse(user)
}

const getMe = async (userId) => {
  const user = await AUTH_REPOSITORY.findUserById(userId)
  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['User not found'])
  }

  return USER_SERVICE.normalizeUser(user)
}

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await AUTH_REPOSITORY.findUserById(userId)
  if (!user || !user.passwordHash) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['User not found'])
  }

  const passwordMatched = await BCRYPT_UTILS.comparePassword(currentPassword, user.passwordHash)
  if (!passwordMatched) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Current password is incorrect'])
  }

  const passwordHash = await BCRYPT_UTILS.hashPassword(newPassword)
  const updatedUser = await AUTH_REPOSITORY.updateUserById(userId, {
    passwordHash,
    mustChangePassword: false
  })

  return USER_SERVICE.normalizeUser(updatedUser)
}

export const AUTH_SERVICE = {
  register,
  login,
  googleLogin,
  refreshToken,
  getMe,
  changePassword
}
