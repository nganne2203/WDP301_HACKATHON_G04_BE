import IORedis from 'ioredis'
import { Worker } from 'bullmq'

import { env } from '#configs/environment.js'
import { JOB_TYPES, QUEUE_NAMES } from '#constants/queue.js'
import { LOGGER } from '#utils/logger.js'

const createConnection = () => new IORedis(env.redis.url, {
  maxRetriesPerRequest: null
})

export const processGithubPushEventJob = async (job) => {
  if (job.name !== JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT) {
    return null
  }

  // Phase 5 baseline only: later phases will fetch commits, diffs, and evidence asynchronously.
  LOGGER.info('Queued GitHub push event received by worker baseline', {
    deliveryId: job.data?.deliveryId,
    repositoryId: job.data?.repositoryId,
    repositoryFullName: job.data?.repositoryFullName
  })

  return {
    acknowledged: true,
    deliveryId: job.data?.deliveryId
  }
}

export const createGithubPushWorker = () => {
  return new Worker(
    QUEUE_NAMES.GITHUB_PUSH_EVENTS,
    processGithubPushEventJob,
    { connection: createConnection() }
  )
}
