import IORedis from 'ioredis'
import { Queue } from 'bullmq'

import { env } from '#configs/environment.js'
import { JOB_TYPES, QUEUE_NAMES } from '#constants/queue.js'

let redisConnection
let githubPushQueue

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
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3
      }
    })
  }

  return githubPushQueue
}

export const QUEUE_SERVICE = {
  async enqueueGithubPushEvent(data) {
    return await getGithubPushQueue().add(JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT, data, {
      jobId: data.deliveryId
    })
  },

  async enqueueFetchCommitDiff(data) {
    const jobId = data.deliveryId
      ? `fetch-commit-diff:${data.deliveryId}`
      : `fetch-commit-diff:${data.repositoryId}:${data.afterCommitSha || data.headCommitSha || Date.now()}`

    return await getGithubPushQueue().add(JOB_TYPES.FETCH_COMMIT_DIFF, data, {
      jobId
    })
  },

  async enqueueHourlyRepositoryScan(data = {}) {
    const jobId = data.repositoryId
      ? `hourly-repository-scan:${data.repositoryId}`
      : 'hourly-repository-scan:all'

    return await getGithubPushQueue().add(JOB_TYPES.HOURLY_REPOSITORY_SCAN, data, {
      jobId
    })
  },

  async enqueueRunStaticAnalysis(data) {
    const jobId = `run-static-analysis:${data.repositoryId}:${data.commitSha}`

    return await getGithubPushQueue().add(JOB_TYPES.RUN_STATIC_ANALYSIS, data, {
      jobId
    })
  },

  async enqueueComputeImpactScore(data) {
    const jobId = `compute-impact-score:${data.repositoryId}:${data.commitSha}`

    return await getGithubPushQueue().add(JOB_TYPES.COMPUTE_IMPACT_SCORE, data, {
      jobId
    })
  }
}
