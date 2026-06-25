import { Resend } from 'resend'

import { env } from '#configs/environment.js'
import { LOGGER } from '#utils/logger.js'

export const RESEND_SENDER = 'SEAL Hackathon <onboarding@resend.dev>'

export const createResendClient = (apiKey) => {
  if (!apiKey) return null
  return new Resend(apiKey)
}

export const resend = createResendClient(env.resend.apiKey)

export const MAIL_CONFIG = {
  enabled: Boolean(resend),
  from: RESEND_SENDER,
  devMode: env.email.devMode,
  provider: resend
    ? {
      name: 'resend'
    }
    : null
}

export const validateResendConfiguration = ({ apiKey = env.resend.apiKey, logger = LOGGER } = {}) => {
  if (!apiKey) {
    logger.warn('Resend email provider is not configured', {
      missing: 'RESEND_API_KEY'
    })
    return false
  }

  logger.info('Resend email provider configured', {
    provider: 'resend',
    from: RESEND_SENDER
  })
  return true
}
