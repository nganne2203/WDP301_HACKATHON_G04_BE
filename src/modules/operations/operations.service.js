import AiReview from '#models/aiReview.model.js'
import CommitDiff from '#models/commitDiff.model.js'
import GitHubWebhookEvent from '#models/githubWebhookEvent.model.js'
import Participant from '#models/participant.model.js'
import Repository from '#models/repository.model.js'
import Submission from '#models/submission.model.js'
import Team from '#models/team.model.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'
import { env } from '#configs/environment.js'

const buildCompetitionRoundFilter = ({ competitionId, roundId }) => {
  const filter = {}
  if (competitionId) filter.competitionId = competitionId
  if (roundId) filter.roundId = roundId
  return filter
}

const buildIntegrationChecks = (queueSummary = {}, config = env) => {
  const counts = queueSummary.counts || {}
  const queueLag = Number(counts.waiting || 0) + Number(counts.delayed || 0)
  const failedJobs = Number(counts.failed || 0)

  return {
    redisStatus: queueSummary.redisStatus || 'unknown',
    queueLag,
    failedJobs,
    workerRequired: Boolean(config.n8n?.enabled || config.github?.webhookSecret),
    githubWebhookSecretConfigured: Boolean(config.github?.webhookSecret),
    githubWebhookCallbackConfigured: Boolean(config.github?.webhookCallbackUrl || config.server?.publicUrl),
    n8nEnabled: Boolean(config.n8n?.enabled),
    n8nCallbackSecretConfigured: Boolean(config.n8n?.callbackSecret),
    n8nPerPushWebhookConfigured: Boolean(config.n8n?.perPushWebhookUrl),
    n8nAggregateWebhookConfigured: Boolean(config.n8n?.aggregateWebhookUrl || config.n8n?.teamAggregateWebhookUrl),
    workerConcurrency: Number(config.worker?.concurrency || 0)
  }
}

export const createOperationsService = ({
  participantModel = Participant,
  teamModel = Team,
  submissionModel = Submission,
  repositoryModel = Repository,
  aiReviewModel = AiReview,
  commitDiffModel = CommitDiff,
  githubWebhookEventModel = GitHubWebhookEvent,
  queueService = QUEUE_SERVICE,
  config = env
} = {}) => {
  const getDashboardMetrics = async ({ competitionId, roundId } = {}) => {
    const baseFilter = buildCompetitionRoundFilter({ competitionId, roundId })
    const repositoryFilter = competitionId ? { competitionId, ...(roundId ? { roundId } : {}) } : {}
    const aiReviewFilter = {
      ...(competitionId ? { competitionId } : {}),
      ...(roundId ? { roundId } : {})
    }

    let queueSummary
    try {
      queueSummary = await queueService.getQueueSummary()
    } catch (error) {
      queueSummary = {
        queueName: 'github-push-competitions',
        redisStatus: 'not_ready',
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0
        },
        error: error.message
      }
    }

    const [participants, teams, submissions, repositories, pendingAiReviews, failedAiReviews, retryPendingAiReviews, manualRedispatchRequiredAiReviews] = await Promise.all([
      participantModel.countDocuments(competitionId ? { competitionId } : {}),
      teamModel.countDocuments(competitionId ? { competitionId } : {}),
      submissionModel.countDocuments(baseFilter),
      repositoryModel.countDocuments(repositoryFilter),
      aiReviewModel.countDocuments({
        ...aiReviewFilter,
        status: 'PENDING'
      }),
      aiReviewModel.countDocuments({
        ...aiReviewFilter,
        status: 'FAILED'
      }),
      aiReviewModel.countDocuments({
        ...aiReviewFilter,
        status: 'RETRY_PENDING'
      }),
      aiReviewModel.countDocuments({
        ...aiReviewFilter,
        status: 'MANUAL_REDISPATCH_REQUIRED'
      })
    ])

    const integrationChecks = buildIntegrationChecks(queueSummary, config)

    return {
      scope: {
        competitionId: competitionId || null,
        roundId: roundId || null
      },
      metrics: {
        participants,
        teams,
        submissions,
        repositories,
        pendingAiReviews,
        failedAiReviews,
        retryPendingAiReviews,
        manualRedispatchRequiredAiReviews,
        failedJobs: Number(queueSummary.counts?.failed || 0)
      },
      queue: queueSummary,
      integrationChecks
    }
  }

  const getPipelineSummary = async ({ competitionId, roundId } = {}) => {
    const repositoryFilter = competitionId ? { competitionId, ...(roundId ? { roundId } : {}) } : {}
    const repositoryIds = await repositoryModel.find(repositoryFilter).select('_id')
    const repositoryIdValues = repositoryIds.map(item => item._id)
    const scopedCommitDiffFilter = repositoryIdValues.length > 0 ? { repositoryId: { $in: repositoryIdValues } } : {}

    let queueSummary
    try {
      queueSummary = await queueService.getQueueSummary()
    } catch (error) {
      queueSummary = {
        queueName: 'github-push-competitions',
        redisStatus: 'not_ready',
        counts: {},
        error: error.message
      }
    }

    const [webhookStatusBreakdown, commitDiffStatusBreakdown, aiReviewStatusBreakdown] = await Promise.all([
      githubWebhookEventModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
        { $sort: { count: -1, status: 1 } }
      ]),
      commitDiffModel.aggregate([
        { $match: scopedCommitDiffFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
        { $sort: { count: -1, status: 1 } }
      ]),
      aiReviewModel.aggregate([
        { $match: buildCompetitionRoundFilter({ competitionId, roundId }) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
        { $sort: { count: -1, status: 1 } }
      ])
    ])

    const integrationChecks = buildIntegrationChecks(queueSummary, config)

    return {
      scope: {
        competitionId: competitionId || null,
        roundId: roundId || null
      },
      queue: queueSummary,
      integrationChecks,
      webhookStatusBreakdown,
      commitDiffStatusBreakdown,
      aiReviewStatusBreakdown
    }
  }

  return {
    getDashboardMetrics,
    getPipelineSummary
  }
}

export const OPERATIONS_SERVICE = createOperationsService()
