import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createRankingService } from '../src/modules/rankings/ranking.service.js'
import { createScoreSheetService } from '../src/modules/score-sheets/score-sheet.service.js'

const ids = {
  event: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  round: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  board1: 'cccccccccccccccccccccccc',
  board2: 'dddddddddddddddddddddddd',
  team1: '111111111111111111111111',
  team2: '222222222222222222222222',
  team3: '333333333333333333333333',
  team4: '444444444444444444444444',
  submission1: '555555555555555555555555',
  judge1: '666666666666666666666666',
  judge2: '777777777777777777777777',
  rubric: '888888888888888888888888',
  criterion1: '999999999999999999999991',
  criterion2: '999999999999999999999992',
  leader1: 'aaaaaaaaaaaaaaaaaaaaaa01',
  member1: 'aaaaaaaaaaaaaaaaaaaaaa02'
}

const judgeActor = { id: ids.judge1, roles: ['JUDGE'] }
const participantActor = { id: ids.leader1, roles: ['PARTICIPANT'] }

const getId = (value) => value?._id?.toString?.() || value?.toString?.()

const matchesFilter = (item, filter = {}) => {
  return Object.entries(filter).every(([key, value]) => {
    const itemValue = item[key]
    if (value && typeof value === 'object' && Array.isArray(value.$in)) {
      const allowedIds = value.$in.map(getId)
      return Array.isArray(itemValue)
        ? itemValue.some(entry => allowedIds.includes(getId(entry)))
        : allowedIds.includes(getId(itemValue))
    }
    return Array.isArray(itemValue)
      ? itemValue.some(entry => getId(entry) === getId(value))
      : getId(itemValue) === getId(value)
  })
}

const createModel = (items) => ({
  async findById(id) {
    return items.get(id) || null
  },
  async findByIdAndUpdate(id, data) {
    const current = items.get(id)
    if (!current) return null
    const updated = { ...current, ...data, _id: id }
    items.set(id, updated)
    return updated
  }
})

