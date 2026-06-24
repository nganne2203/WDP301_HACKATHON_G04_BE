import nodemailer from 'nodemailer'

import { env } from '#configs/environment.js'
import { LOGGER } from '#utils/logger.js'

export const createGmailTransport = ({ user, password }) => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user,
    pass: password
  }
})

export const transporter = env.EMAIL_USER && env.EMAIL_PASSWORD
  ? createGmailTransport({
    user: env.EMAIL_USER,
    password: env.EMAIL_PASSWORD
  })
  : null

export const MAIL_CONFIG = {
  enabled: Boolean(transporter),
  from: env.EMAIL_USER,
  devMode: env.email.devMode,
  transport: transporter
    ? {
      provider: 'gmail',
      service: 'gmail'
    }
    : null
}

export const verifyGmailConnection = async ({ transport = transporter, logger = LOGGER } = {}) => {
  if (!transport) {
    logger.error('Gmail SMTP connection failed', {
      error: 'EMAIL_USER and EMAIL_PASSWORD are required'
    })
    return false
  }

  try {
    await transport.verify()
    logger.info('Gmail SMTP connected successfully', {
      user: env.EMAIL_USER
    })
    return true
  } catch (error) {
    logger.error('Gmail SMTP connection failed', {
      user: env.EMAIL_USER,
      error: error.message
    })
    return false
  }
}
