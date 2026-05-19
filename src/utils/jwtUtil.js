import jwt from 'jsonwebtoken'
import { env } from '#configs/environment.js'
import { parseTokenTTL } from '#utils/parseTokenUtil.js'

const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })
}

const generateRefreshToken = (payload) => {
  const minimalPayload = { id: payload.id }
  return jwt.sign(minimalPayload, env.REFRESH_TOKEN_SECRET, { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN })
}

const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET)
}

const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET)
}

const parseRefreshToken = () => {
  return parseTokenTTL(env.REFRESH_TOKEN_EXPIRES_IN)
}

const parseAccessToken = () => {
  return parseTokenTTL(env.JWT_EXPIRES_IN)
}

const generateTokens = (accessPayload, refreshPayload = null) => {
  return {
    accessToken: generateAccessToken(accessPayload),
    refreshToken: generateRefreshToken(refreshPayload || accessPayload)
  }
}

export const JWT_UTILS = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens,
  parseAccessToken,
  parseRefreshToken
}