const createScoreSheetFixture = ({
  allowTeam = true,
  roundStatus = 'SCORING',
  boardStatus = 'SCORING',
  teamStatus = 'CONFIRMED',
  submissionStatus = 'SUBMITTED',
  judgeStatus = 'ACTIVE',
  judgeRoles = [{ name: 'JUDGE' }]
} = {}) => {
  const events = new Map()
  const rounds = new Map()
  const boards = new Map()
  const teams = new Map()
  const submissions = new Map()
  const users = new Map()
  const scoreSheets = new Map()
  const scores = new Map()
  const auditLogs = []

  events.set(ids.event, {
    _id: ids.event,
    competitionConfig: {
      finalistCount: 2,
      finalistsPerBoard: 1,
      finalistSelectionMode: 'FIXED_PER_BOARD',
      tieBreakRule: '10-minute mini test'
    }
  })
  rounds.set(ids.round, {
    _id: ids.round,
    eventId: ids.event,
    rubricId: ids.rubric,
    tieBreakRule: '10-minute mini test',
    status: roundStatus
  })
  teams.set(ids.team1, {
    _id: ids.team1,
    eventId: ids.event,
    name: 'Team One',
    boardNumber: 1,
    chapterName: 'A',
    status: teamStatus
  })
  teams.set(ids.team2, { _id: ids.team2, eventId: ids.event, name: 'Team Two', boardNumber: 1, chapterName: 'B' })
  users.set(ids.judge1, { _id: ids.judge1, fullName: 'Judge One', status: judgeStatus, roles: judgeRoles })
  boards.set(ids.board1, {
    _id: ids.board1,
    eventId: ids.event,
    roundId: ids.round,
    boardNumber: 1,
    teamIds: allowTeam ? [ids.team1] : [ids.team2],
    judgeIds: [ids.judge1],
    status: boardStatus
  })
  submissions.set(ids.submission1, {
    _id: ids.submission1,
    eventId: ids.event,
    roundId: ids.round,
    teamId: ids.team1,
    status: submissionStatus
  })

  const repository = {
    hydrateScoreSheet(scoreSheet) {
      if (!scoreSheet) return null
      return {
        ...scoreSheet,
        scoreIds: (scoreSheet.scoreIds || []).map(score => {
          const scoreId = getId(score)
          return scores.get(scoreId) || score
        })
      }
    },
    async findScoreSheetById(id) {
      return this.hydrateScoreSheet(scoreSheets.get(id) || null)
    },
    async findScoreSheetByRoundTeamJudge({ roundId, teamId, judgeId }) {
      return this.hydrateScoreSheet([...scoreSheets.values()].find(item => item.roundId === roundId && item.teamId === teamId && item.judgeId === judgeId) || null)
    },
    async countScoreSheets(filter = {}) {
      return [...scoreSheets.values()].filter(item => matchesFilter(item, filter)).length
    },
    async findScoreSheets({ filter = {} } = {}) {
      return [...scoreSheets.values()].filter(item => matchesFilter(item, filter)).map(item => this.hydrateScoreSheet(item))
    },
    async createScoreSheet(data) {
      const created = {
        _id: `${String(scoreSheets.size + 1).padStart(24, 'a')}`,
        ...data,
        scoreIds: data.scoreIds || []
      }
      scoreSheets.set(created._id, created)
      return created
    },
    async updateScoreSheetById(id, data) {
      const updated = { ...scoreSheets.get(id), ...data, _id: id }
      scoreSheets.set(id, updated)
      return this.hydrateScoreSheet(updated)
    },
    async deleteScoresByScoreSheetId(scoreSheetId) {
      for (const [scoreId, score] of scores.entries()) {
        if (score.scoreSheetId === scoreSheetId) scores.delete(scoreId)
      }
    },
    async createScores(items) {
      return items.map((item, index) => {
        const created = { _id: `${item.scoreSheetId}-score-${index + 1}`, ...item }
        scores.set(created._id, created)
        return created
      })
    }
  }

  const rubricRepository = {
    async findRubricById(id) {
      if (id !== ids.rubric) return null
      return { _id: ids.rubric, title: 'Official Rubric', totalScore: 100 }
    },
    async findCriteriaByRubricId() {
      return [
        { _id: ids.criterion1, name: 'Correctness', maxScore: 10, weight: 50, order: 1 },
        { _id: ids.criterion2, name: 'Architecture', maxScore: 20, weight: 50, order: 2 }
      ]
    }
  }

  return {
    service: createScoreSheetService({
      repository,
      auditLogRepository: {
        async create(entry) {
          auditLogs.push(entry)
          return entry
        }
      },
      eventModel: createModel(events),
      roundModel: createModel(rounds),
      boardModel: createModel(boards),
      teamModel: createModel(teams),
      submissionModel: createModel(submissions),
      userModel: createModel(users),
      rubricRepository
    }),
    stores: { scoreSheets, scores, auditLogs }
  }
}

