import { google } from 'googleapis'
import { env } from '#configs/environment.js'
import { LOGGER } from '#utils/logger.js'

export const SMTP_PROVIDER_NAME = 'gmail-api'

const maskEmail = (email) => {
  if (!email) return undefined

  const [localPart, domain] = String(email).split('@')
  if (!domain) return '***'

  const visibleLocal = localPart.length <= 2
    ? `${localPart[0] || '*'}***`
    : `${localPart.slice(0, 2)}***${localPart.slice(-1)}`

  return `${visibleLocal}@${domain}`
}

const serializeGmailError = (error = {}) => ({
  name: error.name,
  message: error.message,
  code: error.code,
  stack: error.stack
})

const sanitizeHeaderValue = (value = '') => String(value)
  .replace(/[\r\n]+/g, ' ')
  .trim()

const encodeMimeHeaderValue = (value = '') => {
  const sanitized = sanitizeHeaderValue(value)
  if (!/[^\x20-\x7E]/.test(sanitized)) return sanitized

  return `=?UTF-8?B?${Buffer.from(sanitized, 'utf8').toString('base64')}?=`
}

export const getGmailApiConfigurationIssues = ({
  gmailUser = env.email.gmailUser,
  clientId = env.email.gmailClientId,
  clientSecret = env.email.gmailClientSecret,
  refreshToken = env.email.gmailRefreshToken,
  mailFrom = env.email.from
} = {}) => {
  return [
    !gmailUser ? 'GMAIL_USER' : null,
    !clientId ? 'GMAIL_CLIENT_ID' : null,
    !clientSecret ? 'GMAIL_CLIENT_SECRET' : null,
    !refreshToken ? 'GMAIL_REFRESH_TOKEN' : null,
    !mailFrom ? 'MAIL_FROM' : null
  ].filter(Boolean)
}

export const createGmailApiTransporter = ({
  gmailUser = env.email.gmailUser,
  clientId = env.email.gmailClientId,
  clientSecret = env.email.gmailClientSecret,
  refreshToken = env.email.gmailRefreshToken
} = {}) => {
  if (!clientId || !clientSecret || !refreshToken || !gmailUser) return null

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  return {
    isGmailApi: true,
    gmail,
    oauth2Client,
    verify: async () => {
      await gmail.users.getProfile({ userId: 'me' })
      return true
    },
    sendMail: async (payload) => {
      const { from, to, subject, text, html } = payload
      const recipients = Array.isArray(to) ? to : [to]

      const boundary = 'foo_bar_baz'
      const emailLines = []

      emailLines.push(`From: ${sanitizeHeaderValue(from)}`)
      emailLines.push(`To: ${recipients.map(sanitizeHeaderValue).join(', ')}`)
      emailLines.push(`Subject: ${encodeMimeHeaderValue(subject)}`)
      emailLines.push('MIME-Version: 1.0')
      emailLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
      emailLines.push('')

      if (text) {
        emailLines.push(`--${boundary}`)
        emailLines.push('Content-Type: text/plain; charset="UTF-8"')
        emailLines.push('Content-Transfer-Encoding: base64')
        emailLines.push('')
        emailLines.push(Buffer.from(text).toString('base64'))
      }

      if (html) {
        emailLines.push(`--${boundary}`)
        emailLines.push('Content-Type: text/html; charset="UTF-8"')
        emailLines.push('Content-Transfer-Encoding: base64')
        emailLines.push('')
        emailLines.push(Buffer.from(html).toString('base64'))
      }

      emailLines.push(`--${boundary}--`)

      const raw = Buffer.from(emailLines.join('\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
      })

      return {
        accepted: recipients,
        rejected: [],
        pending: [],
        messageId: result.data.id,
        response: '250 2.0.0 OK'
      }
    }
  }
}

export const smtpTransporter = createGmailApiTransporter()

export const MAIL_CONFIG = {
  enabled: Boolean(smtpTransporter && env.email.from),
  from: env.email.from,
  devMode: env.email.devMode,
  provider: smtpTransporter
    ? {
      name: 'gmail-api'
    }
    : null,
  retry: {
    maxAttempts: 3,
    delayMs: 500
  }
}

export const verifyMailConnection = async ({
  transporter = smtpTransporter,
  config = MAIL_CONFIG,
  logger = LOGGER,
  gmailUser = env.email.gmailUser
} = {}) => {
  const usingDefaultTransporter = transporter === smtpTransporter
  const missing = getGmailApiConfigurationIssues({
    gmailUser,
    clientId: usingDefaultTransporter ? env.email.gmailClientId : 'injected-transporter',
    clientSecret: usingDefaultTransporter ? env.email.gmailClientSecret : 'injected-transporter',
    refreshToken: usingDefaultTransporter ? env.email.gmailRefreshToken : 'injected-transporter',
    mailFrom: config.from
  })

  if (missing.length > 0 || !transporter) {
    logger.warn('Gmail API provider is not fully configured', {
      provider: 'gmail-api',
      missing
    })
    return false
  }

  try {
    await transporter.verify()
    logger.info('Gmail API Ready', {
      provider: 'gmail-api',
      user: maskEmail(gmailUser),
      from: config.from
    })
    return true
  } catch (error) {
    logger.error('Gmail API verification failed', {
      provider: 'gmail-api',
      error: serializeGmailError(error)
    })
    return false
  }
}
