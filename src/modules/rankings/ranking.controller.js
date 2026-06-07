import { StatusCodes } from 'http-status-codes'

import { RANKING_SERVICE } from './ranking.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listRankings = async (req, res, next) => {
  try {
    const { rankings, pagination } = await RANKING_SERVICE.listRankings(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get rankings successfully',
      data: rankings,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const generateRankings = async (req, res, next) => {
  try {
    const result = await RANKING_SERVICE.generateRankings(req.body, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Generate rankings successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const RANKING_CONTROLLER = {
  listRankings,
  generateRankings
}
