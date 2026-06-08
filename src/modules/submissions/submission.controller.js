import { StatusCodes } from 'http-status-codes'

import { SUBMISSION_SERVICE } from './submission.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listSubmissions = async (req, res, next) => {
  try {
    const { submissions, pagination } = await SUBMISSION_SERVICE.listSubmissions(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get submissions successfully',
      data: submissions,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const createSubmission = async (req, res, next) => {
  try {
    const submission = await SUBMISSION_SERVICE.createSubmission(req.body)
    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create submission successfully',
      data: submission
    }))
  } catch (error) {
    next(error)
  }
}

const getSubmissionById = async (req, res, next) => {
  try {
    const submission = await SUBMISSION_SERVICE.getSubmissionById(req.params.id)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get submission successfully',
      data: submission
    }))
  } catch (error) {
    next(error)
  }
}

const updateSubmission = async (req, res, next) => {
  try {
    const submission = await SUBMISSION_SERVICE.updateSubmission(req.params.id, req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update submission successfully',
      data: submission
    }))
  } catch (error) {
    next(error)
  }
}

const submitSubmission = async (req, res, next) => {
  try {
    const submission = await SUBMISSION_SERVICE.submitSubmission(req.params.id)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Submit submission successfully',
      data: submission
    }))
  } catch (error) {
    next(error)
  }
}

const updateSubmissionStatus = async (req, res, next) => {
  try {
    const submission = await SUBMISSION_SERVICE.updateSubmissionStatus(req.params.id, req.body.status)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update submission status successfully',
      data: submission
    }))
  } catch (error) {
    next(error)
  }
}

export const SUBMISSION_CONTROLLER = {
  listSubmissions,
  createSubmission,
  getSubmissionById,
  updateSubmission,
  submitSubmission,
  updateSubmissionStatus
}
