import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createParticipantService } from '../src/modules/participants/participant.service.js'

const createRepository = ({
  eventOverrides = {}
} = {}) => {
  const records = new Map()
  let checkInQrSession = null
  let sequence = 1

  const event = {
    _id: '000000000000000000000201',
    title: 'SEAL Event',
    status: 'OPEN_REGISTRATION',
    registrationStart: new Date('2026-06-01T00:00:00.000Z'),
    registrationEnd: new Date('2026-06-30T00:00:00.000Z'),
    startDate: new Date('2026-06-22T07:00:00.000Z'),
    endDate: new Date('2026-06-22T18:00:00.000Z'),
    ...eventOverrides
  }
  const participantRole = { name: 'PARTICIPANT' }
  const userA = { _id: '000000000000000000000301', email: 'a@example.com', fullName: 'User A', status: 'ACTIVE', roles: [participantRole] }
  const userB = { _id: '000000000000000000000302', email: 'b@example.com', fullName: 'User B', status: 'ACTIVE', roles: [participantRole] }
  const team = { _id: '000000000000000000000401', eventId: event._id, name: 'Code Wizards', status: 'CONFIRMED' }
  const auditLogs = []

  return {
    count: async () => records.size,
    findAll: async () => [...records.values()],
    findById: async (id) => records.get(id) || null,
    findByEventAndUser: async ({ eventId, userId }) => {
      return [...records.values()].find(record => record.eventId === eventId && record.userId === userId) || null
    },
    create: async (data) => {
      const id = String(sequence).padStart(24, '0')
      const record = {
        teamId: null,
        teamRole: 'MEMBER',
        isGraduated: false,
        consentMediaUse: false,
        eligibilityStatus: 'PENDING',
        attendedActivities: [],
        checkInStatus: 'NOT_CHECKED_IN',
        githubAccessStatus: 'NOT_GRANTED',
        status: 'INVITED',
        ...data,
        _id: id
      }
      records.set(id, record)
      sequence += 1
      return record
    },
    updateById: async (id, data) => {
      const existing = records.get(id)
      if (!existing) return null
      const updated = { ...existing, ...data, _id: id }
      records.set(id, updated)
      return updated
    },
    upsertCheckInQrSession: async (data) => {
      checkInQrSession = { ...data }
      return checkInQrSession
    },
    findCheckInQrSessionByTokenHash: async (tokenHash) => {
      return checkInQrSession?.tokenHash === tokenHash ? checkInQrSession : null
    },
    checkInParticipantByEventAndUser: async ({ eventId, userId, now }) => {
      const record = [...records.values()].find(item => item.eventId === eventId && item.userId === userId)
      if (!record || record.checkInStatus !== 'NOT_CHECKED_IN') {
        return null
      }

      const updated = {
        ...record,
        checkInStatus: 'CHECKED_IN',
        checkedInAt: now,
        checkedInBy: userId
      }
      records.set(record._id, updated)
      return updated
    },
    getCheckInQrSession: () => checkInQrSession,
    deleteById: async (id) => records.delete(id),
    findEventById: async (id) => id === event._id ? event : null,
    findUserById: async (id) => {
      if (id === userA._id) return userA
      if (id === userB._id) return userB
      return null
    },
    findTeamById: async (id) => id === team._id ? team : null,
    findConfirmedTeamIds: async ({ eventId } = {}) => eventId === event._id ? [team._id] : [],
    createAuditLog: async (entry) => {
      auditLogs.push(entry)
      return entry
    },
    getAuditLogs: () => auditLogs
  }
}

const createAuditRepository = (records = []) => ({
  async create(entry) {
    records.push(entry)
    return entry
  }
})

test('listParticipants can limit check-in data to confirmed teams', async () => {
  const repository = createRepository()
  let receivedFilter = null
  repository.findAll = async ({ filter }) => {
    receivedFilter = filter
    return []
  }
  repository.count = async () => 0
  const service = createParticipantService({ repository, now: () => new Date('2026-06-10T00:00:00.000Z') })

  await service.listParticipants({
    eventId: '000000000000000000000201',
    confirmedTeamsOnly: true
  })

  assert.deepEqual(receivedFilter.teamId, { $in: ['000000000000000000000401'] })
})

test('createParticipant lets a user register themselves for an event', async () => {
  const service = createParticipantService({
    repository: createRepository(),
    now: () => new Date('2026-06-10T00:00:00.000Z')
  })

  const participant = await service.createParticipant({
    eventId: '000000000000000000000201',
    consentMediaUse: true
  }, {
    id: '000000000000000000000301',
    permissions: ['EVENT_VIEW']
  })

  assert.equal(participant.userId, '000000000000000000000301')
  assert.equal(participant.eventId, '000000000000000000000201')
  assert.equal(participant.consentMediaUse, true)
  assert.equal(participant.status, 'INVITED')
})

