import { StatusCodes } from 'http-status-codes'

import { NOTIFICATION_SERVICE } from './notification.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listMine = async (req, res, next) => {
  try {
    const { notifications, pagination } = await NOTIFICATION_SERVICE.listUserNotifications(
      req.user.id,
      req.validated?.query || req.query
    )

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get notifications successfully',
      data: notifications,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const markAsRead = async (req, res, next) => {
  try {
    const notification = await NOTIFICATION_SERVICE.markAsRead({
      id: req.params.id,
      userId: req.user.id
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Mark notification as read successfully',
      data: notification
    }))
  } catch (error) {
    next(error)
  }
}

const markAllAsRead = async (req, res, next) => {
  try {
    const result = await NOTIFICATION_SERVICE.markAllAsRead(req.user.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Mark all notifications as read successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const NOTIFICATION_CONTROLLER = {
  listMine,
  markAsRead,
  markAllAsRead
}