const createRankingFixture = ({
  notificationService = null,
  placements = [],
  finalistCount = 2,
  finalistsPerBoard = 1,
  finalistSelectionMode = 'FIXED_PER_BOARD',
  roundType = 'FINAL',
  eventStatus = 'SCORING'
} = {}) => {
  const events = new Map()
  const rounds = new Map()
  const teams = new Map()
  const repositories = new Map()
  const rankings = new Map()
  const scoreSheets = []
  const boards = []
  const auditLogs = []

  events.set(ids.event, {
    _id: ids.event,
    status: eventStatus,
    competitionConfig: {
      finalistCount,
      finalistsPerBoard,
      finalistSelectionMode,
      fillRemainingFinalistsByOverallScore: false,
      tieBreakRule: '10-minute mini test'
    }
  })
  rounds.set(ids.round, {
    _id: ids.round,
    eventId: ids.event,
    roundType,
    tieBreakRule: '10-minute mini test'
  })
  teams.set(ids.team1, {
    _id: ids.team1,
    name: 'Alpha',
    boardNumber: 1,
    chapterName: 'A',
    leaderId: { _id: ids.leader1, email: 'leader@example.com', fullName: 'Leader One' },
    memberIds: [{ _id: ids.member1, email: 'member@example.com', fullName: 'Member One' }]
  })
  teams.set(ids.team2, { _id: ids.team2, name: 'Beta', boardNumber: 1, chapterName: 'B' })
  teams.set(ids.team3, { _id: ids.team3, name: 'Gamma', boardNumber: 2, chapterName: 'C' })
  teams.set(ids.team4, { _id: ids.team4, name: 'Delta', boardNumber: 2, chapterName: 'D' })
  repositories.set('repo-1', { _id: 'repo-1', eventId: ids.event, teamId: ids.team1, status: 'ACTIVE', accessState: 'GRANTED' })
  repositories.set('repo-2', { _id: 'repo-2', eventId: ids.event, teamId: ids.team2, status: 'ACTIVE', accessState: 'GRANTED' })
  repositories.set('repo-3', { _id: 'repo-3', eventId: ids.event, teamId: ids.team3, status: 'ACTIVE', accessState: 'GRANTED' })
  repositories.set('repo-4', { _id: 'repo-4', eventId: ids.event, teamId: ids.team4, status: 'ACTIVE', accessState: 'GRANTED' })

  scoreSheets.push(
    { _id: 'sheet-1', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team1), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 1 }, finalScore: 95, status: 'LOCKED' },
    { _id: 'sheet-2', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team2), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 1 }, finalScore: 90, status: 'LOCKED' },
    { _id: 'sheet-3', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team3), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 2 }, finalScore: 88, status: 'LOCKED' },
    { _id: 'sheet-4', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team4), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 2 }, finalScore: 70, status: 'LOCKED' }
  )
  boards.push(
    {
      _id: ids.board1,
      eventId: ids.event,
      roundId: ids.round,
      boardNumber: 1,
      teamIds: [teams.get(ids.team1), teams.get(ids.team2)],
      judgeIds: [{ _id: ids.judge1, status: 'ACTIVE', roles: [{ name: 'JUDGE' }] }]
    },
    {
      _id: ids.board2,
      eventId: ids.event,
      roundId: ids.round,
      boardNumber: 2,
      teamIds: [teams.get(ids.team3), teams.get(ids.team4)],
      judgeIds: [{ _id: ids.judge1, status: 'ACTIVE', roles: [{ name: 'JUDGE' }] }]
    }
  )

  const repository = {
    async findScoreSheetsForRanking() {
      return scoreSheets
    },
    async deleteRankings(filter) {
      for (const [id, ranking] of rankings.entries()) {
        if (ranking.eventId === filter.eventId && ranking.roundId === filter.roundId && ranking.rankingType === filter.rankingType) {
          rankings.delete(id)
        }
      }
    },
    async createManyRankings(items) {
      return items.map((item, index) => {
        const created = {
          _id: `${String(index + 1).padStart(24, 'b')}`,
          ...item,
          teamId: teams.get(item.teamId) || item.teamId
        }
        rankings.set(created._id, created)
        return created
      })
    },
    async findRankings({ filter = {}, skip = 0, limit = 500 }) {
      return [...rankings.values()]
        .filter(item => Object.entries(filter).every(([key, value]) => item[key] === value))
        .sort((left, right) => left.rank - right.rank)
        .slice(skip, skip + limit)
    },
    async countRankings(filter = {}) {
      return [...rankings.values()].filter(item => Object.entries(filter).every(([key, value]) => item[key] === value)).length
    },
    async updateRankingById(id, data) {
      const updated = { ...rankings.get(id), ...data, _id: id }
      rankings.set(id, updated)
      return updated
    },
    async updateManyRankings(filter, data) {
      for (const [id, ranking] of rankings.entries()) {
        if (Object.entries(filter).every(([key, value]) => ranking[key] === value)) {
          rankings.set(id, { ...ranking, ...data })
        }
      }
    },
    async findRoundTeamPlacements() {
      return placements
    },
    async findBoardsForRanking() {
      return boards
    }
  }

  return {
    service: createRankingService({
      repository,
      auditLogRepository: {
        async create(entry) {
          auditLogs.push(entry)
          return entry
        }
      },
      eventModel: createModel(events),
      roundModel: createModel(rounds),
      teamModel: createModel(teams),
      notificationService,
      repositoryModel: {
        async updateMany(filter, data) {
          let modifiedCount = 0
          for (const [id, repositoryRecord] of repositories.entries()) {
            if (filter._id && repositoryRecord._id !== filter._id) continue
            const matchesTeam = Array.isArray(filter.teamId?.$in)
              ? filter.teamId.$in.includes(repositoryRecord.teamId)
              : true
            const matchesEvent = filter.eventId ? repositoryRecord.eventId === filter.eventId : true
            if (matchesEvent && matchesTeam) {
              repositories.set(id, { ...repositoryRecord, ...data })
              modifiedCount += 1
            }
          }
          return { modifiedCount }
        },
        async updateOne(filter, data) {
          let modifiedCount = 0
          for (const [id, repositoryRecord] of repositories.entries()) {
            if (filter._id && repositoryRecord._id !== filter._id) continue
            repositories.set(id, { ...repositoryRecord, ...data })
            modifiedCount += 1
            break
          }
          return { modifiedCount }
        }
      }
    }),
    stores: { rankings, auditLogs, scoreSheets, boards, events, rounds, repositories }
  }
}

