import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createCompetitionService } from '../src/modules/competitions/competition.service.js'

const createRepository = () => {
  const records = new Map()
  let sequence = 1

  return {
    count: async () => records.size,
    findAll: async () => [...records.values()],
    findById: async (id) => records.get(id) || null,
    findCompetitionIdsForParticipant: async () => [],
    findOpenRegistrationCompetitionIds: async () => [],
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
    }
  }
}

const countModel = (value) => ({
  async countDocuments() {
    return value
  }
})

const testAuditLogRepository = {
  async create(entry) {
    return entry
  }
}

const createService = (overrides = {}) => {
  return createCompetitionService({
    repository: createRepository(),
    notificationService: { sendCompetitionInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: countModel(0),
    ...overrides
  })
}

test('createCompetition stores dynamic competition config and syncs legacy finalist fields', async () => {
  const service = createService()

  const competition = await service.createCompetition({
    title: 'SEAL Hackathon Spring 2026',
    season: 'SPRING',
    year: 2026,
    competitionConfig: {
      boardCount: 3,
      maxTeamsPerBoard: 8,
      finalistCount: 6,
      finalistsPerBoard: 2,
      finalistSelectionMode: 'FIXED_PER_BOARD',
      rankingScopes: ['TEAM'],
      tieBreakRule: '10-minute mini test'
    }
  }, { id: '000000000000000000000099' })

  assert.equal(competition.competitionConfig.boardCount, 3)
  assert.equal(competition.competitionConfig.trackCount, 3)
  assert.equal(competition.competitionConfig.finalistCount, 6)
  assert.equal(competition.competitionConfig.finalistsPerBoard, 2)
  assert.deepEqual(competition.competitionConfig.rankingScopes, ['TEAM'])
  assert.equal(competition.finalistSlotsPerTrack, 2)
  assert.equal(competition.totalFinalistSlots, 6)
})

test('createCompetition rejects unsupported ranking scopes until official generation exists', async () => {
  const service = createService()

  await assert.rejects(
    service.createCompetition({
      title: 'Unsupported Ranking Scope',
      competitionConfig: {
        rankingScopes: ['TEAM', 'CHAPTER']
      }
    }, { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Ranking scope CHAPTER is not supported for official generation yet')
  )
})

test('createCompetition derives competition config from legacy finalist fields for backward compatibility', async () => {
  const service = createService()

  const competition = await service.createCompetition({
    title: 'Legacy-Compatible Competition',
    finalistSlotsPerTrack: 5,
    totalFinalistSlots: 10
  }, { id: '000000000000000000000099' })

  assert.equal(competition.competitionConfig.finalistsPerBoard, 5)
  assert.equal(competition.competitionConfig.finalistCount, 10)
  assert.equal(competition.competitionConfig.finalistSelectionMode, 'FIXED_PER_BOARD')
  assert.deepEqual(competition.competitionConfig.rankingScopes, ['TEAM'])
})

test('listCompetitions and getCompetitionById include the competition round count', async () => {
  const repository = createRepository()
  const roundCounts = new Map()
  const service = createCompetitionService({
    repository,
    notificationService: { sendCompetitionInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: {
      async countDocuments(filter = {}) {
        return roundCounts.get(filter.competitionId?.toString?.() || String(filter.competitionId)) || 0
      }
    }
  })

  const competition = await service.createCompetition({ title: 'Round Count Competition' }, { id: '000000000000000000000099' })
  roundCounts.set(competition.id, 3)

  const listResult = await service.listCompetitions({}, { roles: ['COORDINATOR'] })
  const detailResult = await service.getCompetitionById(competition.id, { roles: ['COORDINATOR'] })

  assert.equal(listResult.competitions[0].roundCount, 3)
  assert.equal(detailResult.roundCount, 3)
})

test('only admin and coordinators can list or retrieve draft competitions', async () => {
  const repository = createRepository()
  const service = createCompetitionService({ repository, notificationService: { sendCompetitionInvitations: async () => ({}) }, auditLogRepository: testAuditLogRepository, roundModel: countModel(0) })
  const draft = await service.createCompetition({ title: 'Hidden draft', status: 'DRAFT' }, { id: '000000000000000000000099' })
  let receivedFilter = null
  const originalFindAll = repository.findAll
  repository.findAll = async ({ filter }) => {
    receivedFilter = filter
    return await originalFindAll({ filter })
  }

  await service.listCompetitions({}, { roles: ['PARTICIPANT'] })
  assert.deepEqual(receivedFilter.status, { $ne: 'DRAFT' })

  await service.listCompetitions({ status: 'DRAFT' }, { roles: ['MENTOR'] })
  assert.deepEqual(receivedFilter.status, { $in: [] })

  await assert.rejects(
    service.getCompetitionById(draft.id, { roles: ['PARTICIPANT'] }),
    error => error instanceof ApiError && error.code === 'NOT_FOUND'
  )

  const coordinatorDraft = await service.getCompetitionById(draft.id, { roles: ['COORDINATOR'] })
  assert.equal(coordinatorDraft.id, draft.id)
})

test('participant can only list and retrieve competitions they joined or can register for', async () => {
  const repository = createRepository()
  const service = createCompetitionService({ repository, notificationService: { sendCompetitionInvitations: async () => ({}) }, auditLogRepository: testAuditLogRepository, roundModel: countModel(0) })
  const competition = await service.createCompetition({ title: 'Joined competition' }, { id: '000000000000000000000099' })
  await repository.updateById(competition.id, { status: 'COMPLETED' })
  let receivedFilter = null
  repository.findAll = async ({ filter }) => {
    receivedFilter = filter
    return []
  }
  repository.count = async () => 0

  await service.listCompetitions({}, { id: '000000000000000000000301', roles: ['PARTICIPANT'] })
  assert.deepEqual(receivedFilter._id, { $in: [] })
  await assert.rejects(
    service.getCompetitionById(competition.id, { id: '000000000000000000000301', roles: ['PARTICIPANT'] }),
    error => error instanceof ApiError && error.code === 'NOT_FOUND'
  )

  repository.findCompetitionIdsForParticipant = async () => [competition.id]
  const joinedCompetition = await service.getCompetitionById(competition.id, { id: '000000000000000000000301', roles: ['PARTICIPANT'] })
  assert.equal(joinedCompetition.id, competition.id)

  const openCompetition = await service.createCompetition({ title: 'Open competition' }, { id: '000000000000000000000099' })
  await repository.updateById(openCompetition.id, { status: 'OPEN_REGISTRATION' })
  repository.findOpenRegistrationCompetitionIds = async () => [openCompetition.id]
  const visibleOpenCompetition = await service.getCompetitionById(openCompetition.id, { id: '000000000000000000000301', roles: ['PARTICIPANT'] })
  assert.equal(visibleOpenCompetition.id, openCompetition.id)

  repository.findCompetitionIdsForParticipant = async () => []
  await assert.rejects(
    service.getCompetitionById(competition.id, { id: '000000000000000000000301', roles: ['USER'] }),
    error => error instanceof ApiError && error.code === 'NOT_FOUND'
  )
})

test('updateCompetition rejects invalid fixed-per-board finalist math', async () => {
  const service = createService()

  const created = await service.createCompetition({
    title: 'SEAL Hackathon Fall 2025',
    competitionConfig: {
      boardCount: 2,
      finalistCount: 10,
      finalistsPerBoard: 5,
      finalistSelectionMode: 'FIXED_PER_BOARD'
    }
  }, { id: '000000000000000000000099' })

  await assert.rejects(
    service.updateCompetition(created.id, {
      competitionConfig: {
        boardCount: 3,
        finalistCount: 10,
        finalistsPerBoard: 2,
        finalistSelectionMode: 'FIXED_PER_BOARD'
      }
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('competitionConfig.finalistCount must equal boardCount * finalistsPerBoard for FIXED_PER_BOARD mode')
  )
})

test('updateCompetitionStatus rejects unconfirmed teams when registration closes', async () => {
  const repository = createRepository()
  const rejectedCompetitions = []
  const auditLogs = []
  const service = createCompetitionService({
    repository,
    notificationService: { sendCompetitionInvitations: async () => ({}) },
    auditLogRepository: {
      async create(entry) {
        auditLogs.push(entry)
        return entry
      }
    },
    roundModel: countModel(0),
    teamService: {
      rejectUnconfirmedTeamsForRegistrationClosure: async (payload) => {
        rejectedCompetitions.push(payload)
        return { rejectedCount: 2 }
      }
    }
  })

  const created = await service.createCompetition({
    title: 'SEAL Hackathon Registration'
  }, { id: '000000000000000000000099' })

  await service.updateCompetitionStatus(created.id, 'OPEN_REGISTRATION', { id: '000000000000000000000099' })
  const competition = await service.updateCompetitionStatus(created.id, 'REGISTRATION_CLOSED')

  assert.equal(competition.status, 'REGISTRATION_CLOSED')
  assert.equal(competition.registrationCloseReason, 'MANUALLY_CLOSED')
  assert.equal(rejectedCompetitions.length, 1)
  assert.equal(rejectedCompetitions[0].competition._id, created.id)
  assert.equal(rejectedCompetitions[0].reason, 'Registration has closed before this team was fully confirmed.')
  assert.deepEqual(auditLogs.map(log => log.metadata.toStatus), ['OPEN_REGISTRATION', 'REGISTRATION_CLOSED'])
})

test('updateCompetition rejects direct status changes outside the lifecycle endpoint', async () => {
  const repository = createRepository()
  const service = createCompetitionService({
    repository,
    notificationService: { sendCompetitionInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: countModel(0)
  })

  const created = await service.createCompetition({
    title: 'SEAL Hackathon Update Close'
  }, { id: '000000000000000000000099' })

  await assert.rejects(
    service.updateCompetition(created.id, { status: 'REGISTRATION_CLOSED' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Use the competition status workflow endpoint to change competition status')
  )
})

test('deleteCompetition only allows unused draft competitions', async () => {
  const repository = createRepository()
  const service = createCompetitionService({
    repository,
    notificationService: { sendCompetitionInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: countModel(0),
    submissionModel: {
      async findOne() { return null },
      async countDocuments() { return 0 }
    },
    boardModel: {
      async findOne() { return null },
      async countDocuments() { return 0 }
    },
    teamModel: countModel(0),
    repositoryModel: countModel(0),
    rankingModel: countModel(0),
    workshopModel: countModel(0),
    timelineModel: countModel(0),
    trackModel: countModel(0)
  })

  const draft = await service.createCompetition({ title: 'Unused Draft' }, { id: '000000000000000000000099' })
  await service.deleteCompetition(draft.id)
  await assert.rejects(
    service.getCompetitionById(draft.id, { roles: ['ADMIN'] }),
    error => error instanceof ApiError && error.code === 'NOT_FOUND'
  )

  const nonDraft = await service.createCompetition({ title: 'Open Competition' }, { id: '000000000000000000000099' })
  await repository.updateById(nonDraft.id, { status: 'OPEN_REGISTRATION' })
  await assert.rejects(
    service.deleteCompetition(nonDraft.id),
    error => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Only unused DRAFT competitions can be deleted; archive the competition through the lifecycle workflow instead')
  )
})

test('createCompetition rejects non-draft lifecycle status', async () => {
  const service = createService()

  await assert.rejects(
    service.createCompetition({
      title: 'Invalid Direct Completed Competition',
      status: 'COMPLETED'
    }, { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Competitions must be created in DRAFT status and moved through the lifecycle workflow')
  )
})

test('updateCompetitionStatus rejects skipped lifecycle transitions and impossible manual timing', async () => {
  const service = createService({
    nowProvider: () => new Date('2026-07-12T00:00:00.000Z')
  })

  const created = await service.createCompetition({
    title: 'Lifecycle Test Competition',
    registrationStart: '2026-07-13T00:00:00.000Z',
    registrationEnd: '2026-07-14T00:00:00.000Z',
    startDate: '2026-07-15T00:00:00.000Z'
  }, { id: '000000000000000000000099' })

  await assert.rejects(
    service.updateCompetitionStatus(created.id, 'SCORING', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Invalid competition status transition from DRAFT to SCORING')
  )

  await assert.rejects(
    service.updateCompetitionStatus(created.id, 'OPEN_REGISTRATION', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Registration cannot be opened before registrationStart')
  )
})

test('updateCompetitionStatus requires scoring round, board, and submission before competition scoring', async () => {
  const repository = createRepository()
  const service = createCompetitionService({
    repository,
    notificationService: { sendCompetitionInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: {
      async findOne() {
        return null
      }
    },
    boardModel: {
      async findOne() {
        return null
      }
    },
    submissionModel: {
      async findOne() {
        return null
      }
    }
  })

  const created = await service.createCompetition({
    title: 'Scoring Readiness Competition'
  }, { id: '000000000000000000000099' })
  await repository.updateById(created.id, { status: 'ONGOING' })

  await assert.rejects(
    service.updateCompetitionStatus(created.id, 'SCORING', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('At least one round with an active rubric must be in SCORING before the competition can enter SCORING')
  )
})

test('updateCompetitionStatus verifies scoring board judges are active judges', async () => {
  const repository = createRepository()
  const service = createCompetitionService({
    repository,
    notificationService: { sendCompetitionInvitations: async () => ({}) },
    auditLogRepository: testAuditLogRepository,
    roundModel: {
      async findOne() {
        return {
          _id: '000000000000000000000201',
          competitionId: '000000000000000000000101',
          status: 'SCORING',
          rubricId: '000000000000000000000301'
        }
      }
    },
    boardModel: {
      async find() {
        return [{
          _id: '000000000000000000000401',
          competitionId: '000000000000000000000101',
          roundId: '000000000000000000000201',
          status: 'SCORING',
          teamIds: ['000000000000000000000501'],
          judgeIds: ['000000000000000000000601']
        }]
      }
    },
    submissionModel: {
      async findOne() {
        return { _id: '000000000000000000000701', status: 'SUBMITTED' }
      }
    },
    userModel: {
      async find() {
        return [{ _id: '000000000000000000000601', status: 'ACTIVE', roles: [{ name: 'PARTICIPANT' }] }]
      }
    }
  })

  const created = await service.createCompetition({
    title: 'Scoring Judge Readiness Competition'
  }, { id: '000000000000000000000099' })
  await repository.updateById(created.id, { status: 'ONGOING' })

  await assert.rejects(
    service.updateCompetitionStatus(created.id, 'SCORING', { id: '000000000000000000000099' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('All scoring board judges must have ACTIVE accounts and the JUDGE role')
  )
})
