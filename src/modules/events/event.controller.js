import { StatusCodes } from 'http-status-codes'

import { EVENT_SERVICE } from './event.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listEvents = async (req, res, next) => {
  try {
    const { events, pagination } = await EVENT_SERVICE.listEvents(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get events successfully',
      data: events,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getEventById = async (req, res, next) => {
  try {
    const event = await EVENT_SERVICE.getEventById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get event successfully',
      data: event
    }))
  } catch (error) {
    next(error)
  }
}

const createEvent = async (req, res, next) => {
  try {
    const event = await EVENT_SERVICE.createEvent(req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create event successfully',
      data: event
    }))
  } catch (error) {
    next(error)
  }
}

const updateEvent = async (req, res, next) => {
  try {
    const event = await EVENT_SERVICE.updateEvent(req.params.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update event successfully',
      data: event
    }))
  } catch (error) {
    next(error)
  }
}

const updateEventStatus = async (req, res, next) => {
  try {
    const event = await EVENT_SERVICE.updateEventStatus(req.params.id, req.body.status)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update event status successfully',
      data: event
    }))
  } catch (error) {
    next(error)
  }
}

const deleteEvent = async (req, res, next) => {
  try {
    await EVENT_SERVICE.deleteEvent(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete event successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

const sendInvitations = async (req, res, next) => {
  try {
    const result = await EVENT_SERVICE.sendInvitations(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Send event invitations successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const EVENT_CONTROLLER = {
  listEvents,
  getEventById,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  sendInvitations
}
