import assert from 'node:assert/strict'
import test from 'node:test'

import { createNotificationService } from '../src/modules/notifications/notification.service.js'
import { EMAIL_TEMPLATE_KEYS } from '../src/modules/notifications/email-templates.js'

const createLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {}
})

test('notifyUser creates in-app notification and sends email', async () => {
  const created = []
  const sent = []
  const service = createNotificationService({
    repository: {
      create: async (payload) => {
        created.push(payload)
        return {
          _id: 'notification-1',
          ...payload,
          status: 'UNREAD',
          createdAt: new Date('2026-05-30T00:00:00.000Z')
        }
      }
    },
    emailService: {
      sendTemplateEmail: async (payload) => {
        sent.push(payload)
        return { sent: true, status: 'SENT', accepted: [payload.to], rejected: [] }
      }
    },
    logger: createLogger()
  })

  const result = await service.notifyUser({
    user: {
      _id: 'user-1',
      email: 'participant@example.com',
      fullName: 'Participant User'
    },
    title: 'Account approved',
    message: 'Your account has been approved.',
    emailTemplate: EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED
  })

  assert.equal(created.length, 1)
  assert.equal(created[0].userId, 'user-1')
  assert.equal(result.notification.title, 'Account approved')
  assert.equal(result.email.sent, true)
  assert.equal(sent[0].to, 'participant@example.com')
  assert.equal(sent[0].template, EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED)
})

test('notifyUser does not fail main flow when notification repository fails', async () => {
  const service = createNotificationService({
    repository: {
      create: async () => {
        throw new Error('database unavailable')
      }
    },
    emailService: {
      sendTemplateEmail: async () => ({ sent: true, status: 'SENT', accepted: ['participant@example.com'] })
    },
    logger: createLogger()
  })

  const result = await service.notifyUser({
    user: {
      _id: 'user-1',
      email: 'participant@example.com',
      fullName: 'Participant User'
    },
    title: 'Account approved',
    message: 'Your account has been approved.',
    emailTemplate: EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED
  })

  assert.equal(result.notification, null)
  assert.equal(result.email.sent, true)
  assert.deepEqual(result.errors, ['database unavailable'])
})

test('sendEventInvitations deduplicates recipients and summarizes delivery', async () => {
  const sent = []
  const service = createNotificationService({
    emailService: {
      sendTemplateEmail: async (payload) => {
        sent.push(payload)
        return payload.to === 'bad@example.com'
          ? { sent: false, status: 'FAILED', accepted: [], rejected: [payload.to], reason: 'SMTP rejected message' }
          : { sent: true, status: 'SENT', accepted: [payload.to], rejected: [] }
      }
    },
    logger: createLogger()
  })

  const result = await service.sendEventInvitations({
    event: {
      _id: 'event-1',
      title: 'SEAL Hackathon'
    },
    emails: ['participant@example.com', 'participant@example.com', 'bad@example.com'],
    actor: { id: 'coordinator-1' }
  })

  assert.equal(result.total, 2)
  assert.equal(result.sent, 1)
  assert.equal(result.failed, 1)
  assert.equal(sent.length, 2)
  assert.equal(sent[0].template, EMAIL_TEMPLATE_KEYS.EVENT_INVITATION)
})
