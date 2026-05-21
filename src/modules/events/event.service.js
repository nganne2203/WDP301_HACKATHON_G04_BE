import mongoose from 'mongoose'

import { EVENT_REPOSITORY } from './event.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'

const EVENT_STATUSES = ['DRAFT', 'OPEN_REGISTRATION', 'ONGOING', 'SCORING', 'COMPLETED', 'ARCHIVED']
const EVENT_FIELDS = ['title', 'description', 'semester', 'startDate', 'endDate', 'status']

const ensureObjectId = (id, fieldName = 'event id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureDateRange = (payload = {}) => {
  if (!payload.startDate || !payload.endDate) return

  const startDate = new Date(payload.startDate)
  const endDate = new Date(payload.endDate)

  if (startDate > endDate) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['startDate must be before or equal to endDate'])
  }
}

const ensureEventExists = async (id) => {
  ensureObjectId(id)

  const event = await EVENT_REPOSITORY.findById(id)
  if (!event) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
  }

  return event
}

const buildEventFilter = (query = {}) => {
  const filter = {}

  if (query.status) {
    filter.status = query.status
  }

  if (query.semester) {
    filter.semester = query.semester
  }

  if (query.search) {
    const pattern = new RegExp(query.search, 'i')
    filter.$or = [
      { title: pattern },
      { description: pattern },
      { semester: pattern }
    ]
  }

  return filter
}

const normalizeCreator = (creator) => {
  if (!creator) return null
  if (typeof creator === 'string' || creator instanceof mongoose.Types.ObjectId) return { id: creator.toString() }

  return {
    id: creator._id?.toString() || creator.id,
    fullName: creator.fullName,
    email: creator.email
  }
}

const normalizeEvent = (event) => {
  if (!event) return null

  const plainEvent = typeof event.toObject === 'function'
    ? event.toObject({ getters: true, virtuals: false })
    : event

  return {
    id: plainEvent._id?.toString() || plainEvent.id,
    title: plainEvent.title,
    description: plainEvent.description,
    semester: plainEvent.semester,
    startDate: plainEvent.startDate,
    endDate: plainEvent.endDate,
    status: plainEvent.status,
    createdBy: normalizeCreator(plainEvent.createdBy),
    createdAt: plainEvent.createdAt,
    updatedAt: plainEvent.updatedAt
  }
}

const listEvents = async (query = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = buildEventFilter(query)
  const skip = (page - 1) * limit

  const [events, totalItems] = await Promise.all([
    EVENT_REPOSITORY.findAll({ filter, skip, limit }),
    EVENT_REPOSITORY.count(filter)
  ])

  return {
    events: events.map(normalizeEvent),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const getEventById = async (id) => {
  const event = await ensureEventExists(id)
  return normalizeEvent(event)
}

const getRawEventById = async (id) => {
  return await ensureEventExists(id)
}

const createEvent = async (payload = {}, actor = {}) => {
  ensureDateRange(payload)

  const event = await EVENT_REPOSITORY.create({
    ...pickSafeFields(payload, EVENT_FIELDS),
    createdBy: actor.id
  })

  return normalizeEvent(await EVENT_REPOSITORY.findById(event._id))
}

const updateEvent = async (id, payload = {}) => {
  const existingEvent = await ensureEventExists(id)
  const safePayload = pickSafeFields(payload, EVENT_FIELDS)

  ensureDateRange({
    startDate: safePayload.startDate ?? existingEvent.startDate,
    endDate: safePayload.endDate ?? existingEvent.endDate
  })

  const event = await EVENT_REPOSITORY.updateById(id, safePayload)
  return normalizeEvent(event)
}

const updateEventStatus = async (id, status) => {
  if (!EVENT_STATUSES.includes(status)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid event status'])
  }

  ensureObjectId(id)
  const event = await EVENT_REPOSITORY.updateById(id, { status })
  if (!event) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
  }

  return normalizeEvent(event)
}

const deleteEvent = async (id) => {
  await ensureEventExists(id)
  await EVENT_REPOSITORY.deleteById(id)
}

export const EVENT_SERVICE = {
  EVENT_STATUSES,
  listEvents,
  getEventById,
  getRawEventById,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  normalizeEvent
}
