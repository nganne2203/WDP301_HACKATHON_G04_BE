import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createRepositoryService } from '../src/modules/repositories/repository.service.js'

test('createRepository stores a linked repository and listRepositories filters by eventId', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const teamModule = await import('../src/models/team.model.js')
  const roundModule = await import('../src/models/round.model.js')

  const EventModel = eventModule.default
  const TeamModel = teamModule.default
  const RoundModel = roundModule.default

  const originalEventFindById = EventModel.findById
  const originalTeamFindById = TeamModel.findById
  const originalRoundFindById = RoundModel.findById

  const stored = new Map()
  let seq = 1
  const repository = {
    count: async (filter = {}) => [...stored.values()].filter(item => !filter.eventId || item.eventId === filter.eventId).length,
    findAll: async ({ filter = {} } = {}) => {
      return [...stored.values()].filter(item => !filter.eventId || item.eventId === filter.eventId)
    },
    findById: async (id) => stored.get(id) || null,
    findByTeamId: async (teamId) => [...stored.values()].find(item => item.teamId === teamId) || null,
    listCommitsByRepository: async () => [],
    countCommitsByRepository: async () => 0,
    create: async (data) => {
      const id = String(seq).padStart(24, '0')
      seq += 1
      const created = { _id: id, ...data }
      stored.set(id, created)
      return created
    },
    updateById: async (id, data) => {
      const updated = { ...stored.get(id), ...data, _id: id }
      stored.set(id, updated)
      return updated
    }
  }

  EventModel.findById = async () => ({ _id: '000000000000000000000101', title: 'SEAL' })
  TeamModel.findById = async () => ({ _id: '000000000000000000000201', eventId: '000000000000000000000101', name: 'Team Alpha' })
  RoundModel.findById = async () => ({ _id: '000000000000000000000301', eventId: '000000000000000000000101', name: 'Round 1' })

  const service = createRepositoryService({ repository })

  try {
    const created = await service.createRepository({
      eventId: '000000000000000000000101',
      teamId: '000000000000000000000201',
      roundId: '000000000000000000000301',
      githubOwner: 'seal-org',
      githubRepo: 'team-alpha',
      repositoryUrl: 'https://github.com/seal-org/team-alpha',
      defaultBranch: 'main',
      status: 'ACTIVE',
      accessState: 'GRANTED'
    })

    assert.equal(created.repositoryFullName, 'seal-org/team-alpha')

    const listed = await service.listRepositories({
      eventId: '000000000000000000000101'
    })

    assert.equal(listed.repositories.length, 1)
    assert.equal(listed.repositories[0].teamId, '000000000000000000000201')
  } finally {
    EventModel.findById = originalEventFindById
    TeamModel.findById = originalTeamFindById
    RoundModel.findById = originalRoundFindById
  }
})

test('listRepositories treats search text as plain text', async () => {
  let receivedFilter = null
  const repository = {
    findAll: async ({ filter }) => {
      receivedFilter = filter
      return []
    },
    count: async () => 0
  }
  const service = createRepositoryService({ repository })

  await service.listRepositories({ search: '[team]+repo' })

  assert.equal(receivedFilter.$or.length, 4)
  assert.equal(receivedFilter.$or[0].repositoryFullName.source, '\\[team\\]\\+repo')
})

test('listConfirmedTeamsMissingRepositories reports confirmed teams without a repo', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const EventModel = eventModule.default
  const TeamModel = teamModule.default

  const originalEventFindById = EventModel.findById
  const originalTeamFind = TeamModel.find

  EventModel.findById = async () => ({ _id: '000000000000000000000101', title: 'SEAL' })
  TeamModel.find = () => ({
    sort: async () => [
      { _id: '000000000000000000000201', eventId: '000000000000000000000101', name: 'Team Alpha', status: 'CONFIRMED' },
      { _id: '000000000000000000000202', eventId: '000000000000000000000101', name: 'Team Beta', status: 'CONFIRMED' }
    ]
  })

  const repository = {
    findAll: async () => [
      { _id: 'repo-1', eventId: '000000000000000000000101', teamId: '000000000000000000000201' }
    ],
    count: async () => 1
  }
  const service = createRepositoryService({ repository })

  try {
    const result = await service.listConfirmedTeamsMissingRepositories({
      eventId: '000000000000000000000101'
    })

    assert.equal(result.summary.confirmedTeamCount, 2)
    assert.equal(result.summary.missingRepositoryCount, 1)
    assert.equal(result.teams[0].id, '000000000000000000000202')
    assert.equal(result.summary.provisioningMode, 'BULK_OR_MANUAL_REQUIRED')
  } finally {
    EventModel.findById = originalEventFindById
    TeamModel.find = originalTeamFind
  }
})

