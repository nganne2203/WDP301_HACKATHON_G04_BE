import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createEventService } from '../src/modules/events/event.service.js'

const createRepository = () => {
  const records = new Map()
  let sequence = 1

  return {
    count: async () => records.size,
    findAll: async () => [...records.values()],
    findById: async (id) => records.get(id) || null,
    findEventIdsForParticipant: async () => [],
    findOpenRegistrationEventIds: async () => [],
    create: async (data) => {
      const id = String(sequence).padStart(24, '0')
      const record = { ...data, _id: id }
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
    deleteById: async (id) => {
      records.delete(id)
    }
  }
}

const testAuditLogRepository = {
  async create(entry) {
    return entry
  }
}

const createService = (overrides = {}) => {
  return createEventService({
    repository: createRepository(),
    notificationService: { sendEventInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    ...overrides
  })
}

test('createEvent stores dynamic competition config and syncs legacy finalist fields', async () => {
  const service = createService()

  const event = await service.createEvent({
    title: 'SEAL Hackathon Spring 2026',
    season: 'SPRING',
    year: 2026,
    competitionConfig: {
      boardCount: 3,
      maxTeamsPerBoard: 8,
      finalistCount: 6,
      finalistsPerBoard: 2,
      finalistSelectionMode: 'FIXED_PER_BOARD',
      rankingScopes: ['TEAM', 'CHAPTER'],
      tieBreakRule: '10-minute mini test'
    }
  }, { id: '000000000000000000000099' })

  assert.equal(event.competitionConfig.boardCount, 3)
  assert.equal(event.competitionConfig.trackCount, 3)
  assert.equal(event.competitionConfig.finalistCount, 6)
  assert.equal(event.competitionConfig.finalistsPerBoard, 2)
  assert.deepEqual(event.competitionConfig.rankingScopes, ['TEAM', 'CHAPTER'])
  assert.equal(event.finalistSlotsPerTrack, 2)
  assert.equal(event.totalFinalistSlots, 6)
})

test('createEvent derives competition config from legacy finalist fields for backward compatibility', async () => {
  const service = createService()

  const event = await service.createEvent({
    title: 'Legacy-Compatible Event',
    finalistSlotsPerTrack: 5,
    totalFinalistSlots: 10
  }, { id: '000000000000000000000099' })

  assert.equal(event.competitionConfig.finalistsPerBoard, 5)
  assert.equal(event.competitionConfig.finalistCount, 10)
  assert.equal(event.competitionConfig.finalistSelectionMode, 'FIXED_PER_BOARD')
  assert.deepEqual(event.competitionConfig.rankingScopes, ['TEAM'])
})

test('only admin and coordinators can list or retrieve draft events', async () => {
  const repository = createRepository()
  const service = createEventService({ repository, notificationService: { sendEventInvitations: async () => ({}) }, auditLogRepository: testAuditLogRepository })
  const draft = await service.createEvent({ title: 'Hidden draft', status: 'DRAFT' }, { id: '000000000000000000000099' })
  let receivedFilter = null
  const originalFindAll = repository.findAll
  repository.findAll = async ({ filter }) => {
    receivedFilter = filter
    return await originalFindAll({ filter })
  }

  await service.listEvents({}, { roles: ['PARTICIPANT'] })
  assert.deepEqual(receivedFilter.status, { $ne: 'DRAFT' })

  await service.listEvents({ status: 'DRAFT' }, { roles: ['MENTOR'] })
  assert.deepEqual(receivedFilter.status, { $in: [] })

  await assert.rejects(
    service.getEventById(draft.id, { roles: ['PARTICIPANT'] }),
    error => error instanceof ApiError && error.code === 'NOT_FOUND'
  )

  const coordinatorDraft = await service.getEventById(draft.id, { roles: ['COORDINATOR'] })
  assert.equal(coordinatorDraft.id, draft.id)
})

test('participant can only list and retrieve events they joined or can register for', async () => {
  const repository = createRepository()
  const service = createEventService({ repository, notificationService: { sendEventInvitations: async () => ({}) }, auditLogRepository: testAuditLogRepository })
  const event = await service.createEvent({ title: 'Joined event' }, { id: '000000000000000000000099' })
  await repository.updateById(event.id, { status: 'COMPLETED' })
  let receivedFilter = null
  repository.findAll = async ({ filter }) => {
    receivedFilter = filter
    return []
  }
  repository.count = async () => 0

  await service.listEvents({}, { id: '000000000000000000000301', roles: ['PARTICIPANT'] })
  assert.deepEqual(receivedFilter._id, { $in: [] })
  await assert.rejects(
    service.getEventById(event.id, { id: '000000000000000000000301', roles: ['PARTICIPANT'] }),
    error => error instanceof ApiError && error.code === 'NOT_FOUND'
  )

  repository.findEventIdsForParticipant = async () => [event.id]
  const joinedEvent = await service.getEventById(event.id, { id: '000000000000000000000301', roles: ['PARTICIPANT'] })
  assert.equal(joinedEvent.id, event.id)

  const openEvent = await service.createEvent({ title: 'Open event' }, { id: '000000000000000000000099' })
  await repository.updateById(openEvent.id, { status: 'OPEN_REGISTRATION' })
  repository.findOpenRegistrationEventIds = async () => [openEvent.id]
  const visibleOpenEvent = await service.getEventById(openEvent.id, { id: '000000000000000000000301', roles: ['PARTICIPANT'] })
  assert.equal(visibleOpenEvent.id, openEvent.id)

  repository.findEventIdsForParticipant = async () => []
  await assert.rejects(
    service.getEventById(event.id, { id: '000000000000000000000301', roles: ['USER'] }),
    error => error instanceof ApiError && error.code === 'NOT_FOUND'
  )
})

test('updateEvent rejects invalid fixed-per-board finalist math', async () => {
  const service = createService()

  const created = await service.createEvent({
    title: 'SEAL Hackathon Fall 2025',
    competitionConfig: {
      boardCount: 2,
      finalistCount: 10,
      finalistsPerBoard: 5,
      finalistSelectionMode: 'FIXED_PER_BOARD'
    }
  }, { id: '000000000000000000000099' })

  await assert.rejects(
    service.updateEvent(created.id, {
      competitionConfig: {
        boardCount: 3,
        finalistCount: 10,
        finalistsPerBoard: 2,
        finalistSelectionMode: 'FIXED_PER_BOARD'
      }
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('competitionConfig.finalistCount must equal boardCount * finalistsPerBoard for FIXED_PER_BOARD mode')
  )
})

test('updateEventStatus rejects unconfirmed teams when registration closes', async () => {
  const repository = createRepository()
  const rejectedEvents = []
  const auditLogs = []
  const service = createEventService({
    repository,
    notificationService: { sendEventInvitations: async () => ({}) },
    auditLogRepository: {
      async create(entry) {
        auditLogs.push(entry)
        return entry
      }
    },
    teamService: {
      rejectUnconfirmedTeamsForRegistrationClosure: async (payload) => {
        rejectedEvents.push(payload)
        return { rejectedCount: 2 }
      }
    }
  })

  const created = await service.createEvent({
    title: 'SEAL Hackathon Registration'
  }, { id: '000000000000000000000099' })

  await service.updateEventStatus(created.id, 'OPEN_REGISTRATION', { id: '000000000000000000000099' })
  const event = await service.updateEventStatus(created.id, 'REGISTRATION_CLOSED')

  assert.equal(event.status, 'REGISTRATION_CLOSED')
  assert.equal(event.registrationCloseReason, 'MANUALLY_CLOSED')
  assert.equal(rejectedEvents.length, 1)
  assert.equal(rejectedEvents[0].event._id, created.id)
  assert.equal(rejectedEvents[0].reason, 'Registration has closed before this team was fully confirmed.')
  assert.deepEqual(auditLogs.map(log => log.metadata.toStatus), ['OPEN_REGISTRATION', 'REGISTRATION_CLOSED'])
})

test('updateEvent rejects direct status changes outside the lifecycle endpoint', async () => {
  const repository = createRepository()
  const service = createEventService({
    repository,
    notificationService: { sendEventInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository
  })

  const created = await service.createEvent({
    title: 'SEAL Hackathon Update Close'
  }, { id: '000000000000000000000099' })

  await assert.rejects(
    service.updateEvent(created.id, { status: 'REGISTRATION_CLOSED' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Use the event status workflow endpoint to change event status')
  )
})

test('createEvent rejects non-draft lifecycle status', async () => {
  const service = createService()

  await assert.rejects(
    service.createEvent({
      title: 'Invalid Direct Completed Event',
      status: 'COMPLETED'
    }, { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Events must be created in DRAFT status and moved through the lifecycle workflow')
  )
})

test('updateEventStatus rejects skipped lifecycle transitions and impossible manual timing', async () => {
  const service = createService({
    nowProvider: () => new Date('2026-07-12T00:00:00.000Z')
  })

  const created = await service.createEvent({
    title: 'Lifecycle Test Event',
    registrationStart: '2026-07-13T00:00:00.000Z',
    registrationEnd: '2026-07-14T00:00:00.000Z',
    startDate: '2026-07-15T00:00:00.000Z'
  }, { id: '000000000000000000000099' })

  await assert.rejects(
    service.updateEventStatus(created.id, 'SCORING', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Invalid event status transition from DRAFT to SCORING')
  )

  await assert.rejects(
    service.updateEventStatus(created.id, 'OPEN_REGISTRATION', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Registration cannot be opened before registrationStart')
  )
})

test('updateEventStatus requires scoring round, board, and submission before event scoring', async () => {
  const repository = createRepository()
  const service = createEventService({
    repository,
    notificationService: { sendEventInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: {
      async findOne() {
        return null
      }
    },
    boardModel: {
      async findOne() {
        return null
      }
    },
    submissionModel: {
      async findOne() {
        return null
      }
    }
  })

  const created = await service.createEvent({
    title: 'Scoring Readiness Event'
  }, { id: '000000000000000000000099' })
  await repository.updateById(created.id, { status: 'ONGOING' })

  await assert.rejects(
    service.updateEventStatus(created.id, 'SCORING', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('At least one round with an active rubric must be in SCORING before the event can enter SCORING')
  )
})

test('updateEventStatus verifies scoring board judges are active judges', async () => {
  const repository = createRepository()
  const service = createEventService({
    repository,
    notificationService: { sendEventInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: {
      async findOne() {
        return {
          _id: '000000000000000000000201',
          eventId: '000000000000000000000101',
          status: 'SCORING',
          rubricId: '000000000000000000000301'
        }
      }
    },
    boardModel: {
      async find() {
        return [{
          _id: '000000000000000000000401',
          eventId: '000000000000000000000101',
          roundId: '000000000000000000000201',
          status: 'SCORING',
          teamIds: ['000000000000000000000501'],
          judgeIds: ['000000000000000000000601']
        }]
      }
    },
    submissionModel: {
      async findOne() {
        return { _id: '000000000000000000000701', status: 'SUBMITTED' }
      }
    },
    userModel: {
      async find() {
        return [{ _id: '000000000000000000000601', status: 'ACTIVE', roles: [{ name: 'PARTICIPANT' }] }]
      }
    }
  })

  const created = await service.createEvent({
    title: 'Scoring Judge Readiness Event'
  }, { id: '000000000000000000000099' })
  await repository.updateById(created.id, { status: 'ONGOING' })

  await assert.rejects(
    service.updateEventStatus(created.id, 'SCORING', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('All scoring board judges must have ACTIVE accounts and the JUDGE role')
  )
})
