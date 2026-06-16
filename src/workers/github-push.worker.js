import IORedis from 'ioredis'
import { Worker } from 'bullmq'

import { AI_REVIEW_SERVICE } from '#modules/ai-reviews/ai-review.service.js'
import { env } from '#configs/environment.js'
import { JOB_TYPES, QUEUE_NAMES } from '#constants/queue.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'
import { LOGGER } from '#utils/logger.js'

const createConnection = () => new IORedis(env.redis.url, {
  maxRetriesPerRequest: null
})

export const processGithubPushEventJob = async (job) => {
  if (job.name !== JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT) {
    return null
  }

  LOGGER.info('Queued GitHub push event received by worker', {
    deliveryId: job.data?.deliveryId,
    repositoryId: job.data?.repositoryId,
    repositoryFullName: job.data?.repositoryFullName
  })

  await QUEUE_SERVICE.enqueueRunPerPushAudit({
    repositoryId: job.data?.repositoryId,
    commitSha: job.data?.afterCommitSha,
    branch: job.data?.branch,
    beforeCommitSha: job.data?.beforeCommitSha,
    deliveryEventId: job.data?.deliveryEventId,
    deliveryId: job.data?.deliveryId,
    source: 'github-webhook',
    requestedBy: null
  })

  return {
    acknowledged: true,
    deliveryId: job.data?.deliveryId,
    queuedJobType: JOB_TYPES.RUN_PER_PUSH_AUDIT
  }
}

export const processGithubIngestionJob = async (job, {
  aiReviewService = AI_REVIEW_SERVICE
} = {}) => {
  if (job.name === JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT) {
    return await processGithubPushEventJob(job)
  }

  if (job.name === JOB_TYPES.RUN_PER_PUSH_AUDIT) {
    return await aiReviewService.processPerPushAuditJob(job.data)
  }

  if (job.name === JOB_TYPES.RUN_TEAM_AGGREGATE_AUDIT) {
    return await aiReviewService.processTeamAggregateAuditJob(job.data)
  }

  return null
}

export const createGithubPushWorker = () => {
  return new Worker(
    QUEUE_NAMES.GITHUB_PUSH_EVENTS,
    processGithubIngestionJob,
    {
      connection: createConnection(),
      concurrency: env.worker.concurrency
    }
  )
}
