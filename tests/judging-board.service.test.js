import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createJudgingBoardService } from '../src/modules/judging-boards/judging-board.service.js'

test('previewRandomizedBoards only includes eligible teams for the selected round board', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalRoundFind = RoundModel.find
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

  CompetitionModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 3, maxTeamsPerBoard: 2 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    competitionId: '000000000000000000000101',
    roundType: 'PRELIMINARY'
  })
  RoundModel.find = () => ({
    select: async () => [{ _id: '000000000000000000000201', trackId: null }]
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
      competitionId: '000000000000000000000101',
      roundId: '000000000000000000000201'
    })

    assert.equal(result.eligibleTeamCount, 2)
    assert.equal(result.ineligibleTeamCount, 1)
    assert.equal(result.boards.length, 1)
    assert.equal(result.boards[0].name, 'Board A')
  } finally {
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
    RoundModel.find = originalRoundFind
    TeamModel.find = originalTeamFind
  }
})

test('confirmRandomizedBoards persists boardNumber and placementSlot only after confirmation', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalRoundFindByIdAndUpdate = RoundModel.findByIdAndUpdate
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

  CompetitionModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 2, maxTeamsPerBoard: 2 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    competitionId: '000000000000000000000101',
    assignedTeamIds: ['000000000000000000000301', '000000000000000000000302']
  })
  RoundModel.findByIdAndUpdate = async () => null
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
      competitionId: '000000000000000000000101',
      roundId: '000000000000000000000201',
      boards: [{ boardNumber: 1, name: 'Board A', teamIds: ['000000000000000000000301', '000000000000000000000302'] }]
    })

    assert.equal(result.boards.length, 1)
    assert.equal(storedPlacements.length, 2)
    assert.equal(storedPlacements[0].roundId, '000000000000000000000201')
    assert.equal(storedPlacements[0].boardNumber, 1)
    assert.equal(teamState.get('000000000000000000000301')?.boardNumber, 1)
    assert.equal(teamState.get('000000000000000000000301')?.placementSlot, 1)
    assert.equal(teamState.get('000000000000000000000302')?.boardNumber, 1)
  } finally {
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
    RoundModel.findByIdAndUpdate = originalRoundFindByIdAndUpdate
    TeamModel.find = originalTeamFind
    TeamModel.updateMany = originalUpdateMany
    TeamModel.findByIdAndUpdate = originalFindByIdAndUpdate
  }
})

test('previewRandomizedBoards keeps all selected-round teams in its single board', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTeamFind = TeamModel.find

  const teamIds = Array.from({ length: 20 }, (_, index) => `${String(index + 1).padStart(24, '0')}`)
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

  CompetitionModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 3, maxTeamsPerBoard: 20 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    competitionId: '000000000000000000000101',
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
      competitionId: '000000000000000000000101',
      roundId: '000000000000000000000201'
    })

    assert.deepEqual(result.boards.map(board => board.teamIds.length), [20])
  } finally {
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
    TeamModel.find = originalTeamFind
  }
})

test('confirmRandomizedBoards validates the single board number and round capacity', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const TeamModel = teamModule.default

  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTeamFind = TeamModel.find
  const originalUpdateMany = TeamModel.updateMany
  const originalFindByIdAndUpdate = TeamModel.findByIdAndUpdate

  const teamIds = ['000000000000000000000301', '000000000000000000000302']
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

  CompetitionModel.findById = async () => ({
    _id: '000000000000000000000101',
    competitionConfig: { boardCount: 2, maxTeamsPerBoard: 2 }
  })
  RoundModel.findById = async () => ({
    _id: '000000000000000000000201',
    competitionId: '000000000000000000000101',
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
        competitionId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        boards: []
      }),
      error => error instanceof ApiError &&
        error.errors.includes('Randomized board confirmation must include exactly the configured number of boards')
    )

    await assert.rejects(
      service.confirmRandomizedBoards({
        competitionId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        boards: [{ boardNumber: 1, teamIds: [teamIds[0]] }, { boardNumber: 1, teamIds: [teamIds[1]] }]
      }),
      error => error instanceof ApiError &&
        error.errors.includes('Randomized board confirmation must include exactly the configured number of boards')
    )

    await assert.rejects(
      service.confirmRandomizedBoards({
        competitionId: '000000000000000000000101',
        roundId: '000000000000000000000201',
        boards: [{ boardNumber: 1, teamIds }, { boardNumber: 2, teamIds: [] }]
      }),
      error => error instanceof ApiError &&
        error.errors.includes('Randomized board confirmation must include exactly the configured number of boards')
    )
  } finally {
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
    TeamModel.find = originalTeamFind
    TeamModel.updateMany = originalUpdateMany
    TeamModel.findByIdAndUpdate = originalFindByIdAndUpdate
  }
})

