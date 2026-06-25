import { MAIL_CONFIG, smtpTransporter } from '#configs/mail.js'
import { LOGGER } from '#utils/logger.js'
import { renderEmailTemplate } from './email-templates.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NON_RETRYABLE_SMTP_CODES = new Set(['EAUTH', 'EENVELOPE', 'EMESSAGE'])
const NON_RETRYABLE_RESPONSE_CODES = new Set([501, 535, 550, 551, 552, 553, 554])

const normalizeRecipients = (to) => {
  const recipients = Array.isArray(to) ? to : [to]
  return recipients
    .flatMap((recipient) => String(recipient || '').split(','))
    .map((recipient) => recipient.trim().toLowerCase())
    .filter(Boolean)
}

const unique = (items = []) => [...new Set(items)]

const splitRecipients = (to) => {
  const recipients = unique(normalizeRecipients(to))

  return {
    valid: recipients.filter((recipient) => EMAIL_PATTERN.test(recipient)),
    invalid: recipients.filter((recipient) => !EMAIL_PATTERN.test(recipient))
  }
}

const sleep = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs))

const serializeMailError = (error = {}) => ({
  name: error.name,
  message: error.message,
  code: error.code,
  command: error.command,
  responseCode: error.responseCode,
  response: error.response,
  stack: error.stack
})

const isRetryableMailError = (error = {}) => {
  if (NON_RETRYABLE_SMTP_CODES.has(error.code)) return false
  if (NON_RETRYABLE_RESPONSE_CODES.has(error.responseCode)) return false
  return true
}

const getRetryConfig = (config = {}) => ({
  maxAttempts: Math.max(1, Number(config.retry?.maxAttempts) || 1),
  delayMs: Math.max(0, Number(config.retry?.delayMs) || 0)
})

const sendMailWithRetry = async ({ client, payload, config, logger, metadata }) => {
  const { maxAttempts, delayMs } = getRetryConfig(config)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await client.sendMail(payload)
      return { response, attempts: attempt }
    } catch (error) {
      error.attempts = attempt
      const shouldRetry = attempt < maxAttempts && isRetryableMailError(error)

      if (!shouldRetry) throw error

      logger.warn('Email send attempt failed; retrying', {
        to: payload.to,
        subject: payload.subject,
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts,
        error: serializeMailError(error),
        metadata
      })

      if (delayMs > 0) {
        await sleep(delayMs * attempt)
      }
    }
  }
}

const normalizeProviderRecipients = (items) => unique(normalizeRecipients(items || []))

const normalizeSendInfo = ({ response, recipients, attempts }) => {
  const responseAccepted = normalizeProviderRecipients(response?.accepted)
  const responseRejected = normalizeProviderRecipients(response?.rejected)
  const pending = normalizeProviderRecipients(response?.pending)
  const accepted = responseAccepted.length > 0
    ? responseAccepted
    : response?.messageId
      ? recipients.filter((recipient) => !responseRejected.includes(recipient))
      : []
  const rejected = accepted.length > 0
    ? responseRejected
    : unique([...responseRejected, ...recipients])

  return {
    sent: accepted.length > 0,
    status: accepted.length > 0 ? 'SENT' : 'FAILED',
    accepted,
    rejected,
    pending,
    providerMessageId: response?.messageId,
    providerResponse: response?.response,
    attempts,
    reason: accepted.length > 0 ? undefined : 'Email was rejected by the SMTP provider'
  }
}

export const createEmailService = ({
  client = smtpTransporter,
  config = MAIL_CONFIG,
  logger = LOGGER
} = {}) => {
  const sendEmail = async ({ to, subject, text, html, metadata } = {}) => {
    const { valid, invalid } = splitRecipients(to)

    if (!subject) {
      return {
        sent: false,
        status: 'FAILED',
        accepted: [],
        rejected: valid,
        invalid,
        reason: 'Email subject is required'
      }
    }

    if (valid.length === 0) {
      logger.warn('Email skipped because no valid recipient was provided', { subject, invalid })
      return {
        sent: false,
        status: 'FAILED',
        accepted: [],
        rejected: [],
        invalid,
        reason: 'No valid recipient email addresses'
      }
    }

    const from = config.from
    if (!client || !from) {
      if (config.devMode === 'console') {
        logger.info('Email logged in development mode', {
          to: valid,
          subject,
          text,
          metadata
        })
      } else {
        logger.warn('Email skipped because its SMTP provider is not configured', {
          to: valid,
          subject,
          provider: config.provider?.name,
          hasTransporter: Boolean(client),
          hasFromAddress: Boolean(from),
          metadata
        })
      }

      return {
        sent: false,
        status: 'SKIPPED',
        skipped: true,
        accepted: [],
        rejected: valid,
        invalid,
        reason: !client ? 'Gmail SMTP is not configured' : 'MAIL_FROM is not configured'
      }
    }

    try {
      logger.info('Sending email...', {
        to: valid,
        subject,
        provider: config.provider?.name
      })

      const { response, attempts } = await sendMailWithRetry({
        client,
        config,
        logger,
        metadata,
        payload: {
          from,
          to: valid,
          subject,
          ...(text ? { text } : {}),
          ...(html ? { html } : {})
        }
      })

      const result = normalizeSendInfo({ response, recipients: valid, attempts })
      logger.info('Email send attempt completed', {
        to: valid,
        subject,
        status: result.status,
        accepted: result.accepted,
        rejected: result.rejected,
        pending: result.pending,
        invalid,
        providerMessageId: result.providerMessageId,
        attempts,
        metadata
      })

      return {
        ...result,
        invalid
      }
    } catch (error) {
      logger.error('Email send failed', {
        to: valid,
        subject,
        error: serializeMailError(error),
        attempts: error.attempts || 1,
        metadata
      })

      return {
        sent: false,
        status: 'FAILED',
        accepted: [],
        rejected: valid,
        invalid,
        attempts: error.attempts || 1,
        reason: error.message
      }
    }
  }

  const sendTemplateEmail = async ({ to, template, context, metadata } = {}) => {
    let rendered
    try {
      rendered = renderEmailTemplate(template, context)
    } catch (error) {
      logger.error('Email template rendering failed', {
        template,
        message: error.message,
        stack: error.stack
      })
      return {
        sent: false,
        status: 'FAILED',
        accepted: [],
        rejected: normalizeRecipients(to),
        invalid: [],
        reason: error.message
      }
    }

    return await sendEmail({
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      metadata: {
        ...metadata,
        template
      }
    })
  }

  return {
    sendEmail,
    sendTemplateEmail
  }
}

export const EMAIL_SERVICE = createEmailService()

