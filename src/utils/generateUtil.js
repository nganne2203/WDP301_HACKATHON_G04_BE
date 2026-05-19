import crypto from 'crypto'
import { env } from '#configs/environment.js'
import { parseTokenTTL } from '#utils/parseTokenUtil.js'

const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString()
}

const generatePasswordResetToken = () => {
  return crypto.randomBytes(9).toString('base64url')
}

const expiresInMinutes = () => {
  const minutes = parseTokenTTL(env.OTP_EXPIRES_IN)
  return new Date(Date.now() + minutes * 60 * 1000)
}

const OTP_EXPIRES_IN_MINUTES = parseInt(env.OTP_EXPIRES_IN.replace(/\D/g, ''), 10)

const extractFieldsFromJoi = (schema) => {
  const description = schema.describe()
  return Object.keys(description.keys || {})
}

const extractRequiredFieldsFromJoi = (schema) => {
  const description = schema.describe()
  return Object.entries(description.keys || {})
  // eslint-disable-next-line no-unused-vars
    .filter(([_, value]) => value.flags?.presence === 'required')
    .map(([key]) => key)
}

export const GENERATE_UTILS = {
  generatePasswordResetToken,
  generateVerificationCode,
  expiresInMinutes,
  OTP_EXPIRES_IN_MINUTES,
  extractFieldsFromJoi,
  extractRequiredFieldsFromJoi
}