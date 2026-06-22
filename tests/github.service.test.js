import assert from 'node:assert/strict'
import test from 'node:test'

import { env } from '../src/configs/environment.js'
import { createGithubService } from '../src/modules/github/github.service.js'

const createRepository = () => {
  const configs = new Map()
  const auditLogs = []
  const repositories = new Map()

  return {
    configs,
    auditLogs,
    repositories,
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

test('n8n dispatch token resolver prefers stored event token over env fallback', async () => {
  const repository = createRepository()
  const originalGithubToken = env.github.token
  env.github.token = 'env-fallback-token'

  await repository.upsertConfig({
    key: eventConfigKey,
    value: {
      eventId: EVENT_ID,
      organizationName: 'seal-org',
      ownerUsername: 'owner-user',
      enabled: true,
      tokenEncrypted: 'encrypted:stored-event-token'
    },
    isEncrypted: true
  })

  try {
    const service = createGithubService({
      repository,
      encryption: createEncryption(),
      githubClient: async () => ({ data: {}, status: 200 }),
      logger: createLogger()
    })

    assert.equal(await service.getTokenForN8nDispatch({ eventId: EVENT_ID }), 'stored-event-token')
    assert.equal(await service.getTokenForN8nDispatch({ eventId: SECOND_EVENT_ID }), 'env-fallback-token')
  } finally {
    env.github.token = originalGithubToken
  }
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

  const createRepoCall = calls.find(call => call.path === '/orgs/seal-org/repos')
  assert.equal(createRepoCall.method, 'POST')
  assert.equal(createRepoCall.path, '/orgs/seal-org/repos')
  assert.deepEqual(createRepoCall.body, {
    name: 'team-alpha-project',
    description: 'Repository for Team Alpha',
    private: true,
    auto_init: true
  })
  assert.equal(createRepoCall.token, 'token')
  assert.equal(result.htmlUrl, 'https://github.com/seal-org/team-alpha-project')
})

test('registerRepositoryWebhook stores repository webhook status when callback URL and secret are configured', async () => {
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
    githubOwner: 'seal-org',
    githubRepo: 'team-alpha',
    repoName: 'team-alpha',
    accessState: 'PENDING',
    webhookStatus: 'PENDING'
  })

  const originalPublicUrl = env.server.publicUrl
  const originalWebhookSecret = env.github.webhookSecret
  const originalWebhookCallbackUrl = env.github.webhookCallbackUrl
  env.server.publicUrl = 'https://seal.example.com'
  env.github.webhookSecret = 'webhook-secret'
  env.github.webhookCallbackUrl = undefined

  const calls = []
  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      return {
        status: 201,
        data: {
          id: 99,
          active: true
        }
      }
    },
    logger: createLogger()
  })

  try {
    const result = await service.registerRepositoryWebhook({
      eventId: EVENT_ID,
      repoName: 'team-alpha'
    }, { id: 'coordinator-1' })

    assert.equal(calls[0].path, '/repos/seal-org/team-alpha/hooks')
    assert.equal(calls[0].body.config.url, 'https://seal.example.com/api/github/webhooks')
    assert.equal(result.hookId, 99)
    assert.equal(repository.repositories.get(`${EVENT_ID}:seal-org:team-alpha`).webhookStatus, 'REGISTERED')
  } finally {
    env.server.publicUrl = originalPublicUrl
    env.github.webhookSecret = originalWebhookSecret
    env.github.webhookCallbackUrl = originalWebhookCallbackUrl
  }
})

test('revokeCollaborator removes collaborator and marks linked repository as revoked', async () => {
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
    githubOwner: 'seal-org',
    githubRepo: 'team-alpha',
    repoName: 'team-alpha',
    accessState: 'GRANTED'
  })

  const calls = []
  const service = createGithubService({
    repository,
    encryption: createEncryption(),
    githubClient: async (payload) => {
      calls.push(payload)
      return { status: 204, data: null }
    },
    logger: createLogger()
  })

  const result = await service.revokeCollaborator({
    eventId: EVENT_ID,
    repoName: 'team-alpha',
    username: 'dev-user'
  }, { id: 'admin-1' })

  assert.equal(calls[0].method, 'DELETE')
  assert.equal(calls[0].path, '/repos/seal-org/team-alpha/collaborators/dev-user')
  assert.equal(result.status, 'revoked')
  assert.equal(repository.repositories.get(`${EVENT_ID}:seal-org:team-alpha`).accessState, 'REVOKED')
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
