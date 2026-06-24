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

test('logs and skips email when SMTP is not configured in development mode', async () => {
  const logger = createLogger()
  const service = createEmailService({
    transport: null,
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
  assert.equal(result.reason, 'SMTP is not configured')
  assert.equal(logger.entries[0].level, 'info')
})

test('sends email with configured transport', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    transport: {
      sendMail: async (payload) => {
        sent.push(payload)
        return { accepted: payload.to, rejected: [], messageId: 'message-1' }
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
  assert.equal(sent[0].from, 'noreply@example.com')
  assert.equal(logger.entries[0].message, 'Sending email...')
  assert.deepEqual(logger.entries[0].metadata, {
    to: ['participant@example.com'],
    subject: 'Welcome'
  })
})

test('returns failure for invalid recipient without calling transport', async () => {
  let called = false
  const logger = createLogger()
  const service = createEmailService({
    transport: {
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
    transport: {
      sendMail: async () => {
        throw new Error('SMTP rejected message')
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
  assert.equal(result.reason, 'SMTP rejected message')
  assert.equal(logger.entries.at(-1).level, 'error')
  assert.equal(logger.entries.at(-1).message, 'Email send failed')
})

test('renders and sends a templated email', async () => {
  const logger = createLogger()
  const sent = []
  const service = createEmailService({
    transport: {
      sendMail: async (payload) => {
        sent.push(payload)
        return { accepted: payload.to, rejected: [], messageId: 'message-2' }
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
