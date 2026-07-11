import ChatMessage from '#models/chatMessage.model.js'
import ChatParticipant from '#models/chatParticipant.model.js'
import ChatRoom from '#models/chatRoom.model.js'
import Team from '#models/team.model.js'

const teamSelect = 'name eventId leaderId memberIds mentorIds projectName status'
const ACTIVE_CHAT_TEAM_STATUSES = ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED']
const messagePopulate = {
  path: 'senderId',
  select: 'email fullName avatarUrl'
}

const withSession = (query, session) => {
  return session ? query.session(session) : query
}

const findTeamsForUser = async (userId) => {
  return await Team.find({
    status: { $in: ACTIVE_CHAT_TEAM_STATUSES },
    $or: [
      { leaderId: userId },
      { memberIds: userId },
      { mentorIds: userId }
    ]
  })
    .select(teamSelect)
    .sort({ updatedAt: -1 })
}

const findTeamById = async (teamId) => {
  return await Team.findOne({ _id: teamId, status: { $in: ACTIVE_CHAT_TEAM_STATUSES } }).select(teamSelect)
}

const findRoomById = async (id) => {
  return await ChatRoom.findById(id).populate({ path: 'teamId', select: teamSelect })
}

const findRoomByTeamId = async (teamId) => {
  return await ChatRoom.findOne({ teamId }).populate({ path: 'teamId', select: teamSelect })
}

const ensureRoomForTeam = async (teamId) => {
  return await ChatRoom.findOneAndUpdate(
    { teamId },
    {
      $setOnInsert: {
        teamId,
        roomKey: `team_${teamId}`
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  ).populate({ path: 'teamId', select: teamSelect })
}

const findRoomsByTeamIds = async (teamIds = []) => {
  return await ChatRoom.find({ teamId: { $in: teamIds } })
    .populate({ path: 'teamId', select: teamSelect })
    .sort({ updatedAt: -1 })
}

const upsertParticipant = async ({ chatRoomId, userId, role }) => {
  return await ChatParticipant.findOneAndUpdate(
    { chatRoomId, userId },
    {
      $set: { role },
      $setOnInsert: { joinedAt: new Date() }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  )
}

const findParticipant = async ({ chatRoomId, userId }) => {
  return await ChatParticipant.findOne({ chatRoomId, userId })
}

const findParticipantsForUser = async ({ chatRoomIds = [], userId }) => {
  return await ChatParticipant.find({ chatRoomId: { $in: chatRoomIds }, userId })
}

const findLastMessage = async (chatRoomId) => {
  return await ChatMessage.findOne({ chatRoomId })
    .populate(messagePopulate)
    .sort({ createdAt: -1 })
}

const countUnreadMessages = async ({ chatRoomId, userId, lastReadAt }) => {
  const filter = {
    chatRoomId,
    senderId: { $ne: userId }
  }

  if (lastReadAt) filter.createdAt = { $gt: lastReadAt }

  return await ChatMessage.countDocuments(filter)
}

const findMessages = async ({ chatRoomId, before, limit = 50 }) => {
  const filter = { chatRoomId }
  if (before) filter.createdAt = { $lt: before }

  return await ChatMessage.find(filter)
    .populate(messagePopulate)
    .sort({ createdAt: -1 })
    .limit(limit)
}

const findMessageByClientId = async ({ chatRoomId, senderId, clientMessageId }) => {
  return await ChatMessage.findOne({ chatRoomId, senderId, clientMessageId }).populate(messagePopulate)
}

const createMessage = async (data) => {
  const message = await ChatMessage.create(data)
  return await ChatMessage.findById(message._id).populate(messagePopulate)
}

const markRoomSeen = async ({ chatRoomId, userId, readAt = new Date() }) => {
  const participant = await ChatParticipant.findOneAndUpdate(
    { chatRoomId, userId },
    { lastReadAt: readAt },
    { new: true, runValidators: true }
  )

  await ChatMessage.updateMany(
    {
      chatRoomId,
      senderId: { $ne: userId },
      createdAt: { $lte: readAt }
    },
    { isSeen: true }
  )

  return participant
}

const deleteRoomByTeamId = async (teamId, { session } = {}) => {
  const room = await withSession(ChatRoom.findOne({ teamId }), session)
  if (!room) {
    return {
      roomDeleted: 0,
      messagesDeleted: 0,
      participantsDeleted: 0
    }
  }

  const messages = await withSession(ChatMessage.deleteMany({ chatRoomId: room._id }), session)
  const participants = await withSession(ChatParticipant.deleteMany({ chatRoomId: room._id }), session)
  const rooms = await withSession(ChatRoom.deleteOne({ _id: room._id }), session)

  return {
    roomDeleted: rooms.deletedCount || 0,
    messagesDeleted: messages.deletedCount || 0,
    participantsDeleted: participants.deletedCount || 0
  }
}

export const CHAT_REPOSITORY = {
  countUnreadMessages,
  createMessage,
  deleteRoomByTeamId,
  ensureRoomForTeam,
  findLastMessage,
  findMessageByClientId,
  findMessages,
  findParticipant,
  findParticipantsForUser,
  findRoomById,
  findRoomByTeamId,
  findRoomsByTeamIds,
  findTeamById,
  findTeamsForUser,
  markRoomSeen,
  upsertParticipant
}
