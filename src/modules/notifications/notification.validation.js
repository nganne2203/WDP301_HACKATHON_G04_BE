import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const notificationType = Joi.string().trim().uppercase().valid('DEADLINE', 'WORKSHOP', 'RESULT', 'FEEDBACK', 'SYSTEM')
const notificationStatus = Joi.string().trim().uppercase().valid('UNREAD', 'READ')
const expoPushToken = Joi.string().trim().pattern(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/)

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

const registerPushToken = {
  body: Joi.object({
    token: expoPushToken.required(),
    platform: Joi.string().valid('android', 'ios').required()
  })
}

export const NOTIFICATION_VALIDATION = {
  listNotifications,
  notificationId,
  registerPushToken
}
