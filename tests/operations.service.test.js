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
        return filter.status === 'PENDING' ? 5 : 1
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
    }
  })

  const dashboard = await service.getDashboardMetrics({})
  assert.equal(dashboard.metrics.participants, 12)
  assert.equal(dashboard.metrics.failedJobs, 0)
  assert.equal(dashboard.queue.redisStatus, 'not_ready')

  const pipeline = await service.getPipelineSummary({})
  assert.equal(pipeline.queue.redisStatus, 'not_ready')
  assert.equal(pipeline.commitDiffStatusBreakdown[0].status, 'READY')
})
