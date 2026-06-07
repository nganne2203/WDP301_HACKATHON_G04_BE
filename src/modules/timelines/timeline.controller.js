import { StatusCodes } from 'http-status-codes'

import { TIMELINE_SERVICE } from './timeline.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listTimelines = async (req, res, next) => {
  try {
    const { timelines, pagination } = await TIMELINE_SERVICE.listTimelines(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get timelines successfully',
      data: timelines,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getTimelineById = async (req, res, next) => {
  try {
    const timeline = await TIMELINE_SERVICE.getTimelineById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get timeline successfully',
      data: timeline
    }))
  } catch (error) {
    next(error)
  }
}

const createTimeline = async (req, res, next) => {
  try {
    const timeline = await TIMELINE_SERVICE.createTimeline(req.body)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create timeline successfully',
      data: timeline
    }))
  } catch (error) {
    next(error)
  }
}

const updateTimeline = async (req, res, next) => {
  try {
    const timeline = await TIMELINE_SERVICE.updateTimeline(req.params.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update timeline successfully',
      data: timeline
    }))
  } catch (error) {
    next(error)
  }
}

const deleteTimeline = async (req, res, next) => {
  try {
    await TIMELINE_SERVICE.deleteTimeline(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete timeline successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

export const TIMELINE_CONTROLLER = {
  listTimelines,
  getTimelineById,
  createTimeline,
  updateTimeline,
  deleteTimeline
}
