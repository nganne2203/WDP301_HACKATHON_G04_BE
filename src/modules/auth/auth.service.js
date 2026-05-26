import { AUTH_REPOSITORY } from './auth.repository.js'
import { USER_SERVICE } from '#modules/users/user.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { JWT_UTILS } from '#utils/jwtUtil.js'

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

const register = async (payload) => {
  const existingUser = await AUTH_REPOSITORY.findUserByEmail(payload.email)
  if (existingUser) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['Email already exists'])
  }

  const userRole = await AUTH_REPOSITORY.findRoleByName('USER')
  const passwordHash = await BCRYPT_UTILS.hashPassword(payload.password)

  const createdUser = await AUTH_REPOSITORY.createUser({
    email: payload.email,
    fullName: payload.fullName,
    studentType: payload.studentType,
    studentId: payload.studentId,
    schoolName: payload.studentType === 'EXTERNAL' ? payload.schoolName : undefined,
    passwordHash,
    authProvider: 'LOCAL',
    status: 'PENDING',
    roles: userRole ? [userRole._id] : []
  })

  const user = await AUTH_REPOSITORY.findUserById(createdUser._id)

  return USER_SERVICE.normalizeUser(user)
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

  ensureApproved(user)

  return buildAuthResponse(user)
}

const getMe = async (userId) => {
  const user = await AUTH_REPOSITORY.findUserById(userId)
  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['User not found'])
  }

  return USER_SERVICE.normalizeUser(user)
}

export const AUTH_SERVICE = {
  register,
  login,
  refreshToken,
  getMe
}
