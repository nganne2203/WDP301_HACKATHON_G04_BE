import assert from 'node:assert/strict'
import test from 'node:test'

import Participant from '../src/models/participant.model.js'
import { GITHUB_REPOSITORY } from '../src/modules/github/github.repository.js'
import { createGithubService } from '../src/modules/github/github.service.js'

const createRepository = () => {
  const configs = new Map()
  const auditLogs = []
  const repositories = new Map()
  const teams = []

  return {
    configs,
    auditLogs,
    repositories,
    teams,
    findConfigByKey: async (key) => configs.get(key) || null,
    upsertConfig: async ({ key, value, isEncrypted, updatedBy }) => {
      const record = { key, value, isEncrypted, updatedBy }
      configs.set(key, record)
      return record
    },
    createRepositoryRecord: async (payload) => {
      const record = { _id: payload.repoName || payload.githubRepo, ...payload }
      repositories.set(`${payload.eventId}:${payload.githubOwner || payload.githubOrg}:${payload.repoName || payload.githubRepo}`, record)
      return record
    },
    findRepositoryByEventAndRepoName: async ({ eventId, repoName, githubOwner }) => {
      return repositories.get(`${eventId}:${githubOwner}:${repoName}`) || null
    },
    updateRepositoryById: async (id, updates) => {
      const entry = [...repositories.entries()].find(([, value]) => value._id === id)
      if (!entry) return null
      const [key, value] = entry
      const updated = { ...value, ...updates }
      repositories.set(key, updated)
      return updated
    },
    createAuditLog: async (payload) => {
      auditLogs.push(payload)
      return payload
    },
    findConfirmedTeamsByEvent: async (eventId) => {
      return teams.filter(t => t.eventId === eventId)
    },
    findTeamById: async (teamId) => teams.find(team => team._id === teamId) || null,
    findRepositoriesByEvent: async (eventId) => {
      return [...repositories.values()].filter(r => r.eventId === eventId)
    },
    findTeamMembersGithubUsernames: async (teamId) => {
      return ['user-alpha', 'user-beta']
    }
  }
}

const createEncryption = () => ({
  encrypt: (value) => `encrypted:${value}`,
  decrypt: (value) => String(value).replace(/^encrypted:/, '')
})

const createLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {}
})

const EVENT_ID = '664c3f6a3a6d4a5f3f93b901'
const eventConfigKey = `github.event.${EVENT_ID}.organization`

test('findTeamMembersGithubUsernames reads joined participants, not active user statuses', async () => {
  const originalFind = Participant.find
  let capturedFilter = null
  try {
    Participant.find = (filter) => {
      capturedFilter = filter
      return {
        populate: async () => [
          { userId: { githubUsername: 'user-alpha' } },
          { userId: { githubUsername: '' } },
          { userId: { githubUsername: 'user-beta' } }
        ]
      }
    }

    const usernames = await GITHUB_REPOSITORY.findTeamMembersGithubUsernames('team-123')

    assert.deepEqual(capturedFilter, {
      teamId: 'team-123',
      status: { $in: ['JOINED'] }
    })
    assert.deepEqual(usernames, ['user-alpha', 'user-beta'])
  } finally {
    Participant.find = originalFind
  }
})

test('bulkCreateRepositories creates repos only for confirmed teams lacking them', async () => {
  const repository = createRepository()
  await repository.upsertConfig({
    key: eventConfigKey,
    value: {
      eventId: EVENT_ID,
      organizationName: 'seal-org',
      ownerUsername: 'owner-user',
      enabled: true,
      tokenEncrypted: 'encrypted:token'
    },
    isEncrypted: true
  })

  // Seed two confirmed teams
  repository.teams.push(
    { _id: 'team-1-id', name: 'Team Alpha', eventId: EVENT_ID },
    { _id: 'team-2-id', name: 'Team Beta', eventId: EVENT_ID }
  )

  // Seed one existing repository for Team Alpha
  await repository.createRepositoryRecord({
    eventId: EVENT_ID,
    teamId: 'team-1-id',
    githubOwner: 'seal-org',
    githubRepo: 'team-alpha',
    repoName: 'team-alpha',
    repoUrl: 'https://github.com/seal-org/team-alpha'
  })

  const calls = []
  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      return {
        status: 201,
        data: {
          name: payload.body.name,
          html_url: `https://github.com/seal-org/${payload.body.name}`,
          clone_url: `https://github.com/seal-org/${payload.body.name}.git`,
          visibility: 'private'
        }
      }
    },
    logger: createLogger()
  })

  const result = await service.bulkCreateRepositories({
    eventId: EVENT_ID,
    roundId: 'none'
  }, { id: 'coordinator-1' })

  console.log('REPOS:', [...repository.repositories.values()])
  console.log('TEAMS:', repository.teams)
  console.log('RESULT:', result)

  // Should check 2 teams, but only create repo for Team Beta
  assert.equal(result.totalTeamsChecked, 2)
  assert.equal(result.totalReposCreated, 1)
  assert.equal(result.success.length, 1)
  assert.equal(result.success[0].teamName, 'Team Beta')
  assert.equal(result.success[0].repoName, 'team-beta')
  assert.equal(result.failed.length, 0)

  // Webhook and collab registry calls should be made for team beta
  const createRepoCalls = calls.filter(call => call.method === 'POST' && call.path === '/orgs/seal-org/repos')
  assert.equal(createRepoCalls.length, 1)
  assert.equal(createRepoCalls[0].path, '/orgs/seal-org/repos')
  assert.equal(createRepoCalls[0].body.name, 'team-beta')
})