test('createRepository rejects linking the same team twice', async () => {
  const eventModule = await import('../src/models/event.model.js')
  const teamModule = await import('../src/models/team.model.js')

  const EventModel = eventModule.default
  const TeamModel = teamModule.default

  const originalEventFindById = EventModel.findById
  const originalTeamFindById = TeamModel.findById

  const repository = {
    count: async () => 0,
    findAll: async () => [],
    findById: async () => null,
    findByTeamId: async () => ({ _id: '000000000000000000000901', teamId: '000000000000000000000201' }),
    listCommitsByRepository: async () => [],
    countCommitsByRepository: async () => 0,
    create: async (data) => data,
    updateById: async () => null
  }

  EventModel.findById = async () => ({ _id: '000000000000000000000101' })
  TeamModel.findById = async () => ({ _id: '000000000000000000000201', eventId: '000000000000000000000101' })

  const service = createRepositoryService({ repository })

  try {
    await assert.rejects(
      service.createRepository({
        eventId: '000000000000000000000101',
        teamId: '000000000000000000000201',
        githubOwner: 'seal-org',
        githubRepo: 'team-alpha',
        repositoryUrl: 'https://github.com/seal-org/team-alpha'
      }),
      (error) => error instanceof ApiError &&
        error.code === 'CONFLICT' &&
        error.errors.includes('A repository is already linked to this team')
    )
  } finally {
    EventModel.findById = originalEventFindById
    TeamModel.findById = originalTeamFindById
  }
})

test('listRepositoryCommits returns stored commit history for a repository', async () => {
  const repository = {
    count: async () => 1,
    findAll: async () => [],
    findById: async (id) => id === '000000000000000000000111'
      ? { _id: id, repositoryFullName: 'seal-org/team-alpha', githubOwner: 'seal-org', githubRepo: 'team-alpha', defaultBranch: 'main' }
      : null,
    findByTeamId: async () => null,
    listCommitsByRepository: async () => [{
      _id: '000000000000000000000211',
      repositoryId: '000000000000000000000111',
      commitSha: 'abc123',
      branch: 'main',
      authorName: 'Dev A',
      message: 'Initial review trigger',
      filesChanged: 3
    }],
    countCommitsByRepository: async () => 1,
    create: async () => null,
    updateById: async () => null
  }

  const service = createRepositoryService({ repository })
  const result = await service.listRepositoryCommits({
    repositoryId: '000000000000000000000111',
    query: { page: 1, limit: 10 }
  })

  assert.equal(result.repository.repositoryFullName, 'seal-org/team-alpha')
  assert.equal(result.commits.length, 1)
  assert.equal(result.commits[0].commitSha, 'abc123')
})

test('listStaticAnalysis returns static analysis results for a repository', async () => {
  const repository = {
    count: async () => 1,
    findAll: async () => [],
    findById: async (id) => id === '000000000000000000000111'
      ? { _id: id, repositoryFullName: 'seal-org/team-alpha', githubOwner: 'seal-org', githubRepo: 'team-alpha', defaultBranch: 'main' }
      : null,
    findByTeamId: async () => null,
    listCommitsByRepository: async () => [],
    countCommitsByRepository: async () => 0,
    listStaticAnalysisByRepository: async () => [{
      _id: '000000000000000000000311',
      repositoryId: '000000000000000000000111',
      commitSha: 'abc123',
      source: 'COMMAND_HOOK_ESLINT',
      status: 'COMPLETED',
      errorCount: 2,
      warningCount: 5,
      findings: []
    }],
    countStaticAnalysisByRepository: async () => 1,
    create: async () => null,
    updateById: async () => null
  }

  const service = createRepositoryService({ repository })
  const result = await service.listStaticAnalysis({
    repositoryId: '000000000000000000000111',
    query: { page: 1, limit: 10 }
  })

  assert.equal(result.repository.repositoryFullName, 'seal-org/team-alpha')
  assert.equal(result.analysisResults.length, 1)
  assert.equal(result.analysisResults[0].commitSha, 'abc123')
  assert.equal(result.analysisResults[0].errorCount, 2)
  assert.equal(result.analysisResults[0].warningCount, 5)
})
