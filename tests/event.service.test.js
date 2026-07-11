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

test('createEvent stores dynamic competition config and syncs legacy finalist fields', async () => {
  const repository = createRepository()
  const service = createEventService({ repository, notificationService: { sendEventInvitations: async () => ({}) } })

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
  const repository = createRepository()
  const service = createEventService({ repository, notificationService: { sendEventInvitations: async () => ({}) } })

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
  const service = createEventService({ repository, notificationService: { sendEventInvitations: async () => ({}) } })
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

test('updateEvent rejects invalid fixed-per-board finalist math', async () => {
  const repository = createRepository()
  const service = createEventService({ repository, notificationService: { sendEventInvitations: async () => ({}) } })

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
  const service = createEventService({
    repository,
    notificationService: { sendEventInvitations: async () => ({}) },
    teamService: {
      rejectUnconfirmedTeamsForRegistrationClosure: async (payload) => {
        rejectedEvents.push(payload)
        return { rejectedCount: 2 }
      }
    }
  })

  const created = await service.createEvent({
    title: 'SEAL Hackathon Registration',
    status: 'OPEN_REGISTRATION'
  }, { id: '000000000000000000000099' })

  const event = await service.updateEventStatus(created.id, 'REGISTRATION_CLOSED')

  assert.equal(event.status, 'REGISTRATION_CLOSED')
  assert.equal(event.registrationCloseReason, 'MANUALLY_CLOSED')
  assert.equal(rejectedEvents.length, 1)
  assert.equal(rejectedEvents[0].event._id, created.id)
  assert.equal(rejectedEvents[0].reason, 'Registration has closed before this team was fully confirmed.')
})

test('updateEvent rejects unconfirmed teams when status is changed to registration closed', async () => {
  const repository = createRepository()
  const rejectedEvents = []
  const service = createEventService({
    repository,
    notificationService: { sendEventInvitations: async () => ({}) },
    teamService: {
      rejectUnconfirmedTeamsForRegistrationClosure: async (payload) => {
        rejectedEvents.push(payload)
        return { rejectedCount: 1 }
      }
    }
  })

  const created = await service.createEvent({
    title: 'SEAL Hackathon Update Close',
    status: 'OPEN_REGISTRATION'
  }, { id: '000000000000000000000099' })

  await service.updateEvent(created.id, {
    status: 'REGISTRATION_CLOSED'
  })

  assert.equal(rejectedEvents.length, 1)
  assert.equal(rejectedEvents[0].event._id, created.id)
  assert.equal(rejectedEvents[0].reason, 'Registration has closed before this team was fully confirmed.')
})
