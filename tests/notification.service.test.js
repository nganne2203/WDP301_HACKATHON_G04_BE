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
  const emitted = []
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
    socketEmitter: {
      emitToUser: (userId, event, payload) => {
        emitted.push({ userId, event, payload })
        return true
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
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].userId, 'user-1')
  assert.equal(emitted[0].event, 'notification_created')
  assert.equal(emitted[0].payload.title, 'Account approved')
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

test('notifyUser reuses existing in-app notification when dedupeKey matches', async () => {
  const created = []
  const emitted = []
  const existing = {
    _id: 'notification-1',
    userId: 'user-1',
    title: 'Event starts soon',
    message: 'Your event starts in 1 hour.',
    type: 'DEADLINE',
    status: 'UNREAD',
    dedupeKey: 'event-start:event-1:1h:user-1',
    createdAt: new Date('2026-05-30T00:00:00.000Z')
  }

  const service = createNotificationService({
    repository: {
      findByDedupeKey: async (dedupeKey) => dedupeKey === existing.dedupeKey ? existing : null,
      create: async (payload) => {
        created.push(payload)
        return { _id: 'notification-2', ...payload, status: 'UNREAD' }
      }
    },
    emailService: {
      sendTemplateEmail: async () => ({ sent: true, status: 'SENT', accepted: ['participant@example.com'] })
    },
    socketEmitter: {
      emitToUser: (userId, event, payload) => {
        emitted.push({ userId, event, payload })
        return true
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
    title: 'Event starts soon',
    message: 'Your event starts in 1 hour.',
    type: 'DEADLINE',
    dedupeKey: existing.dedupeKey,
    channels: ['IN_APP']
  })

  assert.equal(created.length, 0)
  assert.equal(result.notification.id, 'notification-1')
  assert.equal(result.notification.dedupeKey, existing.dedupeKey)
  assert.equal(result.email, null)
  assert.equal(emitted.length, 0)
})

test('mark read operations emit notification socket events', async () => {
  const emitted = []
  const service = createNotificationService({
    repository: {
      markAsRead: async ({ id, userId }) => ({
        _id: id,
        userId,
        title: 'Read me',
        message: 'Marked as read',
        type: 'SYSTEM',
        status: 'READ',
        createdAt: new Date('2026-05-30T00:00:00.000Z')
      }),
      markAllAsRead: async () => ({ matchedCount: 3, modifiedCount: 2 })
    },
    socketEmitter: {
      emitToUser: (userId, event, payload) => {
        emitted.push({ userId, event, payload })
        return true
      }
    },
    logger: createLogger()
  })

  await service.markAsRead({
    id: '000000000000000000000001',
    userId: '000000000000000000000002'
  })
  await service.markAllAsRead('000000000000000000000002')

  assert.equal(emitted.length, 2)
  assert.equal(emitted[0].event, 'notification_read')
  assert.equal(emitted[0].payload.status, 'READ')
  assert.equal(emitted[1].event, 'notifications_read_all')
  assert.equal(emitted[1].payload.modifiedCount, 2)
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
