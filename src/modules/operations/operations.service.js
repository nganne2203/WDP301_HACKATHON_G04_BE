import AiReview from '#models/aiReview.model.js'
import CommitDiff from '#models/commitDiff.model.js'
import GitHubWebhookEvent from '#models/githubWebhookEvent.model.js'
import Participant from '#models/participant.model.js'
import Repository from '#models/repository.model.js'
import Submission from '#models/submission.model.js'
import Team from '#models/team.model.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'

const buildEventRoundFilter = ({ eventId, roundId }) => {
  const filter = {}
  if (eventId) filter.eventId = eventId
  if (roundId) filter.roundId = roundId
  return filter
}

export const createOperationsService = ({
  participantModel = Participant,
  teamModel = Team,
  submissionModel = Submission,
  repositoryModel = Repository,
  aiReviewModel = AiReview,
  commitDiffModel = CommitDiff,
  githubWebhookEventModel = GitHubWebhookEvent,
  queueService = QUEUE_SERVICE
} = {}) => {
  const getDashboardMetrics = async ({ eventId, roundId } = {}) => {
    const baseFilter = buildEventRoundFilter({ eventId, roundId })
    const repositoryFilter = eventId ? { eventId, ...(roundId ? { roundId } : {}) } : {}
    const aiReviewFilter = {
      ...(eventId ? { eventId } : {}),
      ...(roundId ? { roundId } : {})
    }

    let queueSummary
    try {
      queueSummary = await queueService.getQueueSummary()
    } catch (error) {
      queueSummary = {
        queueName: 'github-push-events',
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

    const [participants, teams, submissions, repositories, pendingAiReviews, fallbackAiReviews] = await Promise.all([
      participantModel.countDocuments(eventId ? { eventId } : {}),
      teamModel.countDocuments(eventId ? { eventId } : {}),
      submissionModel.countDocuments(baseFilter),
      repositoryModel.countDocuments(repositoryFilter),
      aiReviewModel.countDocuments({
        ...aiReviewFilter,
        status: 'PENDING'
      }),
      aiReviewModel.countDocuments({
        ...aiReviewFilter,
        status: 'FALLBACK'
      })
    ])

    return {
      scope: {
        eventId: eventId || null,
        roundId: roundId || null
      },
      metrics: {
        participants,
        teams,
        submissions,
        repositories,
        pendingAiReviews,
        fallbackAiReviews,
        failedJobs: Number(queueSummary.counts?.failed || 0)
      },
      queue: queueSummary
    }
  }

  const getPipelineSummary = async ({ eventId, roundId } = {}) => {
    const repositoryFilter = eventId ? { eventId, ...(roundId ? { roundId } : {}) } : {}
    const repositoryIds = await repositoryModel.find(repositoryFilter).select('_id')
    const repositoryIdValues = repositoryIds.map(item => item._id)
    const scopedCommitDiffFilter = repositoryIdValues.length > 0 ? { repositoryId: { $in: repositoryIdValues } } : {}

    let queueSummary
    try {
      queueSummary = await queueService.getQueueSummary()
    } catch (error) {
      queueSummary = {
        queueName: 'github-push-events',
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
        { $match: buildEventRoundFilter({ eventId, roundId }) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
        { $sort: { count: -1, status: 1 } }
      ])
    ])

    return {
      scope: {
        eventId: eventId || null,
        roundId: roundId || null
      },
      queue: queueSummary,
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
