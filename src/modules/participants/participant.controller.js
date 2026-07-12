import { StatusCodes } from 'http-status-codes'

import { PARTICIPANT_SERVICE } from './participant.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listParticipants = async (req, res, next) => {
  try {
    const { participants, pagination } = await PARTICIPANT_SERVICE.listParticipants(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get participants successfully',
      data: participants,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getParticipantById = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.getParticipantById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get participant successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const getMyParticipant = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.getMyParticipant(req.validated.query.eventId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get current participant successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const createParticipant = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.createParticipant(req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create participant successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const updateParticipant = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.updateParticipant(req.params.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update participant successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const updateCheckInStatus = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.updateCheckInStatus(req.params.id, req.body.checkInStatus, req.user, {
      overrideReason: req.body.overrideReason
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update participant check-in successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const generateCheckInQr = async (req, res, next) => {
  try {
    const qr = await PARTICIPANT_SERVICE.generateCheckInQr(req.body.eventId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Generate event check-in QR successfully',
      data: qr
    }))
  } catch (error) {
    next(error)
  }
}

const scanCheckInQr = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.scanCheckInQr(req.body.token, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Participant self check-in successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const updateAttendance = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.updateAttendance(req.params.id, req.body.attendedActivities)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update participant attendance successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const updateGithubAccessStatus = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.updateGithubAccessStatus(req.params.id, req.body.githubAccessStatus)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update participant GitHub access successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

export const PARTICIPANT_CONTROLLER = {
  listParticipants,
  getParticipantById,
  getMyParticipant,
  createParticipant,
  updateParticipant,
  updateCheckInStatus,
  generateCheckInQr,
  scanCheckInQr,
  updateAttendance,
  updateGithubAccessStatus
}