test('judge cannot score unassigned team', async () => {
  const { service } = createScoreSheetFixture({ allowTeam: false })

  await assert.rejects(
    () => service.createScoreSheet({
      eventId: ids.event,
      roundId: ids.round,
      boardId: ids.board1,
      teamId: ids.team1,
      submissionId: ids.submission1,
      scores: [{ criterionId: ids.criterion1, scoreValue: 8 }]
    }, { id: ids.judge1 }),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )
})

test('scoreValue cannot exceed criterion maxScore', async () => {
  const { service } = createScoreSheetFixture()

  await assert.rejects(
    () => service.createScoreSheet({
      eventId: ids.event,
      roundId: ids.round,
      boardId: ids.board1,
      teamId: ids.team1,
      submissionId: ids.submission1,
      scores: [{ criterionId: ids.criterion1, scoreValue: 11 }]
    }, { id: ids.judge1 }),
    (error) => error instanceof ApiError && error.errors.some(message => message.includes('scoreValue cannot exceed criterion maxScore'))
  )
})

test('judge cannot create score sheet until round and board are in SCORING', async () => {
  const { service } = createScoreSheetFixture({ roundStatus: 'OPEN' })

  await assert.rejects(
    () => service.createScoreSheet({
      eventId: ids.event,
      roundId: ids.round,
      boardId: ids.board1,
      teamId: ids.team1,
      submissionId: ids.submission1,
      scores: [{ criterionId: ids.criterion1, scoreValue: 8 }]
    }, judgeActor),
    (error) => error instanceof ApiError && error.errors.includes('Round must be in SCORING status before judges can score')
  )
})

