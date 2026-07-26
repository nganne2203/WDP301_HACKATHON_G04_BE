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
  const participantCompetitionIds = new Set()
  const openRegistrationCompetitionIds = new Set()
  const nonDraftCompetitionIds = new Set()

  return {
    count: async (filter = {}) => [...records.values()].filter(record => matchesFilter(record, filter)).length,
    findAll: async ({ filter = {} } = {}) => [...records.values()].filter(record => matchesFilter(record, filter)),
    findById: async (id) => records.get(id) || null,
    findByCompetitionAndName: async (competitionId, name) => [...records.values()]
      .find(record => getId(record.competitionId) === getId(competitionId) && record.name === name) || null,
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
  getRawCompetitionById: async (id) => ({ _id: id, title: 'SEAL Competition' })
}

test('listTracks scopes participant to joined or open-registration competitions', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantCompetitions: ['000000000000000000000101'],
    openRegistrationCompetitions: ['000000000000000000000102']
  })
  const service = createTrackService({ repository, competitionService })

  await service.createTrack({
    competitionId: '000000000000000000000101',
    name: 'Joined Competition Track'
  })
  await service.createTrack({
    competitionId: '000000000000000000000103',
    name: 'Draft Competition Track'
  })

  const result = await service.listTracks({}, {
    id: '000000000000000000000201',
    roles: ['PARTICIPANT']
  })

  assert.equal(result.tracks.length, 1)
  assert.equal(result.tracks[0].competition.id, '000000000000000000000101')
})

test('getTrackById hides competition children outside actor scope', async () => {
  const repository = createRepository()
  repository.seedVisibility({
    participantCompetitions: ['000000000000000000000101']
  })
  const service = createTrackService({ repository, competitionService })

  const created = await service.createTrack({
    competitionId: '000000000000000000000103',
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
  const service = createTrackService({ repository, competitionService })

  await assert.rejects(
    service.createTrack({
      competitionId: '000000000000000000000101',
      name: 'Already Open Track',
      status: 'OPEN'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Tracks must be created in DRAFT status')
  )

  const created = await service.createTrack({
    competitionId: '000000000000000000000101',
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

test('track mutations reject completed or archived competitions', async () => {
  const repository = createRepository()
  const openCompetitionService = {
    getRawCompetitionById: async (id) => ({ _id: id, title: 'Open Competition', status: 'ONGOING' })
  }
  const lockedCompetitionService = {
    getRawCompetitionById: async (id) => ({ _id: id, title: 'Completed Competition', status: 'COMPLETED' })
  }
  const openService = createTrackService({ repository, competitionService: openCompetitionService })
  const lockedService = createTrackService({ repository, competitionService: lockedCompetitionService })

  const created = await openService.createTrack({
    competitionId: '000000000000000000000101',
    name: 'Locked Track'
  })

  await assert.rejects(
    lockedService.createTrack({
      competitionId: '000000000000000000000101',
      name: 'Late Track'
    }),
    error => error instanceof ApiError &&
      error.errors.includes('Tracks cannot be changed after the competition has been completed or archived')
  )

  await assert.rejects(
    lockedService.updateTrack(created.id, { name: 'Renamed Track' }),
    error => error instanceof ApiError &&
      error.errors.includes('Tracks cannot be changed after the competition has been completed or archived')
  )

  await assert.rejects(
    lockedService.deleteTrack(created.id),
    error => error instanceof ApiError &&
      error.errors.includes('Tracks cannot be changed after the competition has been completed or archived')
  )
})
