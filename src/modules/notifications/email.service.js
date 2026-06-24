import { MAIL_CONFIG, transporter } from '#configs/mail.js'
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

const normalizeSendInfo = ({ info, recipients }) => {
  const accepted = info?.accepted?.length ? info.accepted : recipients

  return {
    sent: accepted.length > 0,
    status: accepted.length > 0 ? 'SENT' : 'FAILED',
    accepted,
    rejected: info?.rejected || [],
    providerMessageId: info?.messageId,
    reason: accepted.length > 0 ? undefined : 'Email was rejected by the mail provider'
  }
}

export const createEmailService = ({
  transport = transporter,
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
    if (!transport) {
      const missingProviderReason = config.transport?.provider === 'resend'
        ? 'Resend API key is not configured'
        : 'SMTP is not configured'

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
          provider: config.transport?.provider,
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
        reason: missingProviderReason
      }
    }

    try {
      const info = await transport.sendMail({
        from,
        to: valid,
        subject,
        text,
        html
      })

      const result = normalizeSendInfo({ info, recipients: valid })
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
      logger.error('Email send attempt failed', {
        to: valid,
        subject,
        error: error.message,
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
      logger.error('Email template rendering failed', { template, error: error.message })
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