test('judge cannot create score sheet for draft submission or inactive judge account', async () => {
  const draftSubmission = createScoreSheetFixture({ submissionStatus: 'DRAFT' })

  await assert.rejects(
    () => draftSubmission.service.createScoreSheet({
      eventId: ids.event,
      roundId: ids.round,
      boardId: ids.board1,
      teamId: ids.team1,
      submissionId: ids.submission1,
      scores: [{ criterionId: ids.criterion1, scoreValue: 8 }]
    }, judgeActor),
    (error) => error instanceof ApiError && error.errors.includes('Only submitted or accepted submissions can be scored')
  )

  const suspendedJudge = createScoreSheetFixture({ judgeStatus: 'SUSPENDED' })
  await assert.rejects(
    () => suspendedJudge.service.createScoreSheet({
      eventId: ids.event,
      roundId: ids.round,
      boardId: ids.board1,
      teamId: ids.team1,
      submissionId: ids.submission1,
      scores: [{ criterionId: ids.criterion1, scoreValue: 8 }]
    }, judgeActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )

  const nonJudge = createScoreSheetFixture({ judgeRoles: [{ name: 'PARTICIPANT' }] })
  await assert.rejects(
    () => nonJudge.service.createScoreSheet({
      eventId: ids.event,
      roundId: ids.round,
      boardId: ids.board1,
      teamId: ids.team1,
      submissionId: ids.submission1,
      scores: [{ criterionId: ids.criterion1, scoreValue: 8 }]
    }, judgeActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )
})

test('raw score sheet reads are scoped to owning judge and hidden from participants', async () => {
  const { service, stores } = createScoreSheetFixture()

  const created = await service.createScoreSheet({
    eventId: ids.event,
    roundId: ids.round,
    boardId: ids.board1,
    teamId: ids.team1,
    submissionId: ids.submission1,
    scores: [{ criterionId: ids.criterion1, scoreValue: 8 }]
  }, judgeActor)

  stores.scoreSheets.set('aaaaaaaaaaaaaaaaaaaaaa99', {
    _id: 'aaaaaaaaaaaaaaaaaaaaaa99',
    eventId: ids.event,
    roundId: ids.round,
    boardId: ids.board1,
    teamId: ids.team1,
    submissionId: ids.submission1,
    judgeId: ids.judge2,
    scoreIds: [],
    status: 'DRAFT'
  })

  const judgeResult = await service.listScoreSheets({ eventId: ids.event }, judgeActor)
  assert.equal(judgeResult.scoreSheets.length, 1)
  assert.equal(judgeResult.scoreSheets[0].judgeId, ids.judge1)

  await assert.rejects(
    () => service.listScoreSheets({ eventId: ids.event }, participantActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )

  await assert.rejects(
    () => service.getScoreSheetById('aaaaaaaaaaaaaaaaaaaaaa99', judgeActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )

  await assert.rejects(
    () => service.getScoreSheetById(created.id, participantActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )
})

test('submitted score sheet is locked', async () => {
  const { service, stores } = createScoreSheetFixture()

  const created = await service.createScoreSheet({
    eventId: ids.event,
    roundId: ids.round,
    boardId: ids.board1,
    teamId: ids.team1,
    submissionId: ids.submission1,
    scores: [
      { criterionId: ids.criterion1, scoreValue: 9 },
      { criterionId: ids.criterion2, scoreValue: 18 }
    ]
  }, { id: ids.judge1 })

  const submitted = await service.submitScoreSheet(created.id, { id: ids.judge1 })
  assert.equal(submitted.status, 'LOCKED')
  assert.equal(submitted.finalScore, 90)
  assert.equal(stores.auditLogs.at(-1).action, 'SCORE_SHEET_SUBMITTED_AND_LOCKED')
  assert.equal(Object.hasOwn(stores.scores.values().next().value, 'aiSuggestedScore'), false)
  assert.equal(Object.hasOwn(stores.scores.values().next().value, 'aiReviewCriterionId'), false)

  await assert.rejects(
    () => service.updateScoreSheet(created.id, {
      scores: [{ criterionId: ids.criterion1, scoreValue: 7 }]
    }, { id: ids.judge1 }),
    (error) => error instanceof ApiError && error.errors.includes('Submitted score sheet is locked and cannot be changed')
  )
})

test('submitScoreSheet requires exactly one score for every rubric criterion', async () => {
  const { service } = createScoreSheetFixture()

  const created = await service.createScoreSheet({
    eventId: ids.event,
    roundId: ids.round,
    boardId: ids.board1,
    teamId: ids.team1,
    submissionId: ids.submission1,
    scores: [
      { criterionId: ids.criterion1, scoreValue: 9 }
    ]
  }, judgeActor)

  await assert.rejects(
    () => service.submitScoreSheet(created.id, judgeActor),
    (error) => error instanceof ApiError && error.errors.includes('Score sheet must contain exactly one score for each rubric criterion')
  )
})

test('ranking uses judge scores only and ignores AiReview completely', async () => {
  const { service } = createRankingFixture()
  const aiReviews = [
    { teamId: ids.team2, suggestedScore: 999 },
    { teamId: ids.team1, suggestedScore: 1 }
  ]

  const result = await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1, aiReviews })

  assert.equal(result.rankings[0].teamId, ids.team1)
  assert.equal(result.rankings[0].score, 95)
  assert.equal(result.rankings[0].calculationSummary.aiReviewUsed, false)
  assert.equal(result.summary.source, 'OFFICIAL_JUDGE_SCORES_ONLY')
})

test('generateRankings requires a locked score sheet from every assigned judge for every board team', async () => {
  const { service, stores } = createRankingFixture()
  stores.boards[0].judgeIds.push({ _id: ids.judge2, status: 'ACTIVE', roles: [{ name: 'JUDGE' }] })

  await assert.rejects(
    service.generateRankings({
      eventId: ids.event,
      roundId: ids.round,
      rankingType: 'TEAM'
    }, { id: ids.judge1 }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Official ranking requires locked score sheets from every assigned judge for every team')
  )
})

test('finalist selection respects event competitionConfig FIXED_PER_BOARD', async () => {
  const { service } = createRankingFixture()
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })

  const result = await service.selectFinalists({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  assert.equal(result.finalists.length, 2)
  assert.deepEqual(result.finalists.map(item => item.teamId), [ids.team1, ids.team3])
  assert.equal(result.summary.finalistSelectionMode, 'FIXED_PER_BOARD')
})

test('ranking uses round-scoped placement before legacy team board fields', async () => {
  const { service } = createRankingFixture({
    placements: [
      { teamId: ids.team1, boardNumber: 2 },
      { teamId: ids.team2, boardNumber: 2 },
      { teamId: ids.team3, boardNumber: 1 },
      { teamId: ids.team4, boardNumber: 1 }
    ]
  })
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })

  const result = await service.selectFinalists({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  assert.deepEqual(result.finalists.map(item => item.teamId), [ids.team1, ids.team3])
  assert.deepEqual(result.finalists.map(item => item.calculationSummary.boardNumber), [2, 1])
})

test('tie-break manual resolution is traceable', async () => {
  const { service, stores } = createRankingFixture()
  stores.scoreSheets[1].finalScore = 95

  const result = await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })

  assert.equal(result.summary.tiedGroups.length, 1)
  assert.equal(result.rankings[0].rank, result.rankings[1].rank)
  assert.equal(result.rankings[0].note.includes('Manual tie-break trace required'), true)
  assert.equal(result.rankings[1].note.includes('10-minute mini test'), true)
})

test('finalist selection is blocked when an unresolved tie crosses the cutoff', async () => {
  const { service, stores } = createRankingFixture({
    finalistCount: 1,
    finalistsPerBoard: 1,
    finalistSelectionMode: 'OVERALL_SCORE'
  })
  stores.scoreSheets[1].finalScore = 95
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })

  await assert.rejects(
    service.selectFinalists({
      eventId: ids.event,
      roundId: ids.round
    }, { id: ids.judge1 }),
    error => error instanceof ApiError &&
      error.errors.includes('Resolve tie-break before selecting finalists')
  )
})

