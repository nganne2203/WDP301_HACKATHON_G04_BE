import { StatusCodes } from 'http-status-codes'

import { WORKSHOP_SERVICE } from './workshop.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listWorkshops = async (req, res, next) => {
  try {
    const { workshops, pagination } = await WORKSHOP_SERVICE.listWorkshops(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get workshops successfully',
      data: workshops,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getWorkshopById = async (req, res, next) => {
  try {
    const workshop = await WORKSHOP_SERVICE.getWorkshopById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get workshop successfully',
      data: workshop
    }))
  } catch (error) {
    next(error)
  }
}

const createWorkshop = async (req, res, next) => {
  try {
    const workshop = await WORKSHOP_SERVICE.createWorkshop(req.body)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create workshop successfully',
      data: workshop
    }))
  } catch (error) {
    next(error)
  }
}

const updateWorkshop = async (req, res, next) => {
  try {
    const workshop = await WORKSHOP_SERVICE.updateWorkshop(req.params.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update workshop successfully',
      data: workshop
    }))
  } catch (error) {
    next(error)
  }
}

const deleteWorkshop = async (req, res, next) => {
  try {
    await WORKSHOP_SERVICE.deleteWorkshop(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete workshop successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

const createGoogleMeet = async (req, res, next) => {
  try {
    const googleMeet = await WORKSHOP_SERVICE.createGoogleMeet(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Google Meet link created successfully',
      data: googleMeet
    }))
  } catch (error) {
    next(error)
  }
}

const createQuestion = async (req, res, next) => {
  try {
    const question = await WORKSHOP_SERVICE.createQuestion(req.params.id, req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create workshop question successfully',
      data: question
    }))
  } catch (error) {
    next(error)
  }
}

const listQuestions = async (req, res, next) => {
  try {
    const { questions, pagination } = await WORKSHOP_SERVICE.listQuestions(req.params.id, req.validated?.query || req.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get workshop questions successfully',
      data: questions,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const voteQuestion = async (req, res, next) => {
  try {
    const question = await WORKSHOP_SERVICE.voteQuestion(req.params.questionId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Vote workshop question successfully',
      data: question
    }))
  } catch (error) {
    next(error)
  }
}

const createRating = async (req, res, next) => {
  try {
    const rating = await WORKSHOP_SERVICE.createRating(req.params.id, req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create workshop rating successfully',
      data: rating
    }))
  } catch (error) {
    next(error)
  }
}

const listRatings = async (req, res, next) => {
  try {
    const { ratings, stats, pagination } = await WORKSHOP_SERVICE.listRatings(req.params.id, req.validated?.query || req.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get workshop ratings successfully',
      data: { ratings, stats },
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getRatingStats = async (req, res, next) => {
  try {
    const { stats } = await WORKSHOP_SERVICE.listRatings(req.params.id, { page: 1, limit: 1 }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get workshop rating statistics successfully',
      data: stats
    }))
  } catch (error) {
    next(error)
  }
}

const createFeedback = async (req, res, next) => {
  try {
    const feedback = await WORKSHOP_SERVICE.createFeedback(req.params.id, req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create workshop feedback successfully',
      data: feedback
    }))
  } catch (error) {
    next(error)
  }
}

const listFeedback = async (req, res, next) => {
  try {
    const { feedback, pagination } = await WORKSHOP_SERVICE.listFeedback(req.params.id, req.validated?.query || req.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get workshop feedback successfully',
      data: feedback,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

export const WORKSHOP_CONTROLLER = {
  listWorkshops,
  getWorkshopById,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  createGoogleMeet,
  createQuestion,
  listQuestions,
  voteQuestion,
  createRating,
  listRatings,
  getRatingStats,
  createFeedback,
  listFeedback
}
