import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'

import ApiError from '../src/utils/ApiError.js'
import { createGithubWebhookController } from '../src/modules/github-webhooks/github-webhook.controller.js'
import { createGithubWebhookRouter } from '../src/modules/github-webhooks/github-webhook.route.js'
import { createGithubWebhookService } from '../src/modules/github-webhooks/github-webhook.service.js'
import { errorHandlingMiddleware } from '../src/middlewares/errorHandlingMiddleware.js'

const createWebhookRepository = () => {
  const deliveries = new Map()
  const repositories = new Map()

  return {
    deliveries,
    repositories,
    repository: {
      findDeliveryById: async (deliveryId) => deliveries.get(deliveryId) || null,
      createDelivery: async (data) => {
        if (deliveries.has(data.deliveryId)) {
          const duplicateError = new Error('Duplicate key')
          duplicateError.code = 11000
          throw duplicateError
        }
        const created = { _id: String(deliveries.size + 1).padStart(24, '0'), ...data }
        deliveries.set(data.deliveryId, created)
        return created
      },
      updateDeliveryById: async (id, data) => {
        const existing = [...deliveries.values()].find(item => item._id === id)
        const updated = { ...existing, ...data }
        deliveries.set(updated.deliveryId, updated)
        return updated
      },
      findRepositoryByFullName: async (repositoryFullName) => repositories.get(repositoryFullName) || null,
      updateRepositoryById: async (id, data) => {
        const existing = [...repositories.values()].find(item => item._id === id)
        const updated = { ...existing, ...data }
        repositories.set(updated.repositoryFullName, updated)
        return updated
      }
    }
  }
}

const createPushPayload = () => ({
  ref: 'refs/heads/main',
  before: 'abc123',
  after: 'def456',
  repository: {
    id: 12345,
    full_name: 'seal-org/team-alpha'
  }
})