test('createParticipant rejects registering another user without approver permission', async () => {
  const service = createParticipantService({
    repository: createRepository(),
    now: () => new Date('2026-06-10T00:00:00.000Z')
  })

  await assert.rejects(
    service.createParticipant({
      eventId: '000000000000000000000201',
      userId: '000000000000000000000302'
    }, {
      id: '000000000000000000000301',
      permissions: ['EVENT_VIEW']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'FORBIDDEN' &&
      error.errors.includes('You do not have permission to register another user as a participant')
  )
})

test('getMyParticipant returns only the authenticated user registration for an event', async () => {
  const service = createParticipantService({
    repository: createRepository(),
    now: () => new Date('2026-06-10T00:00:00.000Z')
  })
  await service.createParticipant({
    eventId: '000000000000000000000201'
  }, {
    id: '000000000000000000000301',
    permissions: ['EVENT_VIEW']
  })

  const participant = await service.getMyParticipant('000000000000000000000201', {
    id: '000000000000000000000301'
  })

  assert.equal(participant.userId, '000000000000000000000301')
})

test('updateAttendance and updateGithubAccessStatus persist participant lifecycle updates', async () => {
  const repository = createRepository()
  const service = createParticipantService({
    repository,
    now: () => new Date('2026-06-10T00:00:00.000Z')
  })

  const created = await service.createParticipant({
    eventId: '000000000000000000000201',
    userId: '000000000000000000000301'
  }, {
    id: '000000000000000000000301',
    permissions: ['PARTICIPANT_APPROVE']
  })

  const attendanceUpdated = await service.updateAttendance(created.id, ['WORKSHOP', 'CODING'])
  const githubUpdated = await service.updateGithubAccessStatus(created.id, 'GRANTED')

  assert.deepEqual(attendanceUpdated.attendedActivities, ['WORKSHOP', 'CODING'])
  assert.equal(githubUpdated.githubAccessStatus, 'GRANTED')
})

const createQrTestService = ({ currentTime = new Date('2026-06-22T08:00:00.000Z') } = {}) => {
  const repository = createRepository({
    eventOverrides: { status: 'ONGOING' }
  })
  let nowValue = currentTime
  const auditLogs = []
  const service = createParticipantService({
    repository,
    auditLogRepository: createAuditRepository(auditLogs),
    qrEncoder: { toDataURL: async payload => `data:image/png;base64,${payload}` },
    randomToken: () => 'fixed-check-in-token-with-enough-entropy-123456789',
    now: () => nowValue,
    qrExpiresMinutes: 5,
    checkInUrlBase: 'https://app.example.test'
  })

  return {
    repository,
    service,
    auditLogs,
    setNow: value => { nowValue = value }
  }
}

const createQrParticipant = async (service) => {
  return await service.createParticipant({
    eventId: '000000000000000000000201',
    teamId: '000000000000000000000401',
    overrideReason: 'seed participant for check-in test'
  }, {
    id: '000000000000000000000301',
    permissions: ['PARTICIPANT_APPROVE']
  })
}

test('generateCheckInQr lets a coordinator generate an expiring event QR without storing the raw token', async () => {
  const { repository, service } = createQrTestService()

  const qr = await service.generateCheckInQr('000000000000000000000201', {
    id: '000000000000000000000999',
    permissions: ['PARTICIPANT_APPROVE']
  })
  const stored = repository.getCheckInQrSession()
  const qrUrl = new URL(qr.qrPayload)

  assert.equal(qr.eventId, '000000000000000000000201')
  assert.equal(qrUrl.origin, 'https://app.example.test')
  assert.equal(qrUrl.pathname, '/participant')
  assert.equal(qrUrl.searchParams.get('checkInToken'), 'wdp301-checkin:fixed-check-in-token-with-enough-entropy-123456789')
  assert.match(qr.qrCodeDataUrl, /^data:image\/png;base64,/)
  assert.equal(qr.expiresAt.toISOString(), '2026-06-22T08:05:00.000Z')
  assert.equal(stored.tokenHash, crypto.createHash('sha256').update('fixed-check-in-token-with-enough-entropy-123456789').digest('hex'))
  assert.equal(stored.tokenHash.includes('fixed-check-in-token'), false)
})

test('participant scans the event QR to check in themselves and cannot check in twice', async () => {
  const { service } = createQrTestService()
  const participant = await createQrParticipant(service)
  const qr = await service.generateCheckInQr(participant.eventId, {
    id: '000000000000000000000999',
    permissions: ['PARTICIPANT_APPROVE']
  })

  const checkedIn = await service.scanCheckInQr(qr.qrPayload, {
    id: participant.userId,
    permissions: []
  })

  assert.equal(checkedIn.checkInStatus, 'CHECKED_IN')
  assert.equal(checkedIn.checkedInBy, participant.userId)

  await assert.rejects(
    service.scanCheckInQr(qr.qrPayload, { id: participant.userId }),
    error => error instanceof ApiError && error.code === 'PARTICIPANT_ALREADY_CHECKED_IN'
  )
})

test('the same event QR checks in multiple different participants', async () => {
  const { service } = createQrTestService()
  const participantA = await createQrParticipant(service)
  const participantB = await service.createParticipant({
    eventId: participantA.eventId,
    teamId: '000000000000000000000401',
    overrideReason: 'seed participant for check-in test'
  }, {
    id: '000000000000000000000302',
    permissions: ['PARTICIPANT_APPROVE']
  })
  const qr = await service.generateCheckInQr(participantA.eventId, {
    id: '000000000000000000000999',
    permissions: ['PARTICIPANT_APPROVE']
  })

  const checkedInA = await service.scanCheckInQr(qr.qrPayload, { id: participantA.userId })
  const checkedInB = await service.scanCheckInQr(qr.qrPayload, { id: participantB.userId })

  assert.equal(checkedInA.checkInStatus, 'CHECKED_IN')
  assert.equal(checkedInB.checkInStatus, 'CHECKED_IN')
})

test('scanCheckInQr rejects an expired token', async () => {
  const { service, setNow } = createQrTestService()
  const participant = await createQrParticipant(service)
  const qr = await service.generateCheckInQr(participant.eventId, {
    id: '000000000000000000000999',
    permissions: ['PARTICIPANT_APPROVE']
  })

  setNow(new Date('2026-06-22T08:05:01.000Z'))

  await assert.rejects(
    service.scanCheckInQr(qr.qrPayload, { id: participant.userId }),
    error => error instanceof ApiError && error.code === 'CHECK_IN_QR_EXPIRED' && error.errors.includes('Check-in QR has expired')
  )
})

test('QR and manual check-in reject participants outside confirmed teams', async () => {
  const { service } = createQrTestService()
  const participant = await service.createParticipant({
    eventId: '000000000000000000000201',
    overrideReason: 'seed participant for check-in test'
  }, {
    id: '000000000000000000000301',
    permissions: ['PARTICIPANT_APPROVE']
  })
  const qr = await service.generateCheckInQr(participant.eventId, {
    id: '000000000000000000000999',
    permissions: ['PARTICIPANT_APPROVE']
  })

  await assert.rejects(
    service.scanCheckInQr(qr.qrPayload, { id: participant.userId }),
    error => error instanceof ApiError && error.code === 'BAD_REQUEST' && error.errors.includes('Only members of confirmed teams can check in')
  )
  await assert.rejects(
    service.updateCheckInStatus(participant.id, 'CHECKED_IN'),
    error => error instanceof ApiError && error.code === 'BAD_REQUEST' && error.errors.includes('Only members of confirmed teams can check in')
  )
})

test('check-in QR can be generated while event is ONGOING without a CHECK_IN timeline', async () => {
  const repository = createRepository({
    eventOverrides: { status: 'ONGOING' }
  })
  const service = createParticipantService({
    repository,
    now: () => new Date('2026-06-22T08:00:00.000Z')
  })

  const qr = await service.generateCheckInQr('000000000000000000000201', {
    id: '000000000000000000000999',
    permissions: ['PARTICIPANT_APPROVE']
  })

  assert.equal(qr.eventId, '000000000000000000000201')
})

test('manual admin check-in override requires a reason and writes audit log', async () => {
  const repository = createRepository({
    eventOverrides: { status: 'COMPLETED' }
  })
  const auditLogs = []
  const service = createParticipantService({
    repository,
    auditLogRepository: createAuditRepository(auditLogs),
    now: () => new Date('2026-06-22T10:00:00.000Z')
  })
  const participant = await service.createParticipant({
    eventId: '000000000000000000000201',
    teamId: '000000000000000000000401',
    overrideReason: 'late registration correction'
  }, {
    id: '000000000000000000000301',
    permissions: ['PARTICIPANT_APPROVE']
  })

  await assert.rejects(
    service.updateCheckInStatus(participant.id, 'CHECKED_IN', {
      id: '000000000000000000000999',
      roles: ['ADMIN'],
      permissions: ['PARTICIPANT_APPROVE']
    }),
    error => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Check-in is only available while the event is ONGOING')
  )

  const checkedIn = await service.updateCheckInStatus(participant.id, 'CHECKED_IN', {
    id: '000000000000000000000999',
    roles: ['ADMIN'],
    permissions: ['PARTICIPANT_APPROVE']
  }, {
    overrideReason: 'verified attendee at help desk'
  })

  assert.equal(checkedIn.checkInStatus, 'CHECKED_IN')
  assert.equal(auditLogs.some(log => log.action === 'CHECK_IN_WINDOW_OVERRIDE'), true)
})

test('generateCheckInQr rejects users without coordinator approval permission', async () => {
  const { service } = createQrTestService()

  await assert.rejects(
    service.generateCheckInQr('000000000000000000000201', {
      id: '000000000000000000000302',
      permissions: []
    }),
    error => error instanceof ApiError && error.code === 'FORBIDDEN'
  )
})