test('createBoard rejects teamIds beyond maxTeams', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const trackModule = await import('../src/models/track.model.js')
  const teamModule = await import('../src/models/team.model.js')
  const userModule = await import('../src/models/user.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const TrackModel = trackModule.default
  const TeamModel = teamModule.default
  const UserModel = userModule.default

  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalRoundFindByIdAndUpdate = RoundModel.findByIdAndUpdate
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

  CompetitionModel.findById = async () => ({ _id: '000000000000000000000101' })
  RoundModel.findById = async () => ({ _id: '000000000000000000000201', competitionId: '000000000000000000000101', trackId: '000000000000000000000401' })
  TrackModel.findById = async () => ({ _id: '000000000000000000000401', competitionId: '000000000000000000000101' })
  TeamModel.find = async () => [
    { _id: '000000000000000000000301', competitionId: '000000000000000000000101', trackId: '000000000000000000000401' },
    { _id: '000000000000000000000302', competitionId: '000000000000000000000101', trackId: '000000000000000000000401' }
  ]
  UserModel.find = async () => []

  const service = createJudgingBoardService({ repository })

  try {
    await assert.rejects(
      service.createBoard({
        competitionId: '000000000000000000000101',
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
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
    TrackModel.findById = originalTrackFindById
    TeamModel.find = originalTeamFind
    UserModel.find = originalUserFind
  }
})

test('createBoard rejects judges without ACTIVE judge role', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const trackModule = await import('../src/models/track.model.js')
  const teamModule = await import('../src/models/team.model.js')
  const userModule = await import('../src/models/user.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const TrackModel = trackModule.default
  const TeamModel = teamModule.default
  const UserModel = userModule.default

  const originalCompetitionFindById = CompetitionModel.findById
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

  CompetitionModel.findById = async () => ({ _id: '000000000000000000000101' })
  RoundModel.findById = async () => ({ _id: '000000000000000000000201', competitionId: '000000000000000000000101', trackId: '000000000000000000000401' })
  TrackModel.findById = async () => ({ _id: '000000000000000000000401', competitionId: '000000000000000000000101' })
  TeamModel.find = async () => [
    { _id: '000000000000000000000301', competitionId: '000000000000000000000101', trackId: '000000000000000000000401' }
  ]
  UserModel.find = async () => [
    { _id: '000000000000000000000501', status: 'ACTIVE', roles: [{ name: 'PARTICIPANT' }] }
  ]

  const service = createJudgingBoardService({ repository })

  try {
    await assert.rejects(
      service.createBoard({
        competitionId: '000000000000000000000101',
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
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
    TrackModel.findById = originalTrackFindById
    TeamModel.find = originalTeamFind
    UserModel.find = originalUserFind
  }
})

test('updateBoard sends an in-app notification only to newly assigned judges', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')
  const trackModule = await import('../src/models/track.model.js')
  const userModule = await import('../src/models/user.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const TrackModel = trackModule.default
  const UserModel = userModule.default

  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById
  const originalTrackFindById = TrackModel.findById
  const originalUserFind = UserModel.find

  const competitionId = '000000000000000000000101'
  const roundId = '000000000000000000000201'
  const trackId = '000000000000000000000401'
  const boardId = '000000000000000000000601'
  const judgeOne = { _id: '000000000000000000000501', fullName: 'Judge One', email: 'judge.one@example.com', status: 'ACTIVE', roles: [{ name: 'JUDGE' }] }
  const judgeTwo = { _id: '000000000000000000000502', fullName: 'Judge Two', email: 'judge.two@example.com', status: 'ACTIVE', roles: [{ name: 'JUDGE' }] }
  const existingBoard = {
    _id: boardId,
    competitionId: { _id: competitionId, title: 'SEAL Hackathon', status: 'ONGOING' },
    roundId: { _id: roundId, name: 'Preliminary', status: 'OPEN', trackId },
    trackId,
    name: 'Board A',
    boardNumber: 1,
    teamIds: [],
    judgeIds: [judgeOne],
    status: 'ASSIGNED'
  }
  const notifications = []
  const repository = {
    findById: async () => existingBoard,
    findByRoundAndBoardNumber: async () => null,
    updateById: async (_id, data) => ({
      ...existingBoard,
      ...data,
      judgeIds: [judgeOne, judgeTwo]
    })
  }
  const notificationService = {
    notifyUser: async payload => {
      notifications.push(payload)
      return { notification: {}, email: null, errors: [] }
    }
  }

  CompetitionModel.findById = async () => ({ _id: competitionId, title: 'SEAL Hackathon', status: 'ONGOING' })
  RoundModel.findById = async () => ({ _id: roundId, competitionId, name: 'Preliminary', status: 'OPEN', trackId })
  RoundModel.findByIdAndUpdate = async () => null
  TrackModel.findById = async () => ({ _id: trackId, competitionId })
  UserModel.find = async () => [judgeOne, judgeTwo]

  const service = createJudgingBoardService({ repository, notificationService })

  try {
    await service.updateBoard(boardId, { judgeIds: [judgeOne._id, judgeTwo._id] })

    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].user.email, 'judge.two@example.com')
    assert.deepEqual(notifications[0].channels, ['IN_APP'])
    assert.equal(notifications[0].metadata.action, 'JUDGE_BOARD_ASSIGNED')
  } finally {
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
    RoundModel.findByIdAndUpdate = originalRoundFindByIdAndUpdate
    TrackModel.findById = originalTrackFindById
    UserModel.find = originalUserFind
  }
})

test('completed competition locks judging board assignment changes', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default

  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById

  const competitionId = '000000000000000000000101'
  const roundId = '000000000000000000000201'
  const boardId = '000000000000000000000601'
  const existingBoard = {
    _id: boardId,
    competitionId,
    roundId,
    trackId: null,
    name: 'Board A',
    boardNumber: 1,
    teamIds: [],
    judgeIds: [],
    status: 'ASSIGNED'
  }
  const repository = {
    findById: async () => existingBoard,
    updateById: async () => {
      throw new Error('should not update a board after competition completion')
    },
    findByRoundAndBoardNumber: async () => null
  }

  CompetitionModel.findById = async () => ({
    _id: competitionId,
    status: 'COMPLETED',
    competitionConfig: { boardCount: 2, maxTeamsPerBoard: 10 }
  })
  RoundModel.findById = async () => ({ _id: roundId, competitionId, status: 'OPEN', roundType: 'PRELIMINARY' })

  const service = createJudgingBoardService({ repository })

  try {
    await assert.rejects(
      service.createBoard({ competitionId, roundId, name: 'Board B', boardNumber: 2 }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Judging board assignments cannot be changed after the competition has been completed or archived')
    )

    await assert.rejects(
      service.updateBoard(boardId, { judgeIds: ['000000000000000000000501'] }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Judging board assignments cannot be changed after the competition is completed or archived, or the judging round is completed')
    )

    await assert.rejects(
      service.previewRandomizedBoards({ competitionId, roundId }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Judging board assignments cannot be changed after the competition has been completed or archived')
    )

    await assert.rejects(
      service.deleteBoard(boardId),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Judging board assignments cannot be changed after the competition has been completed or archived')
    )
  } finally {
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
  }
})

test('archived competition locks judging board changes even with relaxed demo rules', async () => {
  const competitionModule = await import('../src/models/competition.model.js')
  const roundModule = await import('../src/models/round.model.js')

  const CompetitionModel = competitionModule.default
  const RoundModel = roundModule.default
  const originalCompetitionFindById = CompetitionModel.findById
  const originalRoundFindById = RoundModel.findById

  const competitionId = '000000000000000000000101'
  const roundId = '000000000000000000000201'
  const boardId = '000000000000000000000601'
  const existingBoard = {
    _id: boardId,
    competitionId,
    roundId,
    trackId: null,
    name: 'Board A',
    boardNumber: 1,
    teamIds: [],
    judgeIds: [],
    status: 'ASSIGNED'
  }
  const repository = {
    findById: async () => existingBoard,
    updateById: async () => {
      throw new Error('should not update an archived competition board')
    },
    findByRoundAndBoardNumber: async () => null
  }

  CompetitionModel.findById = async () => ({
    _id: competitionId,
    status: 'ARCHIVED',
    competitionConfig: { boardCount: 2, maxTeamsPerBoard: 10 }
  })
  RoundModel.findById = async () => ({ _id: roundId, competitionId, status: 'OPEN', roundType: 'PRELIMINARY' })

  const service = createJudgingBoardService({ repository, relaxedWorkflow: true })

  try {
    await assert.rejects(
      service.updateBoard(boardId, { judgeIds: ['000000000000000000000501'] }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Judging board assignments cannot be changed after the competition is completed or archived, or the judging round is completed')
    )

    await assert.rejects(
      service.previewRandomizedBoards({ competitionId, roundId }),
      (error) => error instanceof ApiError &&
        error.code === 'BAD_REQUEST' &&
        error.errors.includes('Judging board assignments cannot be changed after the competition has been completed or archived')
    )
  } finally {
    CompetitionModel.findById = originalCompetitionFindById
    RoundModel.findById = originalRoundFindById
  }
})
