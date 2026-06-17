import { StatusCodes } from 'http-status-codes'

import { JUDGING_BOARD_SERVICE } from './judging-board.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listBoards = async (req, res, next) => {
  try {
    const { boards, pagination } = await JUDGING_BOARD_SERVICE.listBoards(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get judging boards successfully',
      data: boards,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getBoardById = async (req, res, next) => {
  try {
    const board = await JUDGING_BOARD_SERVICE.getBoardById(req.params.id)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get judging board successfully',
      data: board
    }))
  } catch (error) {
    next(error)
  }
}

const createBoard = async (req, res, next) => {
  try {
    const board = await JUDGING_BOARD_SERVICE.createBoard(req.body)
    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create judging board successfully',
      data: board
    }))
  } catch (error) {
    next(error)
  }
}

const updateBoard = async (req, res, next) => {
  try {
    const board = await JUDGING_BOARD_SERVICE.updateBoard(req.params.id, req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update judging board successfully',
      data: board
    }))
  } catch (error) {
    next(error)
  }
}

const deleteBoard = async (req, res, next) => {
  try {
    await JUDGING_BOARD_SERVICE.deleteBoard(req.params.id)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete judging board successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

const autoAssignBoards = async (req, res, next) => {
  try {
    const result = await JUDGING_BOARD_SERVICE.autoAssignBoards(req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Auto assign judging boards successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const randomizePreview = async (req, res, next) => {
  try {
    const result = await JUDGING_BOARD_SERVICE.previewRandomizedBoards(req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Preview randomized judging boards successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const confirmRandomization = async (req, res, next) => {
  try {
    const result = await JUDGING_BOARD_SERVICE.confirmRandomizedBoards(req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Confirm randomized judging boards successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const JUDGING_BOARD_CONTROLLER = {
  listBoards,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard,
  autoAssignBoards,
  randomizePreview,
  confirmRandomization
}
