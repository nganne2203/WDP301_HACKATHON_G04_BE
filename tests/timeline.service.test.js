import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createTimelineService } from '../src/modules/timelines/timeline.service.js'

const createRepository = () => {
  const records = new Map()
  let sequence = 1
  const participantCompetitionIds = new Set()
  const openRegistrationCompetitionIds = new Set()
  const nonDraftCompetitionIds = new Set()

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
    findCompetitionIdsForParticipant: async () => [...participantCompetitionIds],
    findOpenRegistrationCompetitionIds: async () => [...openRegistrationCompetitionIds],
    findNonDraftCompetitionIds: async () => [...nonDraftCompetitionIds],
    seedVisibility: ({ participantCompetitions = [], openRegistrationCompetitions = [], nonDraftCompetitions = [] } = {}) => {
      participantCompetitions.forEach(competitionId => participantCompetitionIds.add(competitionId))
      openRegistrationCompetitions.forEach(competitionId => openRegistrationCompetitionIds.add(competitionId))
      nonDraftCompetitions.forEach(competitionId => nonDraftCompetitionIds.add(competitionId))
    }
  }
}

const competitionService = {
  getRawCompetitionById: async (id) => ({
    _id: id,
    title: 'SEAL Competition',
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-06-30T23:59:59.000Z')
  })
}

const testClock = () => new Date('2026-05-01T00:00:00.000Z')

test('createTimeline stores timeline for an existing competition', async () => {
  const service = createTimelineService({
    repository: createRepository(),
    competitionService,
    now: testClock
  })

  const timeline = await service.createTimeline({
    competitionId: '000000000000000000000101',
    title: 'Registration Window',
    activityType: 'CHECK_IN',
    startTime: '2026-06-01T00:00:00.000Z',
    endTime: '2026-06-02T00:00:00.000Z'
  })

  assert.equal(timeline.title, 'Registration Window')
  assert.equal(timeline.competitionId, '000000000000000000000101')
  assert.equal(timeline.activityType, 'CHECK_IN')
})

test('createTimeline rejects a schedule in the past', async () => {
  const service = createTimelineService({
    repository: createRepository(),
    competitionService,
    now: () => new Date('2026-06-10T00:00:00.000Z')
  })

  await assert.rejects(
    service.createTimeline({
      competitionId: '000000000000000000000101',
      title: 'Past milestone',
      startTime: '2026-06-09T09:00:00.000Z',
      endTime: '2026-06-09T10:00:00.000Z'
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Timeline startTime cannot be in the past')
  )
})

test('updateTimeline rejects invalid date range', async () => {
  const repository = createRepository()
  const service = createTimelineService({ repository, competitionService, now: testClock })

  const created = await service.createTimeline({
    competitionId: '000000000000000000000101',
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

test('listTimelines scopes participant to joined or open-registration competitions', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantCompetitions: ['000000000000000000000101'],
    openRegistrationCompetitions: ['000000000000000000000102']
  })
  const service = createTimelineService({ repository, competitionService, now: testClock })

  await service.createTimeline({
    competitionId: '000000000000000000000101',
    title: 'Joined Competition Timeline'
  })
  await service.createTimeline({
    competitionId: '000000000000000000000103',
    title: 'Draft Competition Timeline'
  })

  const result = await service.listTimelines({}, {
    id: '000000000000000000000201',
    roles: ['PARTICIPANT']
  })

  assert.equal(result.timelines.length, 1)
  assert.equal(result.timelines[0].competitionId, '000000000000000000000101')
})

test('getTimelineById hides competition children outside actor scope', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantCompetitions: ['000000000000000000000101']
  })
  const service = createTimelineService({ repository, competitionService, now: testClock })

  const created = await service.createTimeline({
    competitionId: '000000000000000000000103',
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

test('timeline validates competition window and status transitions', async () => {
  const repository = createRepository()
  const service = createTimelineService({ repository, competitionService, now: testClock })

  await assert.rejects(
    service.createTimeline({
      competitionId: '000000000000000000000101',
      title: 'Too Late',
      startTime: '2026-07-01T00:00:00.000Z',
      endTime: '2026-07-01T01:00:00.000Z'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Timeline startTime must be within the competition date window')
  )

  await assert.rejects(
    service.createTimeline({
      competitionId: '000000000000000000000101',
      title: 'Already Done',
      status: 'COMPLETED'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Timeline competitions must be created in SCHEDULED status')
  )

  const created = await service.createTimeline({
    competitionId: '000000000000000000000101',
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

test('timeline mutations reject completed or archived competitions', async () => {
  const repository = createRepository()
  const openCompetitionService = {
    getRawCompetitionById: async (id) => ({
      _id: id,
      title: 'Open Competition',
      status: 'ONGOING',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T23:59:59.000Z')
    })
  }
  const lockedCompetitionService = {
    getRawCompetitionById: async (id) => ({
      _id: id,
      title: 'Completed Competition',
      status: 'ARCHIVED',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T23:59:59.000Z')
    })
  }
  const openService = createTimelineService({ repository, competitionService: openCompetitionService, now: testClock })
  const lockedService = createTimelineService({ repository, competitionService: lockedCompetitionService, now: testClock })

  const created = await openService.createTimeline({
    competitionId: '000000000000000000000101',
    title: 'Locked Timeline',
    startTime: '2026-06-03T09:00:00.000Z',
    endTime: '2026-06-03T10:00:00.000Z'
  })

  await assert.rejects(
    lockedService.createTimeline({
      competitionId: '000000000000000000000101',
      title: 'Late Timeline',
      startTime: '2026-06-04T09:00:00.000Z',
      endTime: '2026-06-04T10:00:00.000Z'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Timeline cannot be changed after the competition has been completed or archived')
  )

  await assert.rejects(
    lockedService.updateTimeline(created.id, { title: 'Renamed Timeline' }),
    error => error instanceof ApiError &&
      error.errors.includes('Timeline cannot be changed after the competition has been completed or archived')
  )

  await assert.rejects(
    lockedService.deleteTimeline(created.id),
    error => error instanceof ApiError &&
      error.errors.includes('Timeline cannot be changed after the competition has been completed or archived')
  )
})
