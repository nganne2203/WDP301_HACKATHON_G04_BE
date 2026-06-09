import { StatusCodes } from 'http-status-codes'

import { OPERATIONS_SERVICE } from './operations.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const getDashboardMetrics = async (req, res, next) => {
  try {
    const metrics = await OPERATIONS_SERVICE.getDashboardMetrics(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get dashboard metrics successfully',
      data: metrics
    }))
  } catch (error) {
    next(error)
  }
}

const getPipelineSummary = async (req, res, next) => {
  try {
    const summary = await OPERATIONS_SERVICE.getPipelineSummary(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get pipeline summary successfully',
      data: summary
    }))
  } catch (error) {
    next(error)
  }
}

export const OPERATIONS_CONTROLLER = {
  getDashboardMetrics,
  getPipelineSummary
}
