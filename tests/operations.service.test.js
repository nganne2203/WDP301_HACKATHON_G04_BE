import assert from 'node:assert/strict'
import test from 'node:test'

import { createOperationsService } from '../src/modules/operations/operations.service.js'

const countModel = (value) => ({
  async countDocuments() {
    return value
  }
})

test('operations service returns dashboard metrics and degraded queue summary when redis is unavailable', async () => {
  const service = createOperationsService({
    participantModel: countModel(12),
    teamModel: countModel(4),
    submissionModel: countModel(3),
    repositoryModel: {
      async countDocuments() {
        return 2
      },
      find() {
        return {
          async select() {
            return [{ _id: 'repo-1' }]
          }
        }
      }
    },
    aiReviewModel: {
      async countDocuments(filter = {}) {
        if (filter.status === 'PENDING') return 5
        if (filter.status === 'FAILED') return 1
        if (filter.status === 'RETRY_PENDING') return 2
        if (filter.status === 'MANUAL_REDISPATCH_REQUIRED') return 3
        return 0
      },
      async aggregate() {
        return [{ status: 'PENDING', count: 5 }]
      }
    },
    commitDiffModel: {
      async aggregate() {
        return [{ status: 'READY', count: 7 }]
      }
    },
    githubWebhookEventModel: {
      async aggregate() {
        return [{ status: 'PROCESSED', count: 9 }]
      }
    },
    queueService: {
      async getQueueSummary() {
        throw new Error('redis offline')
      }
    },
    config: {
      server: { publicUrl: 'https://api.test' },
      github: { webhookSecret: 'secret' },
      n8n: {
        enabled: true,
        callbackSecret: 'callback',
        perPushWebhookUrl: 'https://n8n.test/per-push',
        aggregateWebhookUrl: 'https://n8n.test/aggregate'
      },
      worker: { concurrency: 2 }
    }
  })

  const dashboard = await service.getDashboardMetrics({})
  assert.equal(dashboard.metrics.participants, 12)
  assert.equal(dashboard.metrics.failedAiReviews, 1)
  assert.equal(dashboard.metrics.retryPendingAiReviews, 2)
  assert.equal(dashboard.metrics.manualRedispatchRequiredAiReviews, 3)
  assert.equal(dashboard.metrics.failedJobs, 0)
  assert.equal(dashboard.queue.redisStatus, 'not_ready')
  assert.equal(dashboard.integrationChecks.redisStatus, 'not_ready')
  assert.equal(dashboard.integrationChecks.workerRequired, true)
  assert.equal(dashboard.integrationChecks.githubWebhookSecretConfigured, true)
  assert.equal(dashboard.integrationChecks.n8nEnabled, true)

  const pipeline = await service.getPipelineSummary({})
  assert.equal(pipeline.queue.redisStatus, 'not_ready')
  assert.equal(pipeline.integrationChecks.n8nCallbackSecretConfigured, true)
  assert.equal(pipeline.commitDiffStatusBreakdown[0].status, 'READY')
})
