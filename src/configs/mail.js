import nodemailer from 'nodemailer'

import { env } from '#configs/environment.js'
import { LOGGER } from '#utils/logger.js'

export const SMTP_PROVIDER_NAME = 'gmail-smtp'
export const SMTP_HOST = 'smtp.gmail.com'
export const SMTP_PORT = 465
export const SMTP_SECURE = true

const DEFAULT_TIMEOUT_MS = 10000

const maskEmail = (email) => {
  if (!email) return undefined

  const [localPart, domain] = String(email).split('@')
  if (!domain) return '***'

  const visibleLocal = localPart.length <= 2
    ? `${localPart[0] || '*'}***`
    : `${localPart.slice(0, 2)}***${localPart.slice(-1)}`

  return `${visibleLocal}@${domain}`
}

const serializeSmtpError = (error = {}) => ({
  name: error.name,
  message: error.message,
  code: error.code,
  command: error.command,
  responseCode: error.responseCode,
  response: error.response,
  stack: error.stack
})

export const getSmtpConfigurationIssues = ({
  gmailUser = env.email.gmailUser,
  gmailAppPassword = env.email.gmailAppPassword,
  mailFrom = env.email.from
} = {}) => {
  return [
    !gmailUser ? 'GMAIL_USER' : null,
    !gmailAppPassword ? 'GMAIL_APP_PASSWORD' : null,
    !mailFrom ? 'MAIL_FROM' : null
  ].filter(Boolean)
}

export const buildSmtpTransportConfig = ({
  gmailUser = env.email.gmailUser,
  gmailAppPassword = env.email.gmailAppPassword
} = {}) => ({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: gmailUser,
    pass: gmailAppPassword
  },
  connectionTimeout: DEFAULT_TIMEOUT_MS,
  greetingTimeout: DEFAULT_TIMEOUT_MS,
  socketTimeout: DEFAULT_TIMEOUT_MS
})

export const createSmtpTransporter = ({
  gmailUser = env.email.gmailUser,
  gmailAppPassword = env.email.gmailAppPassword,
  transporterFactory = nodemailer.createTransport
} = {}) => {
  if (!gmailUser || !gmailAppPassword) return null

  return transporterFactory(buildSmtpTransportConfig({
    gmailUser,
    gmailAppPassword
  }))
}

export const smtpTransporter = createSmtpTransporter()

export const MAIL_CONFIG = {
  enabled: Boolean(smtpTransporter && env.email.from),
  from: env.email.from,
  devMode: env.email.devMode,
  provider: smtpTransporter
    ? {
      name: SMTP_PROVIDER_NAME,
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE
    }
    : null,
  retry: {
    maxAttempts: 3,
    delayMs: 500
  }
}

export const getSmtpFailureProbableCauses = ({
  error,
  missing = getSmtpConfigurationIssues()
} = {}) => {
  const causes = []

  if (missing.includes('GMAIL_USER')) {
    causes.push('Missing GMAIL_USER environment variable')
  }
  if (missing.includes('GMAIL_APP_PASSWORD')) {
    causes.push('Missing GMAIL_APP_PASSWORD environment variable')
  }
  if (missing.includes('MAIL_FROM')) {
    causes.push('Missing MAIL_FROM environment variable')
  }

  if (error?.code === 'EAUTH' || error?.responseCode === 535) {
    causes.push('Invalid Gmail App Password')
    causes.push('Gmail account is not configured to allow app passwords')
  }

  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EDNS'].includes(error?.code)) {
    causes.push('SMTP connectivity issue between Railway and smtp.gmail.com:465')
  }

  if (error?.responseCode === 534) {
    causes.push('Gmail account requires additional security configuration before SMTP access is allowed')
  }

  if (causes.length === 0) {
    causes.push('Gmail SMTP rejected the connection; inspect error details and account security settings')
  }

  return [...new Set(causes)]
}

export const verifyMailConnection = async ({
  transporter = smtpTransporter,
  config = MAIL_CONFIG,
  logger = LOGGER,
  gmailUser = env.email.gmailUser,
  gmailAppPassword = env.email.gmailAppPassword
} = {}) => {
  const missing = getSmtpConfigurationIssues({
    gmailUser,
    gmailAppPassword,
    mailFrom: config.from
  })

  if (missing.length > 0 || !transporter) {
    logger.warn('Gmail SMTP provider is not fully configured', {
      provider: SMTP_PROVIDER_NAME,
      missing,
      probableCauses: getSmtpFailureProbableCauses({ missing })
    })
    return false
  }

  try {
    await transporter.verify()
    logger.info('SMTP Ready', {
      provider: SMTP_PROVIDER_NAME,
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: maskEmail(gmailUser),
      from: config.from
    })
    return true
  } catch (error) {
    logger.error('SMTP verification failed', {
      provider: SMTP_PROVIDER_NAME,
      error: serializeSmtpError(error),
      probableCauses: getSmtpFailureProbableCauses({ error })
    })
    return false
  }
}
