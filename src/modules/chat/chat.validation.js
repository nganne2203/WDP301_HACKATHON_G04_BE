import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const messageType = Joi.string().trim().lowercase().valid('text', 'image', 'file')

const listRooms = {
  query: Joi.object({})
}

const listMessages = {
  params: Joi.object({
    id: objectId.required()
  }),
  query: Joi.object({
    before: Joi.date().iso(),
    limit: Joi.number().integer().min(1).max(100).default(50)
  })
}

const sendMessage = {
  body: Joi.object({
    teamId: objectId,
    chatRoomId: objectId,
    message: Joi.string().trim().min(1).max(5000).required(),
    messageType: messageType.default('text'),
    clientMessageId: Joi.string().trim().max(120)
  }).or('teamId', 'chatRoomId')
}

const markRoomSeen = {
  params: Joi.object({
    id: objectId.required()
  })
}

export const CHAT_VALIDATION = {
  listMessages,
  listRooms,
  markRoomSeen,
  sendMessage
}
