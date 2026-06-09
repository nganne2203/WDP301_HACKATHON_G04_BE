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
