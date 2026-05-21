import jwt from 'jsonwebtoken'
import { env } from '#configs/environment.js'
import { parseTokenTTL } from '#utils/parseTokenUtil.js'

const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn })
}

const generateRefreshToken = (payload) => {
  const minimalPayload = { id: payload.id }
  return jwt.sign(minimalPayload, env.jwt.refreshTokenSecret, { expiresIn: env.jwt.refreshTokenExpiresIn })
}

const verifyAccessToken = (token) => {
  return jwt.verify(token, env.jwt.secret)
}

const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.jwt.refreshTokenSecret)
}

const parseRefreshToken = () => {
  return parseTokenTTL(env.jwt.refreshTokenExpiresIn)
}

const parseAccessToken = () => {
  return parseTokenTTL(env.jwt.expiresIn)
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
