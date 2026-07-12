import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createTimelineService } from '../src/modules/timelines/timeline.service.js'

const createRepository = () => {
  const records = new Map()
  let sequence = 1
  const participantEventIds = new Set()
  const openRegistrationEventIds = new Set()
  const nonDraftEventIds = new Set()

  const getId = (value) => value?._id?.toString?.() || value?.toString?.()
  const matchesFilter = (item, filter = {}) => Object.entries(filter).every(([key, value]) => {
    const itemValue = item[key]
    if (value && typeof value === 'object' && Array.isArray(value.$in)) {
      return value.$in.map(getId).includes(getId(itemValue))
    }
    return getId(itemValue) === getId(value)
  })

  return {
    count: async (filter = {}) => [...records.values()].filter(record => matchesFilter(record, filter)).length,
    findAll: async ({ filter = {} } = {}) => [...records.values()].filter(record => matchesFilter(record, filter)),
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
    },
    findEventIdsForParticipant: async () => [...participantEventIds],
    findOpenRegistrationEventIds: async () => [...openRegistrationEventIds],
    findNonDraftEventIds: async () => [...nonDraftEventIds],
    seedVisibility: ({ participantEvents = [], openRegistrationEvents = [], nonDraftEvents = [] } = {}) => {
      participantEvents.forEach(eventId => participantEventIds.add(eventId))
      openRegistrationEvents.forEach(eventId => openRegistrationEventIds.add(eventId))
      nonDraftEvents.forEach(eventId => nonDraftEventIds.add(eventId))
    }
  }
}

const eventService = {
  getRawEventById: async (id) => ({
    _id: id,
    title: 'SEAL Event',
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-06-30T23:59:59.000Z')
  })
}

test('createTimeline stores timeline for an existing event', async () => {
  const service = createTimelineService({
    repository: createRepository(),
    eventService
  })

  const timeline = await service.createTimeline({
    eventId: '000000000000000000000101',
    title: 'Registration Window',
    eventType: 'CHECK_IN',
    startTime: '2026-06-01T00:00:00.000Z',
    endTime: '2026-06-02T00:00:00.000Z'
  })

  assert.equal(timeline.title, 'Registration Window')
  assert.equal(timeline.eventId, '000000000000000000000101')
  assert.equal(timeline.eventType, 'CHECK_IN')
})

test('updateTimeline rejects invalid date range', async () => {
  const repository = createRepository()
  const service = createTimelineService({ repository, eventService })

  const created = await service.createTimeline({
    eventId: '000000000000000000000101',
    title: 'Opening Ceremony'
  })

  await assert.rejects(
    service.updateTimeline(created.id, {
      startTime: '2026-06-03T10:00:00.000Z',
      endTime: '2026-06-03T09:00:00.000Z'
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('startTime must be before or equal to endTime')
  )
})

test('listTimelines scopes participant to joined or open-registration events', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantEvents: ['000000000000000000000101'],
    openRegistrationEvents: ['000000000000000000000102']
  })
  const service = createTimelineService({ repository, eventService })

  await service.createTimeline({
    eventId: '000000000000000000000101',
    title: 'Joined Event Timeline'
  })
  await service.createTimeline({
    eventId: '000000000000000000000103',
    title: 'Draft Event Timeline'
  })

  const result = await service.listTimelines({}, {
    id: '000000000000000000000201',
    roles: ['PARTICIPANT']
  })

  assert.equal(result.timelines.length, 1)
  assert.equal(result.timelines[0].eventId, '000000000000000000000101')
})

test('getTimelineById hides event children outside actor scope', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantEvents: ['000000000000000000000101']
  })
  const service = createTimelineService({ repository, eventService })

  const created = await service.createTimeline({
    eventId: '000000000000000000000103',
    title: 'Unrelated Timeline'
  })

  await assert.rejects(
    () => service.getTimelineById(created.id, {
      id: '000000000000000000000201',
      roles: ['PARTICIPANT']
    }),
    (error) => error instanceof ApiError && error.code === 'NOT_FOUND'
  )
})

test('timeline validates event window and status transitions', async () => {
  const repository = createRepository()
  const service = createTimelineService({ repository, eventService })

  await assert.rejects(
    service.createTimeline({
      eventId: '000000000000000000000101',
      title: 'Too Late',
      startTime: '2026-07-01T00:00:00.000Z',
      endTime: '2026-07-01T01:00:00.000Z'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Timeline endTime must be within the event date window')
  )

  await assert.rejects(
    service.createTimeline({
      eventId: '000000000000000000000101',
      title: 'Already Done',
      status: 'COMPLETED'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Timeline events must be created in SCHEDULED status')
  )

  const created = await service.createTimeline({
    eventId: '000000000000000000000101',
    title: 'Opening Ceremony',
    startTime: '2026-06-03T09:00:00.000Z',
    endTime: '2026-06-03T10:00:00.000Z'
  })

  await assert.rejects(
    service.updateTimeline(created.id, { status: 'COMPLETED' }),
    error => error instanceof ApiError &&
      error.errors.includes('Invalid timeline status transition from SCHEDULED to COMPLETED')
  )
})
