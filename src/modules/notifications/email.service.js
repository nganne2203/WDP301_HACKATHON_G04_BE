import { MAIL_CONFIG, resend } from '#configs/mail.js'
import { LOGGER } from '#utils/logger.js'
import { renderEmailTemplate } from './email-templates.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

const normalizeSendInfo = ({ response, recipients }) => {
  const providerMessageId = response?.data?.id
  const accepted = providerMessageId ? recipients : []

  return {
    sent: accepted.length > 0,
    status: accepted.length > 0 ? 'SENT' : 'FAILED',
    accepted,
    rejected: accepted.length > 0 ? [] : recipients,
    providerMessageId,
    reason: accepted.length > 0 ? undefined : response?.error?.message || 'Email was rejected by the mail provider'
  }
}

export const createEmailService = ({
  client = resend,
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
    if (!client) {
      if (config.devMode === 'console') {
        logger.info('Email logged in development mode', {
          to: valid,
          subject,
          text,
          metadata
        })
      } else {
        logger.warn('Email skipped because its delivery provider is not configured', {
          to: valid,
          subject,
          provider: config.provider?.name,
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
        reason: 'Resend API is not configured'
      }
    }

    try {
      logger.info('Sending email...', {
        to: valid,
        subject
      })

      const response = await client.emails.send({
        from,
        to: valid,
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {})
      })

      if (response?.error) {
        const error = new Error(response.error.message || 'Resend API rejected message')
        error.name = response.error.name || error.name
        error.statusCode = response.error.statusCode
        throw error
      }

      const result = normalizeSendInfo({ response, recipients: valid })
      logger.info('Email send attempt completed', {
        to: valid,
        subject,
        status: result.status,
        accepted: result.accepted,
        rejected: result.rejected,
        invalid,
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
        message: error.message,
        stack: error.stack,
        metadata
      })

      return {
        sent: false,
        status: 'FAILED',
        accepted: [],
        rejected: valid,
        invalid,
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
