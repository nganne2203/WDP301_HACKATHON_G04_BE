import { StatusCodes } from 'http-status-codes'

import { RANKING_SERVICE } from '#modules/rankings/ranking.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listFinalists = async (req, res, next) => {
  try {
    const { finalists, pagination } = await RANKING_SERVICE.listFinalists(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get finalists successfully',
      data: finalists,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const selectFinalists = async (req, res, next) => {
  try {
    const result = await RANKING_SERVICE.selectFinalists(req.body, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Select finalists successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const selectManualFinalists = async (req, res, next) => {
  try {
    const result = await RANKING_SERVICE.selectManualFinalists(req.body, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Select manual finalists successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const FINALIST_CONTROLLER = {
  listFinalists,
  selectFinalists,
  selectManualFinalists
}
