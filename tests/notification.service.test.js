import assert from 'node:assert/strict'
import test from 'node:test'

import { createNotificationService } from '../src/modules/notifications/notification.service.js'
import { EMAIL_TEMPLATE_KEYS } from '../src/modules/notifications/email-templates.js'

const createLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {}
})

const createQuery = (value) => ({
  select () { return this },
  lean: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
})

const noPushUserModel = {
  findById: () => createQuery(null)
}

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
      emitToUser: (userId, competition, payload) => {
        emitted.push({ userId, competition, payload })
        return true
      }
    },
    userModel: noPushUserModel,
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
  assert.equal(result.push.status, 'SKIPPED')
  assert.equal(sent[0].to, 'participant@example.com')
  assert.equal(sent[0].template, EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED)
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].userId, 'user-1')
  assert.equal(emitted[0].competition, 'notification_created')
  assert.equal(emitted[0].payload.title, 'Account approved')
})

test('notifyUser sends Expo push when a new in-app notification is created', async () => {
  const requests = []
  const service = createNotificationService({
    repository: {
      create: async (payload) => ({
        _id: 'notification-1',
        ...payload,
        status: 'UNREAD'
      })
    },
    emailService: {
      sendTemplateEmail: async () => ({ sent: false, status: 'SKIPPED' })
    },
    userModel: {
      findById: () => createQuery({
        pushToken: 'ExponentPushToken[device-token]',
        pushPlatform: 'android'
      })
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        json: async () => ({ data: { status: 'ok', id: 'expo-ticket-1' } })
      }
    },
    logger: createLogger()
  })

  const result = await service.notifyUser({
    user: { _id: 'user-1' },
    title: 'Results published',
    message: 'Preliminary Round results are available.',
    type: 'RESULT',
    metadata: {
      action: 'RESULTS_PUBLISHED',
      competitionId: 'competition-1',
      roundId: 'round-1',
      targetPath: '/participant/results'
    },
    channels: ['IN_APP']
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://exp.host/--/api/v2/push/send')
  const body = JSON.parse(requests[0].options.body)
  assert.equal(body.to, 'ExponentPushToken[device-token]')
  assert.equal(body.data.notificationId, 'notification-1')
  assert.equal(body.data.action, 'RESULTS_PUBLISHED')
  assert.equal(result.push.sent, true)
  assert.equal(result.push.ticketId, 'expo-ticket-1')
})

test('notifyUser keeps the in-app notification when Expo delivery fails', async () => {
  const service = createNotificationService({
    repository: {
      create: async (payload) => ({ _id: 'notification-1', ...payload, status: 'UNREAD' })
    },
    emailService: {
      sendTemplateEmail: async () => ({ sent: false, status: 'SKIPPED' })
    },
    userModel: {
      findById: () => createQuery({ pushToken: 'ExponentPushToken[device-token]' })
    },
    fetchImpl: async () => {
      throw new Error('Expo unavailable')
    },
    logger: createLogger()
  })

  const result = await service.notifyUser({
    user: { _id: 'user-1' },
    title: 'Team invitation',
    message: 'You were invited to a team.',
    channels: ['IN_APP']
  })

  assert.equal(result.notification.id, 'notification-1')
  assert.equal(result.push.sent, false)
  assert.equal(result.push.status, 'FAILED')
  assert.deepEqual(result.errors, ['Expo unavailable'])
})

test('notifyUser clears a DeviceNotRegistered Expo token', async () => {
  const updates = []
  const service = createNotificationService({
    repository: {
      create: async (payload) => ({ _id: 'notification-1', ...payload, status: 'UNREAD' })
    },
    emailService: {
      sendTemplateEmail: async () => ({ sent: false, status: 'SKIPPED' })
    },
    userModel: {
      findById: () => createQuery({ pushToken: 'ExponentPushToken[expired-token]' }),
      updateOne: async (...args) => {
        updates.push(args)
      }
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        data: {
          status: 'error',
          message: 'The device is not registered',
          details: { error: 'DeviceNotRegistered' }
        }
      })
    }),
    logger: createLogger()
  })

  const result = await service.notifyUser({
    user: { _id: 'user-1' },
    title: 'Workshop assignment',
    message: 'You were assigned as a speaker.',
    channels: ['IN_APP']
  })

  assert.equal(result.notification.id, 'notification-1')
  assert.equal(result.push.sent, false)
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0][0], {
    _id: 'user-1',
    pushToken: 'ExponentPushToken[expired-token]'
  })
})

