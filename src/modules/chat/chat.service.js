import mongoose from 'mongoose'

import { CHAT_REPOSITORY } from './chat.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { env } from '#configs/environment.js'

const MESSAGE_TYPES = ['text', 'image', 'file']
const ACTIVE_CHAT_TEAM_STATUSES = ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED']
const READABLE_CHAT_COMPETITION_STATUSES = ['DRAFT', 'OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'ONGOING', 'SCORING', 'COMPLETED']
const WRITABLE_CHAT_COMPETITION_STATUSES = ['DRAFT', 'OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'ONGOING', 'SCORING']

const getId = (value) => {
  return value?._id?.toString?.() || value?.id || value?.toString?.()
}

const isSameId = (left, right) => {
  const leftId = getId(left)
  const rightId = getId(right)
  return Boolean(leftId && rightId && leftId === rightId)
}

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const getTeam = async (teamId, repository = CHAT_REPOSITORY) => {
  ensureObjectId(teamId, 'team id')
  const team = await repository.findTeamById(teamId)
  if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])
  return team
}

const getRoom = async (chatRoomId, repository = CHAT_REPOSITORY) => {
  ensureObjectId(chatRoomId, 'chat room id')
  const room = await repository.findRoomById(chatRoomId)
  if (!room) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Chat room not found'])
  return room
}

const getParticipantRole = (team, actor) => {
  const actorId = actor?.id
  if (!actorId) return null

  if ((team.mentorIds || []).some(id => isSameId(id, actorId))) return 'mentor'
  if (isSameId(team.leaderId, actorId) || (team.memberIds || []).some(id => isSameId(id, actorId))) return 'member'

  return null
}

const ensureTeamChatActive = (team) => {
  if (!ACTIVE_CHAT_TEAM_STATUSES.includes(team?.status)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Chat room not found'])
  }
}

const getTeamCompetitionStatus = (team) => {
  return team?.competitionId?.status || team?.competition?.status || null
}

const ensureTeamChatVisible = (team) => {
  ensureTeamChatActive(team)
  if (env.workflow.relaxedDemoRules) return
  const competitionStatus = getTeamCompetitionStatus(team)
  if (competitionStatus && !READABLE_CHAT_COMPETITION_STATUSES.includes(competitionStatus)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Chat room not found'])
  }
}

const ensureTeamChatWritable = (team) => {
  ensureTeamChatVisible(team)
  if (env.workflow.relaxedDemoRules) return
  const competitionStatus = getTeamCompetitionStatus(team)
  if (competitionStatus && !WRITABLE_CHAT_COMPETITION_STATUSES.includes(competitionStatus)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Chat room is read-only after competition completion'])
  }
}

const ensureTeamChatAccess = (team, actor) => {
  ensureTeamChatVisible(team)
  const role = getParticipantRole(team, actor)
  if (!role) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['You are not a participant in this team chat'])
  }
  return role
}

const normalizeSender = (sender) => {
  if (!sender) return null

  return {
    id: getId(sender),
    email: sender.email,
    fullName: sender.fullName,
    avatarUrl: sender.avatarUrl || null
  }
}

const normalizeMessage = (message) => {
  if (!message) return null
  const plainMessage = typeof message.toObject === 'function'
    ? message.toObject({ getters: true, virtuals: false })
    : message

  return {
    id: getId(plainMessage._id) || plainMessage.id,
    chatRoomId: getId(plainMessage.chatRoomId),
    teamId: getId(plainMessage.teamId),
    senderId: getId(plainMessage.senderId),
    sender: normalizeSender(plainMessage.senderId),
    senderRole: plainMessage.senderRole,
    message: plainMessage.message,
    messageType: plainMessage.messageType,
    clientMessageId: plainMessage.clientMessageId || null,
    isSeen: Boolean(plainMessage.isSeen),
    createdAt: plainMessage.createdAt,
    updatedAt: plainMessage.updatedAt
  }
}

const normalizeTeam = (team) => {
  if (!team) return null

  return {
    id: getId(team),
    competitionId: getId(team.competitionId),
    name: team.name,
    projectName: team.projectName || null,
    status: team.status,
    competitionStatus: getTeamCompetitionStatus(team) || null
  }
}

const normalizeRoom = ({ room, participant, lastMessage = null, unreadCount = 0 }) => {
  if (!room) return null
  const team = room.teamId?.name ? room.teamId : null

  return {
    id: getId(room),
    teamId: getId(room.teamId),
    roomKey: room.roomKey,
    team: normalizeTeam(team),
    participantRole: participant?.role || null,
    unreadCount,
    lastMessage: normalizeMessage(lastMessage),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  }
}

const ensureRoomParticipant = async ({ room, team, actor, repository = CHAT_REPOSITORY }) => {
  const role = ensureTeamChatAccess(team, actor)
  return await repository.upsertParticipant({
    chatRoomId: getId(room),
    userId: actor.id,
    role
  })
}