const startServer = async (app) => {
  return await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`
      })
    })
  })
}

test('handleWebhook accepts a valid push signature, persists delivery, and enqueues a job', async () => {
  const { repository, deliveries, repositories } = createWebhookRepository()
  repositories.set('seal-org/team-alpha', {
    _id: '000000000000000000000111',
    competitionId: '000000000000000000000222',
    teamId: '000000000000000000000333',
    roundId: '000000000000000000000444',
    repositoryFullName: 'seal-org/team-alpha'
  })

  const jobs = []
  const service = createGithubWebhookService({
    repository,
    queueService: {
      enqueueGithubPushCompetition: async (data) => {
        jobs.push(data)
        return { id: data.deliveryId }
      }
    },
    webhookSecret: 'phase-5-secret'
  })

  const rawBody = Buffer.from(JSON.stringify(createPushPayload()))
  const signature = service.buildSignature({
    secret: 'phase-5-secret',
    rawBody
  })

  const result = await service.handleWebhook({
    rawBody,
    deliveryId: 'delivery-1',
    eventType: 'push',
    signature
  })

  assert.equal(result.status, 'QUEUED')
  assert.equal(jobs.length, 1)
  assert.equal(deliveries.get('delivery-1').status, 'QUEUED')
  assert.equal(deliveries.get('delivery-1').signatureValid, true)
})

test('handleWebhook links legacy repository records when repositoryFullName is absent but owner and repo fields exist', async () => {
  const jobs = []
  const service = createGithubWebhookService({
    repository: {
      findDeliveryById: async () => null,
      createDelivery: async (data) => ({ _id: '000000000000000000000999', ...data }),
      updateDeliveryById: async (_id, data) => data,
      findRepositoryByFullName: async (repositoryFullName) => {
        if (repositoryFullName !== 'seal-org/team-alpha') return null
        return {
          _id: '000000000000000000000111',
          competitionId: '000000000000000000000222',
          teamId: '000000000000000000000333',
          roundId: '000000000000000000000444',
          githubOwner: 'seal-org',
          githubRepo: 'team-alpha'
        }
      },
      updateRepositoryById: async () => null
    },
    queueService: {
      enqueueGithubPushCompetition: async (data) => {
        jobs.push(data)
        return { id: data.deliveryId }
      }
    },
    webhookSecret: 'phase-5-secret'
  })

  const rawBody = Buffer.from(JSON.stringify(createPushPayload()))
  const signature = service.buildSignature({
    secret: 'phase-5-secret',
    rawBody
  })

  await service.handleWebhook({
    rawBody,
    deliveryId: 'delivery-legacy-link',
    eventType: 'push',
    signature
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].repositoryId, '000000000000000000000111')
  assert.equal(jobs[0].teamId, '000000000000000000000333')
})

test('handleWebhook rejects an invalid signature and persists a rejected delivery', async () => {
  const { repository, deliveries } = createWebhookRepository()
  const service = createGithubWebhookService({
    repository,
    queueService: {
      enqueueGithubPushCompetition: async () => null
    },
    webhookSecret: 'phase-5-secret'
  })

  const rawBody = Buffer.from(JSON.stringify(createPushPayload()))

  await assert.rejects(
    service.handleWebhook({
      rawBody,
      deliveryId: 'delivery-invalid',
      eventType: 'push',
      signature: 'sha256=invalid'
    }),
    (error) => error instanceof ApiError &&
      error.code === 'FORBIDDEN' &&
      error.errors.includes('Invalid GitHub webhook signature')
  )

  assert.equal(deliveries.get('delivery-invalid').status, 'REJECTED')
  assert.equal(deliveries.get('delivery-invalid').signatureValid, false)
})

test('handleWebhook is idempotent for duplicate deliveryId', async () => {
  const { repository } = createWebhookRepository()
  let enqueueCount = 0
  const service = createGithubWebhookService({
    repository,
    queueService: {
      enqueueGithubPushCompetition: async () => {
        enqueueCount += 1
        return { id: 'delivery-dup' }
      }
    },
    webhookSecret: 'phase-5-secret'
  })

  const rawBody = Buffer.from(JSON.stringify(createPushPayload()))
  const signature = service.buildSignature({
    secret: 'phase-5-secret',
    rawBody
  })

  const first = await service.handleWebhook({
    rawBody,
    deliveryId: 'delivery-dup',
    eventType: 'push',
    signature
  })
  const second = await service.handleWebhook({
    rawBody,
    deliveryId: 'delivery-dup',
    eventType: 'push',
    signature
  })

  assert.equal(first.duplicate, false)
  assert.equal(second.duplicate, true)
  assert.equal(enqueueCount, 1)
})

test('handleWebhook safely ignores non-push competitions', async () => {
  const { repository, deliveries } = createWebhookRepository()
  let enqueueCount = 0
  const service = createGithubWebhookService({
    repository,
    queueService: {
      enqueueGithubPushCompetition: async () => {
        enqueueCount += 1
      }
    },
    webhookSecret: 'phase-5-secret'
  })

  const rawBody = Buffer.from(JSON.stringify({
    action: 'created',
    repository: { full_name: 'seal-org/team-alpha', id: 12345 }
  }))
  const signature = service.buildSignature({
    secret: 'phase-5-secret',
    rawBody
  })

  const result = await service.handleWebhook({
    rawBody,
    deliveryId: 'delivery-non-push',
    eventType: 'issues',
    signature
  })

  assert.equal(result.status, 'IGNORED')
  assert.equal(enqueueCount, 0)
  assert.equal(deliveries.get('delivery-non-push').status, 'IGNORED')
})

test('github webhook endpoint accepts a valid raw-body signature and returns 200 quickly', async () => {
  const { repository } = createWebhookRepository()
  const jobs = []
  const service = createGithubWebhookService({
    repository,
    queueService: {
      enqueueGithubPushCompetition: async (data) => {
        jobs.push(data)
        return { id: data.deliveryId }
      }
    },
    webhookSecret: 'phase-5-secret'
  })

  const controller = createGithubWebhookController({ service })
  const app = express()
  app.use('/api/github/webhooks', express.raw({ type: 'application/json', limit: '2mb' }))
  app.use('/api/github/webhooks', createGithubWebhookRouter({ controller }))
  app.use(errorHandlingMiddleware)

  const { server, url } = await startServer(app)
  const rawBody = JSON.stringify(createPushPayload())
  const signature = service.buildSignature({
    secret: 'phase-5-secret',
    rawBody: Buffer.from(rawBody)
  })

  try {
    const startedAt = Date.now()
    const response = await fetch(`${url}/api/github/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Delivery': 'delivery-route-1',
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': signature
      },
      body: rawBody
    })
    const durationMs = Date.now() - startedAt
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(jobs.length, 1)
    assert.ok(durationMs < 500)
  } finally {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  }
})
