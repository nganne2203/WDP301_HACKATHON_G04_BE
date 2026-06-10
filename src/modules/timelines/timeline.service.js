import mongoose from 'mongoose'

import { TIMELINE_REPOSITORY } from './timeline.repository.js'
import { EVENT_SERVICE } from '#modules/events/event.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'

const TIMELINE_FIELDS = ['eventId', 'title', 'description', 'startTime', 'endTime', 'eventType', 'status']

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureTimelineExists = async (id) => {
  ensureObjectId(id)
  const timeline = await TIMELINE_REPOSITORY.findById(id)
  if (!timeline) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Timeline event not found'])
  }
  return timeline
}

const normalizeEvent = (event) => {
  if (!event) return null
  const e = typeof event.toObject === 'function' ? event.toObject({ getters: true }) : event
  return {
    id: e._id?.toString() || e.id,
    title: e.title,
    semester: e.semester,
    status: e.status
  }
}

const normalizeTimeline = (timeline) => {
  if (!timeline) return null
  const t = typeof timeline.toObject === 'function'
    ? timeline.toObject({ getters: true, virtuals: false })
    : timeline

  return {
    id: t._id?.toString() || t.id,
    event: normalizeEvent(t.eventId),
    eventId: t.eventId?._id?.toString?.() || t.eventId?.toString?.() || t.eventId,
    title: t.title,
    description: t.description,
    startTime: t.startTime,
    endTime: t.endTime,
    eventType: t.eventType,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  }
}

const buildFilter = (query = {}) => {
  const filter = {}

  if (query.eventId) {
    ensureObjectId(query.eventId, 'event id')
    filter.eventId = query.eventId
  }

  if (query.eventType) {
    filter.eventType = query.eventType
  }

  if (query.status) {
    filter.status = query.status
  }

  return filter
}

const listTimelines = async (query = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = buildFilter(query)
  const skip = (page - 1) * limit

  const [timelines, totalItems] = await Promise.all([
    TIMELINE_REPOSITORY.findAll({ filter, skip, limit }),
    TIMELINE_REPOSITORY.count(filter)
  ])

  return {
    timelines: timelines.map(normalizeTimeline),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const getTimelineById = async (id) => {
  const timeline = await ensureTimelineExists(id)
  return normalizeTimeline(timeline)
}

const createTimeline = async (payload = {}) => {
  await EVENT_SERVICE.getRawEventById(payload.eventId)

  if (payload.startTime && payload.endTime && new Date(payload.startTime) >= new Date(payload.endTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['startTime must be before endTime'])
  }

  const data = pickSafeFields(payload, TIMELINE_FIELDS)
  const created = await TIMELINE_REPOSITORY.create(data)
  return normalizeTimeline(await TIMELINE_REPOSITORY.findById(created._id))
}

const updateTimeline = async (id, payload = {}) => {
  await ensureTimelineExists(id)

  if (payload.startTime && payload.endTime && new Date(payload.startTime) >= new Date(payload.endTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['startTime must be before endTime'])
  }

  const safePayload = pickSafeFields(payload, TIMELINE_FIELDS)
  const updated = await TIMELINE_REPOSITORY.updateById(id, safePayload)
  return normalizeTimeline(updated)
}

const deleteTimeline = async (id) => {
  await ensureTimelineExists(id)
  await TIMELINE_REPOSITORY.deleteById(id)
}

export const TIMELINE_SERVICE = {
  listTimelines,
  getTimelineById,
  createTimeline,
  updateTimeline,
  deleteTimeline,
  normalizeTimeline
}
