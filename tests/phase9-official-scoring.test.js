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
  criterion2: '999999999999999999999992'
}

const createModel = (items) => ({
  async findById(id) {
    return items.get(id) || null
  }
})

const createScoreSheetFixture = ({ allowTeam = true } = {}) => {
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
    tieBreakRule: '10-minute mini test'
  })
  teams.set(ids.team1, { _id: ids.team1, eventId: ids.event, name: 'Team One', boardNumber: 1, chapterName: 'A' })
  teams.set(ids.team2, { _id: ids.team2, eventId: ids.event, name: 'Team Two', boardNumber: 1, chapterName: 'B' })
  users.set(ids.judge1, { _id: ids.judge1, fullName: 'Judge One', status: 'APPROVED' })
  boards.set(ids.board1, {
    _id: ids.board1,
    eventId: ids.event,
    roundId: ids.round,
    boardNumber: 1,
    teamIds: allowTeam ? [ids.team1] : [ids.team2],
    judgeIds: [ids.judge1]
  })
  submissions.set(ids.submission1, {
    _id: ids.submission1,
    eventId: ids.event,
    roundId: ids.round,
    teamId: ids.team1
  })

  const repository = {
    async findScoreSheetById(id) {
      return scoreSheets.get(id) || null
    },
    async findScoreSheetByRoundTeamJudge({ roundId, teamId, judgeId }) {
      return [...scoreSheets.values()].find(item => item.roundId === roundId && item.teamId === teamId && item.judgeId === judgeId) || null
    },
    async countScoreSheets() {
      return scoreSheets.size
    },
    async findScoreSheets() {
      return [...scoreSheets.values()]
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
      return updated
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
      return { _id: ids.rubric, title: 'Official Rubric' }
    },
    async findCriteriaByRubricId() {
      return [
        { _id: ids.criterion1, name: 'Correctness', maxScore: 10, weight: 1, order: 1 },
        { _id: ids.criterion2, name: 'Architecture', maxScore: 20, weight: 2, order: 2 }
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

const createRankingFixture = () => {
  const events = new Map()
  const rounds = new Map()
  const teams = new Map()
  const rankings = new Map()
  const scoreSheets = []
  const auditLogs = []

  events.set(ids.event, {
    _id: ids.event,
    competitionConfig: {
      finalistCount: 2,
      finalistsPerBoard: 1,
      finalistSelectionMode: 'FIXED_PER_BOARD',
      fillRemainingFinalistsByOverallScore: false,
      tieBreakRule: '10-minute mini test'
    }
  })
  rounds.set(ids.round, {
    _id: ids.round,
    eventId: ids.event,
    tieBreakRule: '10-minute mini test'
  })
  teams.set(ids.team1, { _id: ids.team1, name: 'Alpha', boardNumber: 1, chapterName: 'A' })
  teams.set(ids.team2, { _id: ids.team2, name: 'Beta', boardNumber: 1, chapterName: 'B' })
  teams.set(ids.team3, { _id: ids.team3, name: 'Gamma', boardNumber: 2, chapterName: 'C' })
  teams.set(ids.team4, { _id: ids.team4, name: 'Delta', boardNumber: 2, chapterName: 'D' })

  scoreSheets.push(
    { _id: 'sheet-1', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team1), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 1 }, finalScore: 95, status: 'LOCKED' },
    { _id: 'sheet-2', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team2), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 1 }, finalScore: 90, status: 'LOCKED' },
    { _id: 'sheet-3', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team3), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 2 }, finalScore: 88, status: 'LOCKED' },
    { _id: 'sheet-4', eventId: ids.event, roundId: ids.round, teamId: teams.get(ids.team4), judgeId: { _id: ids.judge1 }, boardId: { boardNumber: 2 }, finalScore: 70, status: 'LOCKED' }
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
      teamModel: createModel(teams)
    }),
    stores: { rankings, auditLogs, scoreSheets, events, rounds }
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

test('tie-break manual resolution is traceable', async () => {
  const { service, stores } = createRankingFixture()
  stores.scoreSheets[1].finalScore = 95

  const result = await service.generateRankings({
    eventId: ids.event,
    roundId: ids.round,
    rankingType: 'TEAM'
  }, { id: ids.judge1 })

  assert.equal(result.summary.tiedGroups.length, 1)
  assert.equal(result.rankings[0].note.includes('Manual tie-break trace required'), true)
  assert.equal(result.rankings[1].note.includes('10-minute mini test'), true)
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
    'RESULTS_PUBLISHED'
  ])
})
