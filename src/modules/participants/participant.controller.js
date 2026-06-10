import { StatusCodes } from 'http-status-codes'

import { PARTICIPANT_SERVICE } from './participant.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listParticipants = async (req, res, next) => {
  try {
    const { participants, pagination } = await PARTICIPANT_SERVICE.listParticipants(
      req.validated?.query || req.query
    )

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

const registerParticipant = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.registerParticipant(
      req.validated?.body || req.body,
      req.user?.id
    )

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Register participant successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const updateParticipant = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.updateParticipant(
      req.params.id,
      req.validated?.body || req.body
    )

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update participant successfully',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

const checkIn = async (req, res, next) => {
  try {
    const participant = await PARTICIPANT_SERVICE.checkIn(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Check-in successful',
      data: participant
    }))
  } catch (error) {
    next(error)
  }
}

export const PARTICIPANT_CONTROLLER = {
  listParticipants,
  getParticipantById,
  registerParticipant,
  updateParticipant,
  checkIn
}
