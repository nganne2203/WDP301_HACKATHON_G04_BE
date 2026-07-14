import { StatusCodes } from 'http-status-codes'

import { ROUND_SERVICE } from './round.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listRounds = async (req, res, next) => {
  try {
    const { rounds, pagination } = await ROUND_SERVICE.listRounds(req.validated?.query || req.query, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get rounds successfully',
      data: rounds,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getRoundById = async (req, res, next) => {
  try {
    const round = await ROUND_SERVICE.getRoundById(req.params.id, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get round successfully',
      data: round
    }))
  } catch (error) {
    next(error)
  }
}

const createRound = async (req, res, next) => {
  try {
    const round = await ROUND_SERVICE.createRound(req.body)
    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create round successfully',
      data: round
    }))
  } catch (error) {
    next(error)
  }
}

const updateRound = async (req, res, next) => {
  try {
    const round = await ROUND_SERVICE.updateRound(req.params.id, req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update round successfully',
      data: round
    }))
  } catch (error) {
    next(error)
  }
}

const deleteRound = async (req, res, next) => {
  try {
    await ROUND_SERVICE.deleteRound(req.params.id)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete round successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

export const ROUND_CONTROLLER = {
  listRounds,
  getRoundById,
  createRound,
  updateRound,
  deleteRound
}
