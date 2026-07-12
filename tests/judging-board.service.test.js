import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createJudgingBoardService } from '../src/modules/judging-boards/judging-board.service.js'

test('previewRandomizedBoards only includes eligible teams and builds board A/B style names', async () => {
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
  const storedPlacements = []
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
    },
    findByRoundId: async () => [...storedBoards.values()],
    deleteManyByRoundExcludingBoardNumbers: async () => null,
    replaceRoundTeamPlacements: async ({ placements }) => {
      storedPlacements.splice(0, storedPlacements.length, ...placements)
      return placements
    }
  }

  EventModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 3, maxTeamsPerBoard: 2 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    eventId: '000000000000000000000101',
    assignedTeamIds: ['000000000000000000000301', '000000000000000000000302', '000000000000000000000303']
  })
  TeamModel.find = () => ({
    sort: async () => [
      { _id: '000000000000000000000301', name: 'Team 1', status: 'CONFIRMED', trackId: '000000000000000000000401' },
      { _id: '000000000000000000000302', name: 'Team 2', status: 'CONFIRMED', trackId: '000000000000000000000402' },
      { _id: '000000000000000000000303', name: 'Team 3', status: 'WAITING_FOR_MEMBERS', trackId: '000000000000000000000403' }
    ]
  })

  const service = createJudgingBoardService({ repository, randomFn: () => 0 })

  try {
    const result = await service.previewRandomizedBoards({
      eventId: '000000000000000000000101',
      roundId: '000000000000000000000201'
    })

    assert.equal(result.eligibleTeamCount, 2)
    assert.equal(result.ineligibleTeamCount, 1)
    assert.equal(result.boards.length, 3)
    assert.equal(result.boards[0].name, 'Board A')
    assert.equal(result.boards[1].name, 'Board B')
    assert.equal(result.boards[2].name, 'Board C')
  } finally {
    EventModel.findById = originalEventFindById
    RoundModel.findById = originalRoundFindById
    TeamModel.find = originalTeamFind
  }
})

test('confirmRandomizedBoards persists boardNumber and placementSlot only after confirmation', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const EventModel = eventModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalEventFindById = EventModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTeamFind = TeamModel.find
  const originalUpdateMany = TeamModel.updateMany
  const originalFindByIdAndUpdate = TeamModel.findByIdAndUpdate

  const teamState = new Map([
    ['000000000000000000000301', { _id: '000000000000000000000301', name: 'Team 1', status: 'CONFIRMED' }],
    ['000000000000000000000302', { _id: '000000000000000000000302', name: 'Team 2', status: 'CONFIRMED' }]
  ])
  const storedBoards = new Map()
  const storedPlacements = []
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
      const updated = { ...(storedBoards.get(id) || {}), ...data, _id: id }
      storedBoards.set(id, updated)
      return updated
    },
    deleteById: async () => null,
    findByRoundAndBoardNumber: async ({ roundId, boardNumber }) =>
      [...storedBoards.values()].find(board => board.roundId === roundId && board.boardNumber === boardNumber) || null,
    findByRoundId: async () => [...storedBoards.values()],
    deleteManyByRoundExcludingBoardNumbers: async () => null,
    replaceRoundTeamPlacements: async ({ placements }) => {
      storedPlacements.splice(0, storedPlacements.length, ...placements)
      return placements
    }
  }

  EventModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 2, maxTeamsPerBoard: 1 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    eventId: '000000000000000000000101',
    assignedTeamIds: ['000000000000000000000301', '000000000000000000000302']
  })
  TeamModel.find = () => ({
    sort: async () => [...teamState.values()]
  })
  TeamModel.updateMany = async () => ({ acknowledged: true })
  TeamModel.findByIdAndUpdate = async (id, data) => {
    teamState.set(id, { ...teamState.get(id), ...data })
    return teamState.get(id)
  }

  const service = createJudgingBoardService({ repository })

  try {
    const result = await service.confirmRandomizedBoards({
      eventId: '000000000000000000000101',
      roundId: '000000000000000000000201',
      boards: [
        { boardNumber: 1, name: 'Board A', teamIds: ['000000000000000000000301'] },
        { boardNumber: 2, name: 'Board B', teamIds: ['000000000000000000000302'] }
      ]
    })

    assert.equal(result.boards.length, 2)
    assert.equal(storedPlacements.length, 2)
    assert.equal(storedPlacements[0].roundId, '000000000000000000000201')
    assert.equal(storedPlacements[0].boardNumber, 1)
    assert.equal(teamState.get('000000000000000000000301')?.boardNumber, 1)
    assert.equal(teamState.get('000000000000000000000301')?.placementSlot, 1)
    assert.equal(teamState.get('000000000000000000000302')?.boardNumber, 2)
  } finally {
    EventModel.findById = originalEventFindById
    RoundModel.findById = originalRoundFindById
    TeamModel.find = originalTeamFind
    TeamModel.updateMany = originalUpdateMany
    TeamModel.findByIdAndUpdate = originalFindByIdAndUpdate
  }
})

