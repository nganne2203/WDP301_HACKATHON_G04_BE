import { AUTH_REPOSITORY } from './auth.repository.js'
import {
  buildGoogleOAuthUrl,
  createGoogleOAuthClient,
  generateGoogleOAuthState,
  verifyGoogleOAuthState
} from '#configs/google.js'
import { env } from '#configs/environment.js'
import { USER_SERVICE } from '#modules/users/user.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { JWT_UTILS } from '#utils/jwtUtil.js'
import { google } from 'googleapis'

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

const buildFrontendRedirectUrl = ({ authData = null, error = null }) => {
  const frontendUrl = env.client.frontendUrl || env.client.urls[0]
  if (!frontendUrl) return null

  const redirectUrl = new URL('/auth/google/callback', frontendUrl)
  if (error) {
    redirectUrl.searchParams.set('success', 'false')
    redirectUrl.searchParams.set('error', error)
    return redirectUrl.toString()
  }

  redirectUrl.searchParams.set('success', 'true')
  redirectUrl.searchParams.set('accessToken', authData.tokens.accessToken)
  redirectUrl.searchParams.set('refreshToken', authData.tokens.refreshToken)

  return redirectUrl.toString()
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

const getGoogleLoginUrl = () => {
  const state = generateGoogleOAuthState({ purpose: 'GOOGLE_LOGIN' })

  return buildGoogleOAuthUrl({
    redirectUri: env.google.authCallbackUrl,
    state
  })
}

const getGoogleProfile = async ({ code, redirectUri }) => {
  const oauth2Client = createGoogleOAuthClient(redirectUri)
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data } = await oauth2.userinfo.get()

  if (!data.email) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google account email is required'])
  }

  return {
    profile: data,
    tokens
  }
}

const handleGoogleCallback = async ({ code, state }) => {
  if (!code) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google authorization code is required'])
  }

  if (!state) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google OAuth state is required'])
  }

  let statePayload
  try {
    statePayload = verifyGoogleOAuthState(state)
  } catch {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid Google OAuth state'])
  }

  if (statePayload.purpose !== 'GOOGLE_LOGIN') {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid Google OAuth state'])
  }

  const { profile } = await getGoogleProfile({ code, redirectUri: env.google.authCallbackUrl })
  const googleAuth = {
    googleId: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture
  }

  const existingUser = await AUTH_REPOSITORY.findUserByEmail(profile.email) ||
    await AUTH_REPOSITORY.findUserByGoogleId(profile.id)

  if (existingUser) {
    const user = await AUTH_REPOSITORY.updateUserById(existingUser._id, {
      googleId: profile.id,
      googleAuth,
      authProvider: 'GOOGLE',
      avatarUrl: existingUser.avatarUrl || profile.picture
    })

    ensureApproved(user)
    const authData = buildAuthResponse(user)
    return {
      authData,
      redirectUrl: buildFrontendRedirectUrl({ authData })
    }
  }

  const userRole = await AUTH_REPOSITORY.findRoleByName('USER')
  const createdUser = await AUTH_REPOSITORY.createUser({
    email: profile.email,
    googleId: profile.id,
    googleAuth,
    authProvider: 'GOOGLE',
    fullName: profile.name || profile.email,
    avatarUrl: profile.picture,
    status: 'APPROVED',
    roles: userRole ? [userRole._id] : []
  })
  const user = await AUTH_REPOSITORY.findUserById(createdUser._id)
  const authData = buildAuthResponse(user)

  return {
    authData,
    redirectUrl: buildFrontendRedirectUrl({ authData })
  }
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
  getGoogleLoginUrl,
  handleGoogleCallback,
  refreshToken,
  getMe,
  changePassword
}
