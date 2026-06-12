import { StatusCodes } from 'http-status-codes'

import { RANKING_SERVICE } from '#modules/rankings/ranking.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const publishResults = async (req, res, next) => {
  try {
    const result = await RANKING_SERVICE.publishResults(req.body, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Publish results successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const RESULT_CONTROLLER = {
  publishResults
}
