import { StatusCodes } from 'http-status-codes'

import { CHAT_SERVICE } from './chat.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listRooms = async (req, res, next) => {
  try {
    const rooms = await CHAT_SERVICE.listRooms({ actor: req.user })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get chat rooms successfully',
      data: rooms
    }))
  } catch (error) {
    next(error)
  }
}

const listMessages = async (req, res, next) => {
  try {
    const messages = await CHAT_SERVICE.getMessages({
      chatRoomId: req.params.id,
      before: req.validated?.query?.before,
      limit: req.validated?.query?.limit,
      actor: req.user
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get chat messages successfully',
      data: messages
    }))
  } catch (error) {
    next(error)
  }
}

const sendMessage = async (req, res, next) => {
  try {
    const message = await CHAT_SERVICE.createMessage({
      ...req.body,
      actor: req.user
    })

    req.app.get('io')?.to(`team_${message.teamId}`).emit('receive_message', message)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Send chat message successfully',
      data: message
    }))
  } catch (error) {
    next(error)
  }
}

const markRoomSeen = async (req, res, next) => {
  try {
    const seen = await CHAT_SERVICE.markRoomSeen({
      chatRoomId: req.params.id,
      actor: req.user
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Mark chat room seen successfully',
      data: seen
    }))
  } catch (error) {
    next(error)
  }
}

const getUnreadCount = async (req, res, next) => {
  try {
    const unread = await CHAT_SERVICE.getUnreadCount({ actor: req.user })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get chat unread count successfully',
      data: unread
    }))
  } catch (error) {
    next(error)
  }
}

export const CHAT_CONTROLLER = {
  getUnreadCount,
  listMessages,
  listRooms,
  markRoomSeen,
  sendMessage
}
