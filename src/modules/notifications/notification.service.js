import mongoose from 'mongoose'

import { NOTIFICATION_REPOSITORY } from './notification.repository.js'
import { EMAIL_SERVICE } from './email.service.js'
import { EMAIL_TEMPLATE_KEYS } from './email-templates.js'
import { env } from '#configs/environment.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { LOGGER } from '#utils/logger.js'
import { emitUserSocketCompetition, SOCKET_NOTIFICATION_EVENTS } from '#services/socket/socket-emitter.js'

const NOTIFICATION_TYPES = ['DEADLINE', 'WORKSHOP', 'RESULT', 'FEEDBACK', 'SYSTEM']
const CHANNELS = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL'
}

const getId = (value) => {
  return value?._id?.toString?.() || value?.id || value?.toString?.()
}

const normalizeNotification = (notification) => {
  if (!notification) return null

  const plainNotification = typeof notification.toObject === 'function'
    ? notification.toObject({ getters: true, virtuals: false })
    : notification

  return {
    id: getId(plainNotification._id) || plainNotification.id,
    userId: getId(plainNotification.userId),
    title: plainNotification.title,
    message: plainNotification.message,
    type: plainNotification.type,
    status: plainNotification.status,
    dedupeKey: plainNotification.dedupeKey,
    metadata: plainNotification.metadata,
    createdAt: plainNotification.createdAt,
    updatedAt: plainNotification.updatedAt
  }
}

const ensureObjectId = (id, fieldName = 'notification id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const getFrontendUrl = (path = '/', logger = LOGGER) => {
  const frontendUrl = env.client.frontendUrl || env.client.urls[0]
  if (!frontendUrl) return null

  try {
    return new URL(path, frontendUrl).toString()
  } catch (error) {
    logger.warn('Notification frontend URL is invalid; skipping generated link', {
      frontendUrl,
      path,
      error: error.message
    })
    return null
  }
}

const appendSearchParams = (urlString, params = {}, logger = LOGGER) => {
  if (!urlString) return null

  try {
    const url = new URL(urlString)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
    return url.toString()
  } catch (error) {
    logger.warn('Generated notification URL is invalid while appending query params', {
      urlString,
      error: error.message
    })
    return null
  }
}

const buildRegistrationUrl = (competitionId, logger = LOGGER) => {
  const registrationUrl = getFrontendUrl('/register', logger)
  return appendSearchParams(registrationUrl, { competitionId }, logger)
}

