import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createJudgingBoardService } from '../src/modules/judging-boards/judging-board.service.js'

test('autoAssignBoards creates boards from team boardNumber placement', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const EventModel = eventModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalEventFindById = EventModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTeamFind = TeamModel.find

  const storedBoards = new Map()
  let seq = 1
  const repository = {
    count: async () => storedBoards.size,
    findAll: async () => [...storedBoards.values()],
    findById: async (id) => storedBoards.get(id) || null,
    create: async (data) => {
      const id = String(seq).padStart(24, '0')
      const board = { _id: id, ...data }
      storedBoards.set(id, board)
      seq += 1
      return board
    },
    updateById: async (id, data) => {
      const existing = storedBoards.get(id)
      const updated = { ...existing, ...data, _id: id }
      storedBoards.set(id, updated)
      return updated
    },
    deleteById: async () => null,
    findByRoundAndBoardNumber: async ({ roundId, boardNumber }) => {
      return [...storedBoards.values()].find(board => board.roundId === roundId && board.boardNumber === boardNumber) || null
    }
  }

  EventModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 2, maxTeamsPerBoard: 3 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    eventId: '000000000000000000000101',
    assignedTeamIds: ['000000000000000000000301', '000000000000000000000302']
  })
  TeamModel.find = () => ({
    sort: async () => [
      { _id: '000000000000000000000301', boardNumber: 1, trackId: '000000000000000000000401' },
      { _id: '000000000000000000000302', boardNumber: 2, trackId: '000000000000000000000402' }
    ]
  })

  const service = createJudgingBoardService({ repository })

  try {
    const result = await service.autoAssignBoards({
      eventId: '000000000000000000000101',
      roundId: '000000000000000000000201'
    })

    assert.equal(result.totalBoards, 2)
    assert.equal(result.boards[0].boardNumber, 1)
    assert.equal(result.boards[1].boardNumber, 2)
  } finally {
    EventModel.findById = originalEventFindById
    RoundModel.findById = originalRoundFindById
    TeamModel.find = originalTeamFind
  }
})

test('createBoard rejects teamIds beyond maxTeams', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const trackModule = await import('../src/models/track.model.js')
  const teamModule = await import('../src/models/team.model.js')
  const userModule = await import('../src/models/user.model.js')

  const EventModel = eventModule.default
  const RoundModel = roundModule.default
  const TrackModel = trackModule.default
  const TeamModel = teamModule.default
  const UserModel = userModule.default

  const originalEventFindById = EventModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTrackFindById = TrackModel.findById
  const originalTeamFind = TeamModel.find
  const originalUserFind = UserModel.find

  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => null,
    create: async (data) => data,
    updateById: async () => null,
    deleteById: async () => null,
    findByRoundAndBoardNumber: async () => null
  }

  EventModel.findById = async () => ({ _id: '000000000000000000000101' })
  RoundModel.findById = async () => ({ _id: '000000000000000000000201', eventId: '000000000000000000000101', trackId: '000000000000000000000401' })
  TrackModel.findById = async () => ({ _id: '000000000000000000000401', eventId: '000000000000000000000101' })
  TeamModel.find = async () => [
    { _id: '000000000000000000000301', eventId: '000000000000000000000101', trackId: '000000000000000000000401' },
    { _id: '000000000000000000000302', eventId: '000000000000000000000101', trackId: '000000000000000000000401' }
  ]
  UserModel.find = async () => []

  const service = createJudgingBoardService({ repository })

  try {
    await assert.rejects(
      service.createBoard({
        eventId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        trackId: '000000000000000000000401',
        name: 'Board 1',
        boardNumber: 1,
        teamIds: ['000000000000000000000301', '000000000000000000000302'],
        judgeIds: [],
        maxTeams: 1
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('teamIds cannot exceed maxTeams')
    )
  } finally {
    EventModel.findById = originalEventFindById
    RoundModel.findById = originalRoundFindById
    TrackModel.findById = originalTrackFindById
    TeamModel.find = originalTeamFind
    UserModel.find = originalUserFind
  }
})
