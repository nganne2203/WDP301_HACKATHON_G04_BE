import assert from 'node:assert/strict'
import test from 'node:test'

import { createEmailService } from '../src/modules/notifications/email.service.js'
import { EMAIL_TEMPLATE_KEYS } from '../src/modules/notifications/email-templates.js'

const createLogger = () => {
  const entries = []

  return {
    entries,
    info: (message, metadata) => entries.push({ level: 'info', message, metadata }),
    warn: (message, metadata) => entries.push({ level: 'warn', message, metadata }),
    error: (message, metadata) => entries.push({ level: 'error', message, metadata })
  }
}

test('logs and skips email when Gmail SMTP is not configured in development mode', async () => {
  const logger = createLogger()
  const service = createEmailService({
    client: null,
    config: { from: 'noreply@example.com', devMode: 'console' },
    logger
  })

  const result = await service.sendEmail({
    to: 'participant@example.com',
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, false)
  assert.equal(result.status, 'SKIPPED')
  assert.equal(result.reason, 'Gmail SMTP is not configured')
  assert.equal(logger.entries[0].level, 'info')
})

test('sends email with configured SMTP transporter', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    client: {
      sendMail: async (payload) => {
        sent.push(payload)
        return {
          messageId: 'message-1',
          accepted: payload.to,
          rejected: [],
          response: '250 OK'
        }
      }
    },
    config: {
      from: 'noreply@example.com',
      devMode: 'silent',
      provider: { name: 'gmail-smtp' },
      retry: { maxAttempts: 1, delayMs: 0 }
    },
    logger
  })

  const result = await service.sendEmail({
    to: ['participant@example.com'],
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, true)
  assert.equal(result.status, 'SENT')
  assert.deepEqual(result.accepted, ['participant@example.com'])
  assert.equal(result.providerMessageId, 'message-1')
  assert.equal(result.providerResponse, '250 OK')
  assert.equal(sent[0].from, 'noreply@example.com')
  assert.equal(logger.entries[0].message, 'Sending email...')
  assert.deepEqual(logger.entries[0].metadata, {
    to: ['participant@example.com'],
    subject: 'Welcome',
    provider: 'gmail-smtp'
  })
})

test('returns failure when SMTP rejects all recipients', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    client: {
      sendMail: async (payload) => {
        sent.push(payload)
        return {
          messageId: null,
          accepted: [],
          rejected: payload.to,
          response: '550 rejected'
        }
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent', retry: { maxAttempts: 1, delayMs: 0 } },
    logger
  })

  const result = await service.sendEmail({
    to: ['participant@example.com'],
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, false)
  assert.equal(result.status, 'FAILED')
  assert.equal(result.reason, 'Email was rejected by the SMTP provider')
  assert.equal(sent[0].from, 'noreply@example.com')
})

test('returns failure for invalid recipient without calling SMTP', async () => {
  let called = false
  const logger = createLogger()
  const service = createEmailService({
    client: {
      sendMail: async () => {
        called = true
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent' },
    logger
  })

  const result = await service.sendEmail({
    to: 'not-an-email',
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, false)
  assert.equal(result.status, 'FAILED')
  assert.equal(result.reason, 'No valid recipient email addresses')
  assert.equal(called, false)
})

test('returns failure when provider throws', async () => {
  const logger = createLogger()
  const service = createEmailService({
    client: {
      sendMail: async () => {
        const error = new Error('SMTP rejected message')
        error.code = 'EAUTH'
        throw error
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent', retry: { maxAttempts: 3, delayMs: 0 } },
    logger
  })

  const result = await service.sendEmail({
    to: 'participant@example.com',
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, false)
  assert.equal(result.status, 'FAILED')
  assert.equal(result.reason, 'SMTP rejected message')
  assert.equal(logger.entries.at(-1).level, 'error')
  assert.equal(logger.entries.at(-1).message, 'Email send failed')
  assert.equal(result.attempts, 1)
})

test('retries transient SMTP failures before succeeding', async () => {
  const logger = createLogger()
  let attempts = 0
  const service = createEmailService({
    client: {
      sendMail: async (payload) => {
        attempts += 1
        if (attempts === 1) {
          const error = new Error('Connection reset')
          error.code = 'ECONNRESET'
          throw error
        }

        return {
          messageId: 'message-after-retry',
          accepted: payload.to,
          rejected: [],
          response: '250 OK'
        }
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent', retry: { maxAttempts: 2, delayMs: 0 } },
    logger
  })

  const result = await service.sendEmail({
    to: 'participant@example.com',
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, true)
  assert.equal(result.attempts, 2)
  assert.equal(logger.entries.some((entry) => entry.message === 'Email send attempt failed; retrying'), true)
})

test('renders and sends a templated email', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    client: {
      sendMail: async (payload) => {
        sent.push(payload)
        return { messageId: 'message-2', accepted: payload.to, rejected: [] }
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent', retry: { maxAttempts: 1, delayMs: 0 } },
    logger
  })

  const result = await service.sendTemplateEmail({
    to: 'participant@example.com',
    template: EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED,
    context: {
      fullName: 'Participant User',
      loginUrl: 'http://localhost:5173/login'
    }
  })

  assert.equal(result.sent, true)
  assert.match(sent[0].subject, /approved/i)
  assert.match(sent[0].text, /Participant User/)
})
