import IORedis from 'ioredis'
import { Queue } from 'bullmq'

import { env } from '#configs/environment.js'
import { JOB_TYPES, QUEUE_NAMES } from '#constants/queue.js'

let redisConnection
let githubPushQueue

const sanitizeJobIdSegment = (value) => {
  return String(value ?? 'none')
    .trim()
    .replace(/[:\s/\\]+/g, '_')
}

export const buildQueueJobId = (...segments) => {
  return segments.map(sanitizeJobIdSegment).join('__')
}

const getRedisConnection = () => {
  if (!redisConnection) {
    redisConnection = new IORedis(env.redis.url, {
      maxRetriesPerRequest: null
    })
  }

  return redisConnection
}

const getGithubPushQueue = () => {
  if (!githubPushQueue) {
    githubPushQueue = new Queue(QUEUE_NAMES.GITHUB_PUSH_EVENTS, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    })
  }

  return githubPushQueue
}

export const QUEUE_SERVICE = {
  async ping() {
    return await getRedisConnection().ping()
  },

  async getQueueSummary() {
    const queue = getGithubPushQueue()
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')

    return {
      queueName: QUEUE_NAMES.GITHUB_PUSH_EVENTS,
      redisStatus: 'ready',
      counts
    }
  },

  async enqueueGithubPushCompetition(data) {
    return await getGithubPushQueue().add(JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT, data, {
      jobId: data.deliveryId
    })
  },

  async enqueueRunPerPushAudit(data) {
    const jobId = data.aiReviewId
      ? buildQueueJobId('run-per-push-audit-review', data.aiReviewId, data.retryCount || 0, data.manualRedispatch ? 'manual' : 'auto')
      : buildQueueJobId('run-per-push-audit', data.repositoryId, data.commitSha)

    return await getGithubPushQueue().add(JOB_TYPES.RUN_PER_PUSH_AUDIT, data, {
      jobId
    })
  },

  async enqueueRunTeamAggregateAudit(data) {
    const jobId = data.aiReviewId
      ? buildQueueJobId('run-team-aggregate-audit-review', data.aiReviewId, data.retryCount || 0, data.manualRedispatch ? 'manual' : 'auto')
      : buildQueueJobId('run-team-aggregate-audit', data.repositoryId, data.batchId || 'latest')

    return await getGithubPushQueue().add(JOB_TYPES.RUN_TEAM_AGGREGATE_AUDIT, data, {
      jobId
    })
  },

  async close() {
    if (githubPushQueue) {
      await githubPushQueue.close()
      githubPushQueue = null
    }

    if (redisConnection) {
      await redisConnection.quit()
      redisConnection = null
    }
  }
}
