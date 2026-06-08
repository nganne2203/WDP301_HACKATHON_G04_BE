import IORedis from 'ioredis'
import { Worker } from 'bullmq'

import { AI_REVIEW_SERVICE } from '#modules/ai-reviews/ai-review.service.js'
import { REPOSITORY_ANALYSIS_SERVICE } from '#modules/repositories/repository-analysis.service.js'
import { REPOSITORY_EVIDENCE_SERVICE } from '#modules/repositories/repository-evidence.service.js'
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

  await QUEUE_SERVICE.enqueueFetchCommitDiff({
    repositoryId: job.data?.repositoryId,
    beforeCommitSha: job.data?.beforeCommitSha,
    afterCommitSha: job.data?.afterCommitSha,
    branch: job.data?.branch,
    deliveryEventId: job.data?.deliveryEventId,
    deliveryId: job.data?.deliveryId
  })

  return {
    acknowledged: true,
    deliveryId: job.data?.deliveryId,
    queuedJobType: JOB_TYPES.FETCH_COMMIT_DIFF
  }
}

export const processGithubIngestionJob = async (job, {
  repositoryEvidenceService = REPOSITORY_EVIDENCE_SERVICE,
  repositoryAnalysisService = REPOSITORY_ANALYSIS_SERVICE,
  aiReviewService = AI_REVIEW_SERVICE
} = {}) => {
  if (job.name === JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT) {
    return await processGithubPushEventJob(job)
  }

  if (job.name === JOB_TYPES.FETCH_COMMIT_DIFF) {
    return await repositoryEvidenceService.processFetchCommitDiffJob(job.data)
  }

  if (job.name === JOB_TYPES.HOURLY_REPOSITORY_SCAN) {
    return await repositoryEvidenceService.processHourlyRepositoryScanJob(job.data)
  }

  if (job.name === JOB_TYPES.RUN_STATIC_ANALYSIS) {
    return await repositoryAnalysisService.processRunStaticAnalysisJob(job.data)
  }

  if (job.name === JOB_TYPES.COMPUTE_IMPACT_SCORE) {
    return await repositoryAnalysisService.processComputeImpactScoreJob(job.data)
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
