import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createRoundService } from '../src/modules/rounds/round.service.js'

test('createRound and updateRound reject windows outside the competition dates', async () => {
  const originalCompetitionFindById = await import('../src/models/competition.model.js')
  const originalTeamFind = await import('../src/models/team.model.js')
  const originalUserFind = await import('../src/models/user.model.js')

  const competitionModel = originalCompetitionFindById.default
  const teamModel = originalTeamFind.default
  const userModel = originalUserFind.default

  const existingRound = {
    _id: '000000000000000000000901',
    competitionId: '000000000000000000000101',
    name: 'Round 1',
    startTime: '2026-08-13T03:00:00.000Z',
    endTime: '2026-08-13T10:00:00.000Z',
    status: 'DRAFT',
    assignedTeamIds: [],
    assignedJudgeIds: []
  }
  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => existingRound,
    create: async (data) => ({ _id: '000000000000000000000901', ...data }),
    updateById: async () => existingRound,
    deleteById: async () => null
  }

  const competitionFindById = competitionModel.findById
  const teamFind = teamModel.find
  const userFind = userModel.find

  competitionModel.findById = async () => ({
    _id: '000000000000000000000101',
    title: 'SEAL',
    startDate: '2026-08-13T00:00:00.000Z',
    endDate: '2026-08-16T00:00:00.000Z'
  })
  teamModel.find = async () => []
  userModel.find = async () => []

  const service = createRoundService({ repository })

  try {
    await assert.rejects(
      service.createRound({
        competitionId: '000000000000000000000101',
        name: 'Round before competition',
        startTime: '2026-08-12T03:27:00.000Z',
        endTime: '2026-08-13T03:27:00.000Z'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Round start time must be within the competition date range')
    )

    await assert.rejects(
      service.updateRound('000000000000000000000901', {
        endTime: '2026-08-17T03:27:00.000Z'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Round end time must be within the competition date range')
    )

    await assert.rejects(
      service.createRound({
        competitionId: '000000000000000000000101',
        name: 'Round with late result publication',
        startTime: '2026-08-16T01:00:00.000Z',
        endTime: '2026-08-16T08:00:00.000Z',
        publishTime: '2026-08-16T17:00:00.000Z'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Round publish time must be within the competition date range')
    )

    await assert.rejects(
      service.createRound({
        competitionId: '000000000000000000000101',
        name: 'Round with submission deadline after competition',
        startTime: '2026-08-16T01:00:00.000Z',
        submissionDeadline: '2026-08-17T01:00:00.000Z'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Round submission deadline must be within the competition date range')
    )
  } finally {
    competitionModel.findById = competitionFindById
    teamModel.find = teamFind
    userModel.find = userFind
  }
})

test('createRound rejects teams outside the selected track', async () => {
  const originalCompetitionFindById = await import('../src/models/competition.model.js')
  const originalTrackFindById = await import('../src/models/track.model.js')
  const originalRubricFindById = await import('../src/models/rubric.model.js')
  const originalTeamFind = await import('../src/models/team.model.js')
  const originalUserFind = await import('../src/models/user.model.js')

  const competitionModel = originalCompetitionFindById.default
  const trackModel = originalTrackFindById.default
  const rubricModel = originalRubricFindById.default
  const teamModel = originalTeamFind.default
  const userModel = originalUserFind.default

  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => null,
    create: async (data) => ({ _id: '000000000000000000000901', ...data }),
    updateById: async () => null,
    deleteById: async () => null
  }

  const competitionFindById = competitionModel.findById
  const trackFindById = trackModel.findById
  const rubricFindById = rubricModel.findById
  const teamFind = teamModel.find
  const userFind = userModel.find

  competitionModel.findById = async () => ({ _id: '000000000000000000000101', title: 'SEAL' })
  trackModel.findById = async () => ({ _id: '000000000000000000000201', competitionId: '000000000000000000000101' })
  rubricModel.findById = async () => ({ _id: '000000000000000000000301', competitionId: '000000000000000000000101' })
  userModel.find = async () => [{ _id: '000000000000000000000401', status: 'ACTIVE', roles: [{ name: 'JUDGE' }] }]
  teamModel.find = async () => [{
    _id: '000000000000000000000501',
    competitionId: '000000000000000000000101',
    trackId: '000000000000000000000202'
  }]

  const service = createRoundService({ repository })

  try {
    await assert.rejects(
      service.createRound({
        competitionId: '000000000000000000000101',
        trackId: '000000000000000000000201',
        name: 'Round 1',
        assignedTeamIds: ['000000000000000000000501'],
        assignedJudgeIds: ['000000000000000000000401'],
        rubricId: '000000000000000000000301'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Assigned teams must belong to the selected track')
    )
  } finally {
    competitionModel.findById = competitionFindById
    trackModel.findById = trackFindById
    rubricModel.findById = rubricFindById
    teamModel.find = teamFind
    userModel.find = userFind
  }
})

test('createRound rejects teams that are not confirmed', async () => {
  const originalCompetitionFindById = await import('../src/models/competition.model.js')
  const originalTrackFindById = await import('../src/models/track.model.js')
  const originalRubricFindById = await import('../src/models/rubric.model.js')
  const originalTeamFind = await import('../src/models/team.model.js')
  const originalUserFind = await import('../src/models/user.model.js')

  const competitionModel = originalCompetitionFindById.default
  const trackModel = originalTrackFindById.default
  const rubricModel = originalRubricFindById.default
  const teamModel = originalTeamFind.default
  const userModel = originalUserFind.default

  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => null,
    create: async (data) => ({ _id: '000000000000000000000902', ...data }),
    updateById: async () => null,
    deleteById: async () => null
  }

  const competitionFindById = competitionModel.findById
  const trackFindById = trackModel.findById
  const rubricFindById = rubricModel.findById
  const teamFind = teamModel.find
  const userFind = userModel.find

  competitionModel.findById = async () => ({ _id: '000000000000000000000101', title: 'SEAL' })
  trackModel.findById = async () => ({ _id: '000000000000000000000201', competitionId: '000000000000000000000101' })
  rubricModel.findById = async () => ({ _id: '000000000000000000000301', competitionId: '000000000000000000000101' })
  userModel.find = async () => [{ _id: '000000000000000000000401', status: 'ACTIVE', roles: [{ name: 'JUDGE' }] }]

  const service = createRoundService({ repository })

  try {
    for (const status of ['REJECTED', 'CANCELLED']) {
      teamModel.find = async () => [{
        _id: '000000000000000000000501',
        competitionId: '000000000000000000000101',
        trackId: '000000000000000000000201',
        status
      }]

      await assert.rejects(
        service.createRound({
          competitionId: '000000000000000000000101',
          trackId: '000000000000000000000201',
          name: 'Round 1',
          assignedTeamIds: ['000000000000000000000501'],
          assignedJudgeIds: ['000000000000000000000401'],
          rubricId: '000000000000000000000301'
        }),
        (error) => error instanceof ApiError &&
          error.code === 'BAD_REQUEST' &&
          error.errors.includes('Only confirmed teams can be assigned to rounds')
      )
    }
  } finally {
    competitionModel.findById = competitionFindById
    trackModel.findById = trackFindById
    rubricModel.findById = rubricFindById
    teamModel.find = teamFind
    userModel.find = userFind
  }
})

test('createRound rejects assigned judges without ACTIVE judge role', async () => {
  const originalCompetitionFindById = await import('../src/models/competition.model.js')
  const originalTrackFindById = await import('../src/models/track.model.js')
  const originalRubricFindById = await import('../src/models/rubric.model.js')
  const originalTeamFind = await import('../src/models/team.model.js')
  const originalUserFind = await import('../src/models/user.model.js')

  const competitionModel = originalCompetitionFindById.default
  const trackModel = originalTrackFindById.default
  const rubricModel = originalRubricFindById.default
  const teamModel = originalTeamFind.default
  const userModel = originalUserFind.default

  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => null,
    create: async (data) => ({ _id: '000000000000000000000903', ...data }),
    updateById: async () => null,
    deleteById: async () => null
  }

  const competitionFindById = competitionModel.findById
  const trackFindById = trackModel.findById
  const rubricFindById = rubricModel.findById
  const teamFind = teamModel.find
  const userFind = userModel.find

  competitionModel.findById = async () => ({ _id: '000000000000000000000101', title: 'SEAL' })
  trackModel.findById = async () => ({ _id: '000000000000000000000201', competitionId: '000000000000000000000101' })
  rubricModel.findById = async () => ({ _id: '000000000000000000000301', competitionId: '000000000000000000000101' })
  teamModel.find = async () => [{
    _id: '000000000000000000000501',
    competitionId: '000000000000000000000101',
    trackId: '000000000000000000000201',
    status: 'CONFIRMED'
  }]

  const service = createRoundService({ repository })

  try {
    userModel.find = async () => [{ _id: '000000000000000000000401', status: 'ACTIVE', roles: [{ name: 'PARTICIPANT' }] }]
    await assert.rejects(
      service.createRound({
        competitionId: '000000000000000000000101',
        trackId: '000000000000000000000201',
        name: 'Round 1',
        assignedTeamIds: ['000000000000000000000501'],
        assignedJudgeIds: ['000000000000000000000401'],
        rubricId: '000000000000000000000301'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Assigned judges must have ACTIVE accounts and the JUDGE role')
    )

    userModel.find = async () => [{ _id: '000000000000000000000401', status: 'SUSPENDED', roles: [{ name: 'JUDGE' }] }]
    await assert.rejects(
      service.createRound({
        competitionId: '000000000000000000000101',
        trackId: '000000000000000000000201',
        name: 'Round 1',
        assignedTeamIds: ['000000000000000000000501'],
        assignedJudgeIds: ['000000000000000000000401'],
        rubricId: '000000000000000000000301'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Assigned judges must have ACTIVE accounts and the JUDGE role')
    )
  } finally {
    competitionModel.findById = competitionFindById
    trackModel.findById = trackFindById
    rubricModel.findById = rubricFindById
    teamModel.find = teamFind
    userModel.find = userFind
  }
})
