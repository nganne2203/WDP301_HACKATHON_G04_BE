import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createRoundService } from '../src/modules/rounds/round.service.js'

test('createRound rejects teams outside the selected track', async () => {
  const originalEventFindById = await import('../src/models/event.model.js')
  const originalTrackFindById = await import('../src/models/track.model.js')
  const originalRubricFindById = await import('../src/models/rubric.model.js')
  const originalTeamFind = await import('../src/models/team.model.js')
  const originalUserFind = await import('../src/models/user.model.js')

  const eventModel = originalEventFindById.default
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

  const eventFindById = eventModel.findById
  const trackFindById = trackModel.findById
  const rubricFindById = rubricModel.findById
  const teamFind = teamModel.find
  const userFind = userModel.find

  eventModel.findById = async () => ({ _id: '000000000000000000000101', title: 'SEAL' })
  trackModel.findById = async () => ({ _id: '000000000000000000000201', eventId: '000000000000000000000101' })
  rubricModel.findById = async () => ({ _id: '000000000000000000000301', eventId: '000000000000000000000101' })
  userModel.find = async () => [{ _id: '000000000000000000000401' }]
  teamModel.find = async () => [{
    _id: '000000000000000000000501',
    eventId: '000000000000000000000101',
    trackId: '000000000000000000000202'
  }]

  const service = createRoundService({ repository })

  try {
    await assert.rejects(
      service.createRound({
        eventId: '000000000000000000000101',
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
    eventModel.findById = eventFindById
    trackModel.findById = trackFindById
    rubricModel.findById = rubricFindById
    teamModel.find = teamFind
    userModel.find = userFind
  }
})
