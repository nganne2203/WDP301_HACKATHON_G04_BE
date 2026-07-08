import crypto from 'node:crypto'

import { AUTH_REPOSITORY } from './auth.repository.js'
import { USER_SERVICE } from '#modules/users/user.service.js'
import { EMAIL_SERVICE } from '#modules/notifications/email.service.js'
import { EMAIL_TEMPLATE_KEYS } from '#modules/notifications/email-templates.js'
import { env } from '#configs/environment.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { JWT_UTILS } from '#utils/jwtUtil.js'
import {
  REGISTRATION_SOURCES,
  canAccessAuthenticatedRoutes,
  getRegistrationSource
} from '#utils/userAccountUtil.js'
import { PARTICIPANT_ROLE_NAME } from '#utils/userRoleMigrationUtil.js'

const FORM_REGISTRATION_FIELDS = [
  'email',
  'password',
  'fullName',
  'githubUsername',
  'studentType',
  'studentId'
]

const PASSWORD_RESET_GENERIC_RESULT = {
  sent: true
}

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

const ensureActive = (user) => {
  if (user.status !== 'ACTIVE') {
    throw new ApiError(ERROR_CODES.FORBIDDEN, [`Account status is ${user.status}`])
  }
}

const ensureAccountCanAccess = (user) => {
  if (!canAccessAuthenticatedRoutes(user)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, [`Account status is ${user.status}`])
  }
}

const hashPasswordResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

const createPasswordResetToken = () => {
  return crypto.randomBytes(32).toString('base64url')
}

const getFrontendUrl = (path) => {
  const frontendUrl = env.client.frontendUrl || env.client.urls[0]
  if (!frontendUrl) return null

  try {
    return new URL(path, frontendUrl).toString()
  } catch {
    return null
  }
}

const appendSearchParams = (urlString, params = {}) => {
  if (!urlString) return null

  try {
    const url = new URL(urlString)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
    return url.toString()
  } catch {
    return null
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

  const participantRole = await AUTH_REPOSITORY.findRoleByName(PARTICIPANT_ROLE_NAME)
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
    roles: participantRole ? [participantRole._id] : []
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

  if (['REJECTED', 'SUSPENDED'].includes(existingUser.status)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, [`Account status is ${existingUser.status}`])
  }
  ensureAccountCanAccess(existingUser)

  const updates = {
    googleId,
    googleAuth,
    registrationSource: existingUser.registrationSource || getRegistrationSource(existingUser),
    avatarUrl: existingUser.avatarUrl || avatar || undefined
  }

  if (!existingUser.passwordHash) {
    updates.authProvider = 'GOOGLE'
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

  ensureActive(user)

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

const requestPasswordReset = async ({ email }) => {
  const user = await AUTH_REPOSITORY.findUserByEmail(email)

  if (!user || !user.passwordHash || user.authProvider !== 'LOCAL') {
    return PASSWORD_RESET_GENERIC_RESULT
  }

  const token = createPasswordResetToken()
  const expiresMinutes = env.passwordReset.expiresMinutes
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000)
  const resetUrl = appendSearchParams(getFrontendUrl('/reset-password'), { token })

  await AUTH_REPOSITORY.revokeActivePasswordResetTokens(user._id)
  await AUTH_REPOSITORY.createPasswordResetToken({
    userId: user._id,
    tokenHash: hashPasswordResetToken(token),
    expiresAt
  })

  await EMAIL_SERVICE.sendTemplateEmail({
    to: user.email,
    template: EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
    context: {
      fullName: user.fullName,
      resetUrl,
      expiresMinutes
    },
    metadata: {
      source: 'password-reset',
      userId: user._id.toString()
    }
  })

  return PASSWORD_RESET_GENERIC_RESULT
}

const resetPassword = async ({ token, newPassword }) => {
  const tokenHash = hashPasswordResetToken(token)
  const resetToken = await AUTH_REPOSITORY.findPasswordResetTokenByHash(tokenHash)

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Password reset link is invalid or expired'])
  }

  const user = await AUTH_REPOSITORY.findUserById(resetToken.userId)
  if (!user || !user.passwordHash) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Password reset link is invalid or expired'])
  }

  const passwordHash = await BCRYPT_UTILS.hashPassword(newPassword)
  await AUTH_REPOSITORY.updateUserById(user._id, {
    passwordHash,
    mustChangePassword: false
  })
  await AUTH_REPOSITORY.markPasswordResetTokenUsed(resetToken._id)
  await AUTH_REPOSITORY.revokeActivePasswordResetTokens(user._id)

  return { reset: true }
}

export const AUTH_SERVICE = {
  register,
  login,
  googleLogin,
  refreshToken,
  getMe,
  changePassword,
  requestPasswordReset,
  resetPassword
}
