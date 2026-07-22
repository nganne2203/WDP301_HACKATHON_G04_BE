import { StatusCodes } from 'http-status-codes'

import { COMPETITION_SERVICE } from './competition.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listCompetitions = async (req, res, next) => {
  try {
    const { competitions, pagination } = await COMPETITION_SERVICE.listCompetitions(req.validated?.query || req.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get competitions successfully',
      data: competitions,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getCompetitionById = async (req, res, next) => {
  try {
    const competition = await COMPETITION_SERVICE.getCompetitionById(req.params.id, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get competition successfully',
      data: competition
    }))
  } catch (error) {
    next(error)
  }
}

const createCompetition = async (req, res, next) => {
  try {
    const competition = await COMPETITION_SERVICE.createCompetition(req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create competition successfully',
      data: competition
    }))
  } catch (error) {
    next(error)
  }
}

const updateCompetition = async (req, res, next) => {
  try {
    const competition = await COMPETITION_SERVICE.updateCompetition(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update competition successfully',
      data: competition
    }))
  } catch (error) {
    next(error)
  }
}

const updateCompetitionStatus = async (req, res, next) => {
  try {
    const competition = await COMPETITION_SERVICE.updateCompetitionStatus(req.params.id, req.body.status, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update competition status successfully',
      data: competition
    }))
  } catch (error) {
    next(error)
  }
}

const transitionCompetitionStatus = (status, message) => async (req, res, next) => {
  try {
    const competition = await COMPETITION_SERVICE.updateCompetitionStatus(req.params.id, status, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message,
      data: competition
    }))
  } catch (error) {
    next(error)
  }
}

const deleteCompetition = async (req, res, next) => {
  try {
    await COMPETITION_SERVICE.deleteCompetition(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete competition successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

const sendInvitations = async (req, res, next) => {
  try {
    const result = await COMPETITION_SERVICE.sendInvitations(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Send competition invitations successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const COMPETITION_CONTROLLER = {
  listCompetitions,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  updateCompetitionStatus,
  openRegistration: transitionCompetitionStatus('OPEN_REGISTRATION', 'Open competition registration successfully'),
  closeRegistration: transitionCompetitionStatus('REGISTRATION_CLOSED', 'Close competition registration successfully'),
  startCompetition: transitionCompetitionStatus('ONGOING', 'Start competition successfully'),
  startScoring: transitionCompetitionStatus('SCORING', 'Start competition scoring successfully'),
  completeCompetition: transitionCompetitionStatus('COMPLETED', 'Complete competition successfully'),
  archiveCompetition: transitionCompetitionStatus('ARCHIVED', 'Archive competition successfully'),
  deleteCompetition,
  sendInvitations
}
