import { StatusCodes } from 'http-status-codes'

import { AI_REVIEW_SERVICE } from './ai-review.service.js'
import { responseSuccess } from '#utils/responseUtil.js'
import { env } from '#configs/environment.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'

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

const handleCallback = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization || ''
    const callbackSecret = authorizationHeader.replace(/^Bearer /i, '').trim()

    if (!callbackSecret || callbackSecret !== env.n8n.callbackSecret) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Unauthorized callback: invalid token'])
    }

    const aiReviewId = req.params.id
    const { status, rawResponse, modelName, provider, tokenUsage, errorMessage, commits } = req.body

    const result = await AI_REVIEW_SERVICE.handleAuditCallback({
      aiReviewId,
      status,
      rawResponse,
      modelName,
      provider,
      tokenUsage,
      errorMessage,
      commits
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'AI review callback processed successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const redispatchAiReview = async (req, res, next) => {
  try {
    const result = await AI_REVIEW_SERVICE.requestAiReviewRedispatch({
      aiReviewId: req.params.id,
      requestedBy: req.user?.id
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'AI review redispatch queued successfully',
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
  getTeamAiAuditSummary,
  handleCallback,
  redispatchAiReview
}