const listRooms = async ({ actor, repository = CHAT_REPOSITORY } = {}) => {
  const teams = await repository.findTeamsForUser(actor.id)
  const rooms = []

  for (const team of teams) {
    const role = getParticipantRole(team, actor)
    if (!role) continue
    try {
      ensureTeamChatVisible(team)
    } catch {
      continue
    }

    const room = await repository.ensureRoomForTeam(getId(team))
    const participant = await repository.upsertParticipant({
      chatRoomId: getId(room),
      userId: actor.id,
      role
    })
    const lastMessage = await repository.findLastMessage(getId(room))
    const unreadCount = await repository.countUnreadMessages({
      chatRoomId: getId(room),
      userId: actor.id,
      lastReadAt: participant?.lastReadAt
    })

    rooms.push(normalizeRoom({ room, participant, lastMessage, unreadCount }))
  }

  return rooms.sort((left, right) => {
    const leftDate = left.lastMessage?.createdAt || left.updatedAt || left.createdAt
    const rightDate = right.lastMessage?.createdAt || right.updatedAt || right.createdAt
    return new Date(rightDate).getTime() - new Date(leftDate).getTime()
  })
}

const joinTeamRoom = async ({ teamId, actor, repository = CHAT_REPOSITORY }) => {
  const team = await getTeam(teamId, repository)
  const room = await repository.ensureRoomForTeam(getId(team))
  const participant = await ensureRoomParticipant({ room, team, actor, repository })

  return normalizeRoom({ room, participant })
}

const getMessages = async ({ chatRoomId, before, limit = 50, actor, repository = CHAT_REPOSITORY }) => {
  const room = await getRoom(chatRoomId, repository)
  await ensureRoomParticipant({ room, team: room.teamId, actor, repository })

  const messages = await repository.findMessages({
    chatRoomId: getId(room),
    before: before ? new Date(before) : null,
    limit
  })

  return messages.reverse().map(normalizeMessage)
}

const getRoomMessagesByTeam = async ({ teamId, before, limit = 50, actor, repository = CHAT_REPOSITORY }) => {
  const room = await repository.ensureRoomForTeam(getId(await getTeam(teamId, repository)))
  return await getMessages({ chatRoomId: getId(room), before, limit, actor, repository })
}

const createMessage = async ({ teamId, chatRoomId, message, messageType = 'text', clientMessageId, actor, repository = CHAT_REPOSITORY }) => {
  if (!MESSAGE_TYPES.includes(messageType)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Unsupported message type'])
  }

  const normalizedMessage = String(message || '').trim()
  if (!normalizedMessage) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Message is required'])
  }

  let room = null
  let team = null

  if (chatRoomId) {
    room = await getRoom(chatRoomId, repository)
    team = room.teamId
  } else {
    team = await getTeam(teamId, repository)
    room = await repository.ensureRoomForTeam(getId(team))
  }

  ensureTeamChatWritable(team)
  const participant = await ensureRoomParticipant({ room, team, actor, repository })

  if (clientMessageId) {
    const existingMessage = await repository.findMessageByClientId({
      chatRoomId: getId(room),
      senderId: actor.id,
      clientMessageId
    })
    if (existingMessage) return normalizeMessage(existingMessage)
  }

  try {
    const createdMessage = await repository.createMessage({
      chatRoomId: getId(room),
      teamId: getId(team),
      senderId: actor.id,
      senderRole: participant.role,
      message: normalizedMessage,
      messageType,
      clientMessageId: clientMessageId || undefined
    })

    return normalizeMessage(createdMessage)
  } catch (error) {
    if (error?.code === 11000 && clientMessageId) {
      const existingMessage = await repository.findMessageByClientId({
        chatRoomId: getId(room),
        senderId: actor.id,
        clientMessageId
      })
      if (existingMessage) return normalizeMessage(existingMessage)
    }
    throw error
  }
}

const markRoomSeen = async ({ chatRoomId, actor, repository = CHAT_REPOSITORY }) => {
  const room = await getRoom(chatRoomId, repository)
  await ensureRoomParticipant({ room, team: room.teamId, actor, repository })
  const readAt = new Date()
  await repository.markRoomSeen({ chatRoomId: getId(room), userId: actor.id, readAt })

  return {
    chatRoomId: getId(room),
    teamId: getId(room.teamId),
    userId: actor.id,
    readAt
  }
}

const getUnreadCount = async ({ actor, repository = CHAT_REPOSITORY }) => {
  const rooms = await listRooms({ actor, repository })
  return {
    total: rooms.reduce((sum, room) => sum + room.unreadCount, 0),
    rooms: rooms.map(room => ({ chatRoomId: room.id, teamId: room.teamId, unreadCount: room.unreadCount }))
  }
}

export const CHAT_SERVICE = {
  createMessage,
  getMessages,
  getRoomMessagesByTeam,
  getUnreadCount,
  joinTeamRoom,
  listRooms,
  markRoomSeen
}
