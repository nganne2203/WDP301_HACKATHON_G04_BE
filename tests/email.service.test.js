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

test('logs and skips email when Resend API is not configured in development mode', async () => {
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
  assert.equal(result.reason, 'Resend API is not configured')
  assert.equal(logger.entries[0].level, 'info')
})

test('sends email with configured Resend client', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    client: {
      emails: {
        send: async (payload) => {
          sent.push(payload)
          return { data: { id: 'message-1' }, error: null }
        }
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent' },
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
  assert.equal(sent[0].from, 'noreply@example.com')
  assert.equal(logger.entries[0].message, 'Sending email...')
  assert.deepEqual(logger.entries[0].metadata, {
    to: ['participant@example.com'],
    subject: 'Welcome'
  })
})

test('returns failure when Resend API returns an error response', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    client: {
      emails: {
        send: async (payload) => {
          sent.push(payload)
          return {
            data: null,
            error: {
              name: 'validation_error',
              statusCode: 422,
              message: 'Invalid sender'
            }
          }
        }
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent' },
    logger
  })

  const result = await service.sendEmail({
    to: ['participant@example.com'],
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, false)
  assert.equal(result.status, 'FAILED')
  assert.equal(result.reason, 'Invalid sender')
  assert.equal(sent[0].from, 'noreply@example.com')
})

test('returns failure for invalid recipient without calling Resend', async () => {
  let called = false
  const logger = createLogger()
  const service = createEmailService({
    client: {
      emails: {
        send: async () => {
          called = true
        }
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
      emails: {
        send: async () => {
          throw new Error('Resend rejected message')
        }
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent' },
    logger
  })

  const result = await service.sendEmail({
    to: 'participant@example.com',
    subject: 'Welcome',
    text: 'Hello'
  })

  assert.equal(result.sent, false)
  assert.equal(result.status, 'FAILED')
  assert.equal(result.reason, 'Resend rejected message')
  assert.equal(logger.entries.at(-1).level, 'error')
  assert.equal(logger.entries.at(-1).message, 'Email send failed')
})

test('renders and sends a templated email', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    client: {
      emails: {
        send: async (payload) => {
          sent.push(payload)
          return { data: { id: 'message-2' }, error: null }
        }
      }
    },
    config: { from: 'noreply@example.com', devMode: 'silent' },
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