export const createNotificationService = ({
  repository = NOTIFICATION_REPOSITORY,
  emailService = EMAIL_SERVICE,
  socketEmitter = {
    emitToUser: emitUserSocketCompetition
  },
  logger = LOGGER
} = {}) => {
  const createInAppNotification = async ({ userId, title, message, type, metadata, dedupeKey }) => {
    if (dedupeKey && repository.findByDedupeKey) {
      const existingNotification = await repository.findByDedupeKey(dedupeKey)
      if (existingNotification) {
        return {
          notification: normalizeNotification(existingNotification),
          created: false
        }
      }
    }

    let notification
    try {
      notification = await repository.create({
        userId,
        title,
        message,
        type,
        dedupeKey,
        metadata
      })
    } catch (error) {
      if (dedupeKey && error?.code === 11000 && repository.findByDedupeKey) {
        const existingNotification = await repository.findByDedupeKey(dedupeKey)
        if (existingNotification) {
          return {
            notification: normalizeNotification(existingNotification),
            created: false
          }
        }
      }

      throw error
    }

    return {
      notification: normalizeNotification(notification),
      created: true
    }
  }

  const notifyUser = async ({
    user,
    title,
    message,
    type = 'SYSTEM',
    dedupeKey,
    metadata = {},
    channels = [CHANNELS.IN_APP, CHANNELS.EMAIL],
    emailTemplate = EMAIL_TEMPLATE_KEYS.NOTIFICATION,
    emailContext = {}
  } = {}) => {
    const userId = getId(user)
    const result = {
      notification: null,
      email: null,
      errors: []
    }

    if (!NOTIFICATION_TYPES.includes(type)) {
      result.errors.push(`Unsupported notification type: ${type}`)
      type = 'SYSTEM'
    }

    if (channels.includes(CHANNELS.IN_APP) && userId) {
      try {
        const inAppResult = await createInAppNotification({
          userId,
          title,
          message,
          type,
          dedupeKey,
          metadata
        })
        result.notification = inAppResult.notification

        if (inAppResult.created) {
          socketEmitter.emitToUser?.(
            userId,
            SOCKET_NOTIFICATION_EVENTS.NOTIFICATION_CREATED,
            result.notification
          )
        }
      } catch (error) {
        logger.error('In-app notification creation failed', {
          userId,
          title,
          error: error.message
        })
        result.errors.push(error.message)
      }
    }

    if (channels.includes(CHANNELS.EMAIL)) {
      result.email = await emailService.sendTemplateEmail({
        to: user?.email,
        template: emailTemplate,
        context: {
          fullName: user?.fullName || user?.email,
          title,
          message,
          ...emailContext
        },
        metadata: {
          ...metadata,
          notificationType: type,
          userId
        }
      })
    }

    return result
  }

  const sendCompetitionInvitations = async ({ competition, emails = [], message, actor } = {}) => {
    const uniqueEmails = [...new Set(emails.map((email) => String(email).trim().toLowerCase()).filter(Boolean))]
    const registrationUrl = buildRegistrationUrl(getId(competition), logger)
    const results = []

    for (const email of uniqueEmails) {
      const emailResult = await emailService.sendTemplateEmail({
        to: email,
        template: EMAIL_TEMPLATE_KEYS.COMPETITION_INVITATION,
        context: {
          fullName: email,
          eventTitle: competition?.title,
          message,
          registrationUrl
        },
        metadata: {
          competitionId: getId(competition),
          invitedBy: actor?.id || actor?.email
        }
      })

      results.push({
        email,
        ...emailResult
      })
    }

    return {
      total: uniqueEmails.length,
      sent: results.filter((result) => result.sent).length,
      skipped: results.filter((result) => result.status === 'SKIPPED').length,
      failed: results.filter((result) => result.status === 'FAILED').length,
      results
    }
  }

  const listUserNotifications = async (userId, query = {}) => {
    ensureObjectId(userId, 'user id')

    const { page, limit } = normalizePaginationQuery(query)
    const filter = {}

    if (query.status) {
      filter.status = query.status
    }

    if (query.type) {
      filter.type = query.type
    }

    const skip = (page - 1) * limit
    const [notifications, totalItems] = await Promise.all([
      repository.findByUser({ userId, filter, skip, limit }),
      repository.countByUser(userId, filter)
    ])

    return {
      notifications: notifications.map(normalizeNotification),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const markAsRead = async ({ id, userId }) => {
    ensureObjectId(id)
    ensureObjectId(userId, 'user id')

    const notification = await repository.markAsRead({ id, userId })
    if (!notification) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Notification not found'])
    }

    const normalizedNotification = normalizeNotification(notification)
    socketEmitter.emitToUser?.(
      userId,
      SOCKET_NOTIFICATION_EVENTS.NOTIFICATION_READ,
      normalizedNotification
    )

    return normalizedNotification
  }

  const markAllAsRead = async (userId) => {
    ensureObjectId(userId, 'user id')
    const result = await repository.markAllAsRead(userId)

    const normalizedResult = {
      matchedCount: result.matchedCount || 0,
      modifiedCount: result.modifiedCount || 0
    }

    socketEmitter.emitToUser?.(
      userId,
      SOCKET_NOTIFICATION_EVENTS.NOTIFICATIONS_READ_ALL,
      normalizedResult
    )

    return normalizedResult
  }

  return {
    notifyUser,
    sendCompetitionInvitations,
    listUserNotifications,
    markAsRead,
    markAllAsRead,
    normalizeNotification
  }
}

export const NOTIFICATION_SERVICE = createNotificationService()
