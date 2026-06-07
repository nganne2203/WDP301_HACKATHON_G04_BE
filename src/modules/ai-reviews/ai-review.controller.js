import { StatusCodes } from 'http-status-codes'

import { AI_REVIEW_SERVICE } from './ai-review.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listRepositoryAiReviews = async (req, res, next) => {
  try {
    const { repository, aiReviews, pagination } = await AI_REVIEW_SERVICE.listRepositoryAiReviews({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository AI reviews successfully',
      data: {
        repository,
        aiReviews
      },
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getAiReviewById = async (req, res, next) => {
  try {
    const aiReview = await AI_REVIEW_SERVICE.getAiReviewById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get AI review successfully',
      data: aiReview
    }))
  } catch (error) {
    next(error)
  }
}

const createPerPushAudit = async (req, res, next) => {
  try {
    const result = await AI_REVIEW_SERVICE.requestPerPushAudit({
      repositoryId: req.params.id,
      commitSha: req.body?.commitSha || null,
      requestedBy: req.user?.id
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Create per-push AI audit successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const createTeamAggregateAudit = async (req, res, next) => {
  try {
    const result = await AI_REVIEW_SERVICE.requestTeamAggregateAudit({
      repositoryId: req.params.id,
      batchId: req.body?.batchId || null,
      requestedBy: req.user?.id
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Create team aggregate AI audit successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const getTeamAiAuditSummary = async (req, res, next) => {
  try {
    const result = await AI_REVIEW_SERVICE.getTeamAiAuditSummary({
      teamId: req.params.teamId,
      limit: req.validated?.query?.limit || req.query.limit,
      reviewKind: req.validated?.query?.reviewKind || req.query.reviewKind
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get team AI audit summary successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const AI_REVIEW_CONTROLLER = {
  listRepositoryAiReviews,
  getAiReviewById,
  createPerPushAudit,
  createTeamAggregateAudit,
  getTeamAiAuditSummary
}