test('resolveTieBreak stores tie-break decision and allows cutoff selection', async () => {
  const { service, stores } = createRankingFixture({
    finalistCount: 1,
    finalistsPerBoard: 1,
    finalistSelectionMode: 'OVERALL_SCORE'
  })
  stores.scoreSheets[1].finalScore = 95
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })

  const resolved = await service.resolveTieBreak({
    eventId: ids.event,
    roundId: ids.round,
    decisions: [
      {
        teamId: ids.team1,
        tieBreakMethod: 'MINI_TEST',
        miniTestScore: 10,
        tieBreakReason: 'Team One won the official mini test'
      },
      {
        teamId: ids.team2,
        tieBreakMethod: 'MINI_TEST',
        miniTestScore: 8,
        tieBreakReason: 'Team Two placed second in the official mini test'
      }
    ]
  }, { id: ids.judge1 })
  assert.equal(resolved.summary.resolvedCount, 2)
  assert.equal(resolved.rankings[0].tieBreakResolvedBy, ids.judge1)

  const result = await service.selectFinalists({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  assert.deepEqual(result.finalists.map(item => item.teamId), [ids.team1])
  assert.equal(stores.auditLogs.at(-2).action, 'RANKING_TIE_BREAK_RESOLVED')
})

test('CUSTOM finalist mode requires manual finalist selection', async () => {
  const { service } = createRankingFixture({
    finalistSelectionMode: 'CUSTOM'
  })
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })

  await assert.rejects(
    service.selectFinalists({
      eventId: ids.event,
      roundId: ids.round
    }, { id: ids.judge1 }),
    error => error instanceof ApiError &&
      error.errors.includes('CUSTOM finalist selection requires the manual finalist endpoint')
  )
})

