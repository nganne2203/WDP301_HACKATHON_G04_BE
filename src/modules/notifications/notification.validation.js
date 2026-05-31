import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const notificationType = Joi.string().trim().uppercase().valid('DEADLINE', 'WORKSHOP', 'RESULT', 'FEEDBACK', 'SYSTEM')
const notificationStatus = Joi.string().trim().uppercase().valid('UNREAD', 'READ')

const listNotifications = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: notificationType,
    status: notificationStatus
  })
}

const notificationId = {
  params: Joi.object({
    id: objectId.required()
  })
}

export const NOTIFICATION_VALIDATION = {
  listNotifications,
  notificationId
}
