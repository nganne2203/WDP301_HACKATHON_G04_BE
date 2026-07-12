import { Server } from 'socket.io'

import { corsOptions } from '#configs/cors.js'
import { JWT_UTILS } from '#utils/jwtUtil.js'
import { USER_SERVICE } from '#modules/users/user.service.js'
import { canAccessAuthenticatedRoutes } from '#utils/userAccountUtil.js'
import { registerChatSocketHandlers } from '#modules/chat/chat.socket.js'
import { LOGGER } from '#utils/logger.js'
import { getUserRoom, setSocketServer } from './socket-emitter.js'

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth?.token
  if (authToken) return authToken

  const header = socket.handshake.headers?.authorization
  if (header?.startsWith('Bearer ')) return header.split(' ')[1]

  return null
}

const authenticateSocket = async (socket, next) => {
  try {
    const token = getTokenFromSocket(socket)
    if (!token) throw new Error('Socket authentication token is missing')

    const decoded = JWT_UTILS.verifyAccessToken(token)
    const user = await USER_SERVICE.getRawUserById(decoded.id)

    if (!canAccessAuthenticatedRoutes(user)) {
      throw new Error(`Account status is ${user.status}`)
    }

    const roles = USER_SERVICE.getRoleNames(user)
    const permissions = USER_SERVICE.getPermissionCodes(user)

    socket.user = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      roles,
      role: roles[0] || null,
      permissions,
      effectivePermissions: permissions
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const initializeSocketServer = (httpServer, app) => {
  const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
  })

  io.use(authenticateSocket)

  io.on('connection', (socket) => {
    LOGGER.info('Socket connected', { socketId: socket.id, userId: socket.user.id })
    socket.join(getUserRoom(socket.user.id))
    registerChatSocketHandlers(io, socket)

    socket.on('disconnect', (reason) => {
      LOGGER.info('Socket disconnected', { socketId: socket.id, userId: socket.user.id, reason })
    })
  })

  app?.set('io', io)
  setSocketServer(io)
  return io
}