test('result publication works and audit log is written for critical ranking actions', async () => {
  const { service, stores } = createRankingFixture()
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })
  await service.selectFinalists({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  const result = await service.publishResults({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  assert.equal(Boolean(result.publishedAt), true)
  assert.equal(result.rankings.every(item => Boolean(item.publishedAt)), true)
  assert.deepEqual(stores.auditLogs.map(item => item.action), [
    'RANKING_GENERATED',
    'FINALISTS_SELECTED',
    'RESULTS_PUBLISHED',
    'EVENT_COMPLETED_AFTER_FINAL_RESULTS'
  ])
})

test('publishResults notifies ranked team members', async () => {
  const notifications = []
  const { service } = createRankingFixture({
    notificationService: {
      notifyUser: async (payload) => {
        notifications.push(payload)
        return { notification: { id: `notification-${notifications.length}` }, email: null, errors: [] }
      }
    }
  })

  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })
  await service.selectFinalists({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  await service.publishResults({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  const teamOneNotifications = notifications.filter(item => item.metadata.teamId === ids.team1)
  assert.equal(teamOneNotifications.length, 2)
  assert.deepEqual(teamOneNotifications.map(item => item.user._id), [ids.leader1, ids.member1])
  assert.equal(teamOneNotifications[0].type, 'RESULT')
  assert.equal(teamOneNotifications[0].channels[0], 'IN_APP')
  assert.equal(teamOneNotifications[0].metadata.targetPath, '/participant/results')
})

test('publishResults can revoke repository access for ranked teams', async () => {
  const { service, stores } = createRankingFixture()
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })
  await service.selectFinalists({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  const result = await service.publishResults({
    eventId: ids.event,
    roundId: ids.round,
    repositoryAccessAction: 'REVOKE'
  }, { id: ids.judge1 })

  assert.equal(result.repositoryAccessAction.action, 'REVOKE')
  assert.equal(result.repositoryAccessAction.affectedRepositories, 4)
  assert.equal(result.repositoryAccessAction.pendingRepositories, 4)
  assert.equal([...stores.repositories.values()].every(item => item.accessState === 'REVOKE_PENDING'), true)
})

test('publishResults completes the event after final round publication', async () => {
  const { service, stores } = createRankingFixture({
    roundType: 'FINAL',
    eventStatus: 'SCORING'
  })
  await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })
  await service.selectFinalists({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  const result = await service.publishResults({
    eventId: ids.event,
    roundId: ids.round
  }, { id: ids.judge1 })

  assert.equal(result.eventCompleted, true)
  assert.equal(stores.events.get(ids.event).status, 'COMPLETED')
  assert.equal(stores.auditLogs.at(-1).action, 'EVENT_COMPLETED_AFTER_FINAL_RESULTS')
})