test('previewRandomizedBoards distributes teams evenly across boards', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const EventModel = eventModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalEventFindById = EventModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTeamFind = TeamModel.find

  const teamIds = Array.from({ length: 30 }, (_, index) => `${String(index + 1).padStart(24, '0')}`)
  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => null,
    create: async (data) => data,
    updateById: async () => null,
    deleteById: async () => null,
    findByRoundAndBoardNumber: async () => null,
    findByRoundId: async () => [],
    deleteManyByRoundExcludingBoardNumbers: async () => null
  }

  EventModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 3, maxTeamsPerBoard: 20 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    eventId: '000000000000000000000101',
    assignedTeamIds: teamIds
  })
  TeamModel.find = () => ({
    sort: async () => teamIds.map((id, index) => ({
      _id: id,
      name: `Team ${index + 1}`,
      status: 'CONFIRMED'
    }))
  })

  const service = createJudgingBoardService({ repository, randomFn: () => 0.5 })

  try {
    const result = await service.previewRandomizedBoards({
      eventId: '000000000000000000000101',
      roundId: '000000000000000000000201'
    })

    assert.deepEqual(result.boards.map(board => board.teamIds.length), [10, 10, 10])
  } finally {
    EventModel.findById = originalEventFindById
    RoundModel.findById = originalRoundFindById
    TeamModel.find = originalTeamFind
  }
})

test('confirmRandomizedBoards validates board count, board numbers, and max teams per board', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const EventModel = eventModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalEventFindById = EventModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTeamFind = TeamModel.find
  const originalUpdateMany = TeamModel.updateMany
  const originalFindByIdAndUpdate = TeamModel.findByIdAndUpdate

  const teamIds = [
    '000000000000000000000301',
    '000000000000000000000302',
    '000000000000000000000303'
  ]
  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => null,
    create: async (data) => data,
    updateById: async () => null,
    deleteById: async () => null,
    findByRoundAndBoardNumber: async () => null,
    findByRoundId: async () => [],
    deleteManyByRoundExcludingBoardNumbers: async () => null,
    replaceRoundTeamPlacements: async () => []
  }

  EventModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 2, maxTeamsPerBoard: 2 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    eventId: '000000000000000000000101',
    assignedTeamIds: teamIds
  })
  TeamModel.find = () => ({
    sort: async () => teamIds.map((id, index) => ({
      _id: id,
      name: `Team ${index + 1}`,
      status: 'CONFIRMED'
    }))
  })
  TeamModel.updateMany = async () => ({ acknowledged: true })
  TeamModel.findByIdAndUpdate = async () => null

  const service = createJudgingBoardService({ repository })

  try {
    await assert.rejects(
      service.confirmRandomizedBoards({
        eventId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        boards: [
          { boardNumber: 1, teamIds }
        ]
      }),
      error => error instanceof ApiError &&
        error.errors.includes('Randomized board confirmation must include exactly the configured number of boards')
    )

    await assert.rejects(
      service.confirmRandomizedBoards({
        eventId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        boards: [
          { boardNumber: 1, teamIds: [teamIds[0]] },
          { boardNumber: 1, teamIds: [teamIds[1], teamIds[2]] }
        ]
      }),
      error => error instanceof ApiError &&
        error.errors.includes('Randomized board confirmation contains duplicate board numbers')
    )

    await assert.rejects(
      service.confirmRandomizedBoards({
        eventId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        boards: [
          { boardNumber: 1, teamIds },
          { boardNumber: 2, teamIds: [] }
        ]
      }),
      error => error instanceof ApiError &&
        error.errors.includes('Randomized board confirmation exceeds maxTeamsPerBoard')
    )
  } finally {
    EventModel.findById = originalEventFindById
    RoundModel.findById = originalRoundFindById
    TeamModel.find = originalTeamFind
    TeamModel.updateMany = originalUpdateMany
    TeamModel.findByIdAndUpdate = originalFindByIdAndUpdate
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

test('createBoard rejects judges without ACTIVE judge role', async () => {
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
    { _id: '000000000000000000000301', eventId: '000000000000000000000101', trackId: '000000000000000000000401' }
  ]
  UserModel.find = async () => [
    { _id: '000000000000000000000501', status: 'ACTIVE', roles: [{ name: 'PARTICIPANT' }] }
  ]

  const service = createJudgingBoardService({ repository })

  try {
    await assert.rejects(
      service.createBoard({
        eventId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        trackId: '000000000000000000000401',
        name: 'Board 1',
        boardNumber: 1,
        teamIds: ['000000000000000000000301'],
        judgeIds: ['000000000000000000000501'],
        maxTeams: 1
      }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Assigned judges must have ACTIVE accounts and the JUDGE role')
    )
  } finally {
    EventModel.findById = originalEventFindById
    RoundModel.findById = originalRoundFindById
    TrackModel.findById = originalTrackFindById
    TeamModel.find = originalTeamFind
    UserModel.find = originalUserFind
  }
})
