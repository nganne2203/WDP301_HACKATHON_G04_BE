let activeIo = null

export const SOCKET_NOTIFICATION_EVENTS = {
  NOTIFICATION_CREATED: 'notification_created',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATIONS_READ_ALL: 'notifications_read_all'
}

export const getUserRoom = (userId) => `user:${userId}`

export const setSocketServer = (io) => {
  activeIo = io
}

export const emitUserSocketEvent = (userId, event, payload) => {
  if (!activeIo || !userId) return false
  activeIo.to(getUserRoom(userId)).emit(event, payload)
  return true
}