test('register and unregister push token update the authenticated user', async () => {
  const updates = []
  const userModel = {
    findByIdAndUpdate: (id, update) => {
      updates.push({ id, update })
      return createQuery(update.$set
        ? { _id: id, ...update.$set }
        : { _id: id })
    }
  }
  const service = createNotificationService({ userModel, logger: createLogger() })
  const userId = '000000000000000000000001'

  const registered = await service.registerPushToken({
    userId,
    token: 'ExponentPushToken[new-token]',
    platform: 'android'
  })
  const unregistered = await service.unregisterPushToken(userId)

  assert.equal(registered.registered, true)
  assert.equal(registered.platform, 'android')
  assert.equal(unregistered.unregistered, true)
  assert.equal(updates.length, 2)
  assert.equal(updates[0].update.$set.pushToken, 'ExponentPushToken[new-token]')
  assert.deepEqual(updates[1].update.$unset, {
    pushToken: 1,
    pushPlatform: 1,
    pushTokenUpdatedAt: 1
  })
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
  const pushRequests = []
  const existing = {
    _id: 'notification-1',
    userId: 'user-1',
    title: 'Competition starts soon',
    message: 'Your competition starts in 1 hour.',
    type: 'DEADLINE',
    status: 'UNREAD',
    dedupeKey: 'competition-start:competition-1:1h:user-1',
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
      emitToUser: (userId, competition, payload) => {
        emitted.push({ userId, competition, payload })
        return true
      }
    },
    userModel: {
      findById: () => createQuery({ pushToken: 'ExponentPushToken[device-token]' })
    },
    fetchImpl: async (...args) => {
      pushRequests.push(args)
      return { ok: true, json: async () => ({ data: { status: 'ok' } }) }
    },
    logger: createLogger()
  })

  const result = await service.notifyUser({
    user: {
      _id: 'user-1',
      email: 'participant@example.com',
      fullName: 'Participant User'
    },
    title: 'Competition starts soon',
    message: 'Your competition starts in 1 hour.',
    type: 'DEADLINE',
    dedupeKey: existing.dedupeKey,
    channels: ['IN_APP']
  })

  assert.equal(created.length, 0)
  assert.equal(result.notification.id, 'notification-1')
  assert.equal(result.notification.dedupeKey, existing.dedupeKey)
  assert.equal(result.email, null)
  assert.equal(emitted.length, 0)
  assert.equal(pushRequests.length, 0)
})

test('mark read operations emit notification socket competitions', async () => {
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
      emitToUser: (userId, competition, payload) => {
        emitted.push({ userId, competition, payload })
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
  assert.equal(emitted[0].competition, 'notification_read')
  assert.equal(emitted[0].payload.status, 'READ')
  assert.equal(emitted[1].competition, 'notifications_read_all')
  assert.equal(emitted[1].payload.modifiedCount, 2)
})

test('sendCompetitionInvitations deduplicates recipients and summarizes delivery', async () => {
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

  const result = await service.sendCompetitionInvitations({
    competition: {
      _id: 'competition-1',
      title: 'SEAL Hackathon'
    },
    emails: ['participant@example.com', 'participant@example.com', 'bad@example.com'],
    actor: { id: 'coordinator-1' }
  })

  assert.equal(result.total, 2)
  assert.equal(result.sent, 1)
  assert.equal(result.failed, 1)
  assert.equal(sent.length, 2)
  assert.equal(sent[0].template, EMAIL_TEMPLATE_KEYS.COMPETITION_INVITATION)
})
