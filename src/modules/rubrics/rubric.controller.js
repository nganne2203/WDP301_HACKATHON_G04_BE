import { StatusCodes } from 'http-status-codes'

import { RUBRIC_SERVICE } from './rubric.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listRubrics = async (req, res, next) => {
  try {
    const { rubrics, pagination } = await RUBRIC_SERVICE.listRubrics(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get rubrics successfully',
      data: rubrics,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const createRubric = async (req, res, next) => {
  try {
    const rubric = await RUBRIC_SERVICE.createRubric(req.body, req.user)
    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create rubric successfully',
      data: rubric
    }))
  } catch (error) {
    next(error)
  }
}

const updateRubric = async (req, res, next) => {
  try {
    const rubric = await RUBRIC_SERVICE.updateRubric(req.params.id, req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update rubric successfully',
      data: rubric
    }))
  } catch (error) {
    next(error)
  }
}

const getRubricById = async (req, res, next) => {
  try {
    const rubric = await RUBRIC_SERVICE.getRubricById(req.params.id)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get rubric successfully',
      data: rubric
    }))
  } catch (error) {
    next(error)
  }
}

const addCriterion = async (req, res, next) => {
  try {
    const result = await RUBRIC_SERVICE.addCriterion(req.params.id, req.body)
    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create rubric criterion successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const updateCriterion = async (req, res, next) => {
  try {
    const result = await RUBRIC_SERVICE.updateCriterion(req.params.id, req.params.criterionId, req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update rubric criterion successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const deleteCriterion = async (req, res, next) => {
  try {
    const result = await RUBRIC_SERVICE.deleteCriterion(req.params.id, req.params.criterionId)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete rubric criterion successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const RUBRIC_CONTROLLER = {
  listRubrics,
  createRubric,
  updateRubric,
  getRubricById,
  addCriterion,
  updateCriterion,
  deleteCriterion
}
