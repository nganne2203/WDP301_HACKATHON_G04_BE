import assert from 'node:assert/strict'
import test from 'node:test'

import { createGithubService } from '../src/modules/github/github.service.js'

const createRepository = () => {
  const configs = new Map()
  const auditLogs = []

  return {
    configs,
    auditLogs,
    findConfigByKey: async (key) => configs.get(key) || null,
    upsertConfig: async ({ key, value, isEncrypted, updatedBy }) => {
      const record = { key, value, isEncrypted, updatedBy }
      configs.set(key, record)
      return record
    },
    createRepositoryRecord: async (payload) => payload,
    createAuditLog: async (payload) => {
      auditLogs.push(payload)
      return payload
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
const SECOND_EVENT_ID = '664c3f6a3a6d4a5f3f93b902'
const eventConfigKey = `github.event.${EVENT_ID}.organization`
const secondEventConfigKey = `github.event.${SECOND_EVENT_ID}.organization`

test('GitHub config is stored safely and does not expose token', async () => {
  const repository = createRepository()
  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async () => ({ data: {}, status: 200 }),
    logger: createLogger()
  })

  const saved = await service.saveConfig({
    eventId: EVENT_ID,
    organizationName: 'seal-org',
    ownerUsername: 'owner-user',
    githubToken: 'github_pat_secret',
    enabled: true
  }, { id: 'admin-1' })

  assert.deepEqual(saved, {
    eventId: EVENT_ID,
    organizationName: 'seal-org',
    ownerUsername: 'owner-user',
    enabled: true,
    hasToken: true
  })
  assert.equal(repository.configs.get(eventConfigKey).value.tokenEncrypted, 'encrypted:github_pat_secret')
  assert.equal(repository.configs.get(eventConfigKey).isEncrypted, true)
  assert.equal(Object.hasOwn(saved, 'githubToken'), false)
  assert.equal(repository.configs.size, 1)

  await service.saveConfig({
    eventId: EVENT_ID,
    organizationName: 'seal-org-2',
    ownerUsername: 'owner-user',
    githubToken: '',
    enabled: true
  }, { id: 'admin-1' })

  assert.equal(repository.configs.get(eventConfigKey).value.tokenEncrypted, 'encrypted:github_pat_secret')
  assert.equal(repository.configs.size, 1)

  await service.saveConfig({
    eventId: SECOND_EVENT_ID,
    organizationName: 'seal-org-event-2',
    ownerUsername: 'owner-user',
    githubToken: 'second-token',
    enabled: true
  }, { id: 'admin-1' })

  assert.equal(repository.configs.size, 2)
  assert.equal(repository.configs.get(secondEventConfigKey).value.organizationName, 'seal-org-event-2')
})

test('createRepository calls GitHub org repos API with auto_init', async () => {
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
  const calls = []

  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      return {
        status: 201,
        data: {
          name: 'team-alpha-project',
          html_url: 'https://github.com/seal-org/team-alpha-project',
          clone_url: 'https://github.com/seal-org/team-alpha-project.git',
          visibility: 'private'
        }
      }
    },
    logger: createLogger()
  })

  const result = await service.createRepository({
    eventId: EVENT_ID,
    repoName: 'team-alpha-project',
    description: 'Repository for Team Alpha',
    private: true
  }, { id: 'coordinator-1' })

  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].path, '/orgs/seal-org/repos')
  assert.deepEqual(calls[0].body, {
    name: 'team-alpha-project',
    description: 'Repository for Team Alpha',
    private: true,
    auto_init: true
  })
  assert.equal(calls[0].token, 'token')
  assert.equal(result.htmlUrl, 'https://github.com/seal-org/team-alpha-project')
})

test('revokeMembers paginates and continues when one removal fails', async () => {
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
  const calls = []

  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      if (payload.method === 'GET' && payload.path.endsWith('page=1')) {
        return { status: 200, data: [{ login: 'owner-user' }, ...Array.from({ length: 99 }, (_, index) => ({ login: `user-${index}` }))] }
      }
      if (payload.method === 'GET' && payload.path.endsWith('page=2')) {
        return { status: 200, data: [{ login: 'bad-user' }] }
      }
      if (payload.method === 'DELETE' && payload.path.endsWith('/bad-user')) {
        throw new Error('Removal failed')
      }
      return { status: 204, data: null }
    },
    logger: createLogger()
  })

  const result = await service.revokeMembers({
    eventId: EVENT_ID,
    confirmationText: 'REVOKE MEMBERS'
  }, { id: 'admin-1' })

  assert.equal(result.skipped[0], 'owner-user')
  assert.equal(result.removed.length, 99)
  assert.deepEqual(result.failed, [{ username: 'bad-user', reason: 'Removal failed' }])
  assert.equal(calls.some(call => call.method === 'GET' && call.path.endsWith('page=2')), true)
})