test('bulkCreateRepositories aggregates errors and continues loop when one team creation fails', async () => {
  const repository = createRepository()
  await repository.upsertConfig({
    key: eventConfigKey,
    value: {
      eventId: EVENT_ID,
      organizationName: 'seal-org',
      ownerUsername: 'owner-user',
      enabled: true,
      tokenEncrypted: 'encrypted:token'
    },
    isEncrypted: true
  })

  repository.teams.push(
    { _id: 'team-1-id', name: 'Team Fail', eventId: EVENT_ID },
    { _id: 'team-2-id', name: 'Team Success', eventId: EVENT_ID }
  )

  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      if (payload.body.name === 'team-fail') {
        throw new Error('GitHub limit reached')
      }
      return {
        status: 201,
        data: {
          name: payload.body.name,
          html_url: `https://github.com/seal-org/${payload.body.name}`
        }
      }
    },
    logger: createLogger()
  })

  const result = await service.bulkCreateRepositories({
    eventId: EVENT_ID,
    roundId: null
  }, { id: 'coordinator-1' })

  assert.equal(result.totalTeamsChecked, 2)
  assert.equal(result.totalReposCreated, 1)
  assert.equal(result.success.length, 1)
  assert.equal(result.success[0].teamName, 'Team Success')
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].teamName, 'Team Fail')
  assert.equal(result.failed[0].error, 'GitHub limit reached')
})

test('createRepository automatically assigns collaborators from team members', async () => {
  const repository = createRepository()
  repository.teams.push({ _id: 'team-123', name: 'Team Repo', eventId: EVENT_ID, status: 'CONFIRMED' })
  await repository.upsertConfig({
    key: eventConfigKey,
    value: {
      eventId: EVENT_ID,
      organizationName: 'seal-org',
      ownerUsername: 'owner-user',
      enabled: true,
      tokenEncrypted: 'encrypted:token'
    },
    isEncrypted: true
  })

  const calls = []
  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      return {
        status: 201,
        data: {
          name: payload.body?.name || 'repo',
          html_url: `https://github.com/seal-org/repo`
        }
      }
    },
    logger: createLogger()
  })

  await service.createRepository({
    eventId: EVENT_ID,
    teamId: 'team-123',
    repoName: 'team-repo',
    private: true
  }, { id: 'coordinator-1' })

  // Verify it calls GitHub API to create repository AND to assign collaborators (user-alpha, user-beta)
  const repoCreateCall = calls.find(call => call.method === 'POST' && call.path === '/orgs/seal-org/repos')
  assert.ok(repoCreateCall)
  assert.equal(repoCreateCall.body.name, 'team-repo')

  const collaboratorCalls = calls.filter(call => call.method === 'PUT' && call.path.includes('/collaborators/'))
  assert.equal(collaboratorCalls.length, 2)
  assert.ok(collaboratorCalls.some(call => call.path.endsWith('/user-alpha')))
  assert.ok(collaboratorCalls.some(call => call.path.endsWith('/user-beta')))
})

test('createRepository rejects non-confirmed teams unless admin override is provided', async () => {
  const repository = createRepository()
  repository.teams.push({ _id: 'team-waiting', name: 'Team Waiting', eventId: EVENT_ID, status: 'WAITING_FOR_MEMBERS' })
  await repository.upsertConfig({
    key: eventConfigKey,
    value: {
      eventId: EVENT_ID,
      organizationName: 'seal-org',
      ownerUsername: 'owner-user',
      enabled: true,
      tokenEncrypted: 'encrypted:token'
    },
    isEncrypted: true
  })

  const calls = []
  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      return {
        status: 201,
        data: {
          name: payload.body?.name || 'repo',
          html_url: 'https://github.com/seal-org/repo'
        }
      }
    },
    logger: createLogger()
  })

  await assert.rejects(
    service.createRepository({
      eventId: EVENT_ID,
      teamId: 'team-waiting',
      repoName: 'team-waiting'
    }, { id: 'coordinator-1', roles: ['COORDINATOR'] }),
    error => error.errors.includes('Repository creation is only allowed for CONFIRMED teams unless an admin override reason is provided')
  )

  await service.createRepository({
    eventId: EVENT_ID,
    teamId: 'team-waiting',
    repoName: 'team-waiting',
    overrideReason: 'Exceptional sponsor demo repository'
  }, { id: 'admin-1', roles: ['ADMIN'] })

  assert.equal(calls.some(call => call.path === '/orgs/seal-org/repos'), true)
})

test('bulkGrantAccess skips repositories whose teams are not confirmed', async () => {
  const repository = createRepository()
  await repository.upsertConfig({
    key: eventConfigKey,
    value: {
      eventId: EVENT_ID,
      organizationName: 'seal-org',
      ownerUsername: 'owner-user',
      enabled: true,
      tokenEncrypted: 'encrypted:token'
    },
    isEncrypted: true
  })
  await repository.createRepositoryRecord({
    eventId: EVENT_ID,
    teamId: { _id: 'team-waiting', status: 'WAITLISTED' },
    githubOwner: 'seal-org',
    githubRepo: 'team-waiting',
    repoName: 'team-waiting',
    repoUrl: 'https://github.com/seal-org/team-waiting'
  })

  const calls = []
  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      return { status: 204, data: {} }
    },
    logger: createLogger()
  })

  const result = await service.bulkGrantAccess({
    eventId: EVENT_ID
  }, { id: 'coordinator-1' })

  assert.equal(result.success.length, 0)
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].error, 'Repository access can only be granted to CONFIRMED teams')
  assert.equal(calls.some(call => call.method === 'PUT' && call.path.includes('/collaborators/')), false)
})
