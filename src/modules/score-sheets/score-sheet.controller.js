import { StatusCodes } from 'http-status-codes'

import { SCORE_SHEET_SERVICE } from './score-sheet.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listScoreSheets = async (req, res, next) => {
  try {
    const { scoreSheets, pagination } = await SCORE_SHEET_SERVICE.listScoreSheets(req.validated?.query || req.query, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get score sheets successfully',
      data: scoreSheets,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const createScoreSheet = async (req, res, next) => {
  try {
    const scoreSheet = await SCORE_SHEET_SERVICE.createScoreSheet(req.body, req.user)
    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create score sheet successfully',
      data: scoreSheet
    }))
  } catch (error) {
    next(error)
  }
}

const getScoreSheetById = async (req, res, next) => {
  try {
    const scoreSheet = await SCORE_SHEET_SERVICE.getScoreSheetById(req.params.id, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get score sheet successfully',
      data: scoreSheet
    }))
  } catch (error) {
    next(error)
  }
}

const updateScoreSheet = async (req, res, next) => {
  try {
    const scoreSheet = await SCORE_SHEET_SERVICE.updateScoreSheet(req.params.id, req.body, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update score sheet successfully',
      data: scoreSheet
    }))
  } catch (error) {
    next(error)
  }
}

const submitScoreSheet = async (req, res, next) => {
  try {
    const scoreSheet = await SCORE_SHEET_SERVICE.submitScoreSheet(req.params.id, req.user)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Submit score sheet successfully',
      data: scoreSheet
    }))
  } catch (error) {
    next(error)
  }
}

export const SCORE_SHEET_CONTROLLER = {
  listScoreSheets,
  createScoreSheet,
  getScoreSheetById,
  updateScoreSheet,
  submitScoreSheet
}
