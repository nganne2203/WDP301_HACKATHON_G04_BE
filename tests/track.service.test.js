import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createTrackService } from '../src/modules/tracks/track.service.js'

const getId = (value) => value?._id?.toString?.() || value?.toString?.()

const matchesFilter = (item, filter = {}) => Object.entries(filter).every(([key, value]) => {
  const itemValue = item[key]
  if (value && typeof value === 'object' && Array.isArray(value.$in)) {
    return value.$in.map(getId).includes(getId(itemValue))
  }
  return getId(itemValue) === getId(value)
})

const createRepository = () => {
  const records = new Map()
  let sequence = 1
  const participantEventIds = new Set()
  const openRegistrationEventIds = new Set()
  const nonDraftEventIds = new Set()

  return {
    count: async (filter = {}) => [...records.values()].filter(record => matchesFilter(record, filter)).length,
    findAll: async ({ filter = {} } = {}) => [...records.values()].filter(record => matchesFilter(record, filter)),
    findById: async (id) => records.get(id) || null,
    findByEventAndName: async (eventId, name) => [...records.values()]
      .find(record => getId(record.eventId) === getId(eventId) && record.name === name) || null,
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
  getRawEventById: async (id) => ({ _id: id, title: 'SEAL Event' })
}

test('listTracks scopes participant to joined or open-registration events', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantEvents: ['000000000000000000000101'],
    openRegistrationEvents: ['000000000000000000000102']
  })
  const service = createTrackService({ repository, eventService })

  await service.createTrack({
    eventId: '000000000000000000000101',
    name: 'Joined Event Track'
  })
  await service.createTrack({
    eventId: '000000000000000000000103',
    name: 'Draft Event Track'
  })

  const result = await service.listTracks({}, {
    id: '000000000000000000000201',
    roles: ['PARTICIPANT']
  })

  assert.equal(result.tracks.length, 1)
  assert.equal(result.tracks[0].event.id, '000000000000000000000101')
})

test('getTrackById hides event children outside actor scope', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantEvents: ['000000000000000000000101']
  })
  const service = createTrackService({ repository, eventService })

  const created = await service.createTrack({
    eventId: '000000000000000000000103',
    name: 'Unrelated Track'
  })

  await assert.rejects(
    () => service.getTrackById(created.id, {
      id: '000000000000000000000201',
      roles: ['PARTICIPANT']
    }),
    (error) => error instanceof ApiError && error.code === 'NOT_FOUND'
  )
})

test('track status follows the configured workflow', async () => {
  const repository = createRepository()
  const service = createTrackService({ repository, eventService })

  await assert.rejects(
    service.createTrack({
      eventId: '000000000000000000000101',
      name: 'Already Open Track',
      status: 'OPEN'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Tracks must be created in DRAFT status')
  )

  const created = await service.createTrack({
    eventId: '000000000000000000000101',
    name: 'Workflow Track'
  })

  await assert.rejects(
    service.updateTrack(created.id, { status: 'COMPLETED' }),
    error => error instanceof ApiError &&
      error.errors.includes('Invalid track status transition from DRAFT to COMPLETED')
  )

  const opened = await service.updateTrack(created.id, { status: 'OPEN' })
  assert.equal(opened.status, 'OPEN')
})
