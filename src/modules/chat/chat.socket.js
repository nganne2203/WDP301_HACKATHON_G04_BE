import { CHAT_SERVICE } from './chat.service.js'
import { SOCKET_EVENTS } from './socketEvents.js'
import { LOGGER } from '#utils/logger.js'
import ApiError from '#utils/ApiError.js'

const getPublicSocketError = (error) => {
  if (error instanceof ApiError) return error.errors?.[0] || error.message
  return 'We could not complete that chat action. Please try again.'
}

const emitSocketError = (socket, error) => {
  socket.emit(SOCKET_EVENTS.ERROR, {
    code: error instanceof ApiError ? error.code : 'SOCKET_ERROR',
    message: getPublicSocketError(error),
    errors: error instanceof ApiError ? error.errors || [] : []
  })
}

const acknowledge = (callback, payload) => {
  if (typeof callback === 'function') callback(payload)
}

export const registerChatSocketHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.JOIN_TEAM_ROOM, async (payload = {}, callback) => {
    try {
      const room = await CHAT_SERVICE.joinTeamRoom({
        teamId: payload.teamId,
        actor: socket.user
      })

      await socket.join(room.roomKey)
      acknowledge(callback, { ok: true, room })
    } catch (error) {
      LOGGER.warn('Socket join team room failed', { socketId: socket.id, error: error.message })
      emitSocketError(socket, error)
      acknowledge(callback, { ok: false, error: getPublicSocketError(error) })
    }
  })

  socket.on(SOCKET_EVENTS.LEAVE_TEAM_ROOM, async (payload = {}, callback) => {
    const roomKey = payload.roomKey || (payload.teamId ? `team_${payload.teamId}` : null)
    if (roomKey) await socket.leave(roomKey)
    acknowledge(callback, { ok: true })
  })

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (payload = {}, callback) => {
    try {
      const message = await CHAT_SERVICE.createMessage({
        teamId: payload.teamId,
        chatRoomId: payload.chatRoomId,
        message: payload.message,
        messageType: payload.messageType || 'text',
        clientMessageId: payload.clientMessageId,
        actor: socket.user
      })

      io.to(`team_${message.teamId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, message)
      acknowledge(callback, { ok: true, message })
    } catch (error) {
      LOGGER.warn('Socket send message failed', { socketId: socket.id, error: error.message })
      emitSocketError(socket, error)
      acknowledge(callback, { ok: false, error: getPublicSocketError(error) })
    }
  })

  socket.on(SOCKET_EVENTS.USER_TYPING, (payload = {}) => {
    if (!payload.teamId) return
    socket.to(`team_${payload.teamId}`).emit(SOCKET_EVENTS.USER_TYPING, {
      teamId: payload.teamId,
      userId: socket.user.id,
      role: socket.user.role,
      fullName: socket.user.fullName || socket.user.email
    })
  })

  socket.on(SOCKET_EVENTS.USER_STOP_TYPING, (payload = {}) => {
    if (!payload.teamId) return
    socket.to(`team_${payload.teamId}`).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
      teamId: payload.teamId,
      userId: socket.user.id
    })
  })

  socket.on(SOCKET_EVENTS.MESSAGE_SEEN, async (payload = {}, callback) => {
    try {
      const seen = await CHAT_SERVICE.markRoomSeen({
        chatRoomId: payload.chatRoomId,
        actor: socket.user
      })

      io.to(`team_${seen.teamId}`).emit(SOCKET_EVENTS.MESSAGE_SEEN, seen)
      acknowledge(callback, { ok: true, seen })
    } catch (error) {
      LOGGER.warn('Socket mark seen failed', { socketId: socket.id, error: error.message })
      emitSocketError(socket, error)
      acknowledge(callback, { ok: false, error: getPublicSocketError(error) })
    }
  })
}
