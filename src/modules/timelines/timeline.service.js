import mongoose from 'mongoose'

import { TIMELINE_REPOSITORY } from './timeline.repository.js'
import { EVENT_SERVICE } from '#modules/events/event.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { escapeRegex } from '#utils/sanitizeUtil.js'
import {
  applyEventVisibilityScope,
  ensureCanViewEventChild
} from '#utils/eventVisibilityUtil.js'

const TIMELINE_FIELDS = ['eventId', 'title', 'description', 'startTime', 'endTime', 'eventType', 'status']

const ensureObjectId = (id, fieldName = 'timeline id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureDateRange = (payload = {}) => {
  if (!payload.startTime || !payload.endTime) return

  if (new Date(payload.startTime) > new Date(payload.endTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['startTime must be before or equal to endTime'])
  }
}

const buildTimelineFilter = (query = {}) => {
  const filter = {}

  if (query.eventId) {
    ensureObjectId(query.eventId, 'event id')
    filter.eventId = query.eventId
  }

  if (query.eventType) filter.eventType = query.eventType
  if (query.status) filter.status = query.status

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [
      { title: pattern },
      { description: pattern }
    ]
  }

  return filter
}

const normalizeEvent = (event) => {
  if (!event) return null
  if (typeof event === 'string' || event instanceof mongoose.Types.ObjectId) return { id: event.toString() }

  return {
    id: event._id?.toString() || event.id,
    title: event.title,
    semester: event.semester,
    season: event.season,
    year: event.year,
    status: event.status
  }
}

const normalizeTimeline = (timeline) => {
  if (!timeline) return null

  const plainTimeline = typeof timeline.toObject === 'function'
    ? timeline.toObject({ getters: true, virtuals: false })
    : timeline

  return {
    id: plainTimeline._id?.toString() || plainTimeline.id,
    event: normalizeEvent(plainTimeline.eventId),
    eventId: plainTimeline.eventId?._id?.toString?.() || plainTimeline.eventId?.toString?.() || plainTimeline.eventId,
    title: plainTimeline.title,
    description: plainTimeline.description,
    startTime: plainTimeline.startTime,
    endTime: plainTimeline.endTime,
    eventType: plainTimeline.eventType,
    status: plainTimeline.status,
    createdAt: plainTimeline.createdAt,
    updatedAt: plainTimeline.updatedAt
  }
}

export const createTimelineService = ({
  repository = TIMELINE_REPOSITORY,
  eventService = EVENT_SERVICE
} = {}) => {
  const ensureTimelineExists = async (id) => {
    ensureObjectId(id)
    const timeline = await repository.findById(id)
    if (!timeline) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Timeline not found'])
    return timeline
  }

  const listTimelines = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = await applyEventVisibilityScope({
      filter: buildTimelineFilter(query),
      actor,
      repository
    })
    const skip = (page - 1) * limit

    const [timelines, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
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

  const getTimelineById = async (id, actor = {}) => {
    const timeline = await ensureTimelineExists(id)
    await ensureCanViewEventChild({
      resource: timeline,
      actor,
      repository,
      notFoundMessage: 'Timeline not found'
    })
    return normalizeTimeline(timeline)
  }

  const createTimeline = async (payload = {}) => {
    ensureDateRange(payload)
    await eventService.getRawEventById(payload.eventId)

    const timeline = await repository.create(pickSafeFields(payload, TIMELINE_FIELDS))
    return normalizeTimeline(await repository.findById(timeline._id))
  }

  const updateTimeline = async (id, payload = {}) => {
    const existingTimeline = await ensureTimelineExists(id)
    const safePayload = pickSafeFields(payload, TIMELINE_FIELDS)

    if (safePayload.eventId) {
      await eventService.getRawEventById(safePayload.eventId)
    }

    ensureDateRange({
      startTime: safePayload.startTime ?? existingTimeline.startTime,
      endTime: safePayload.endTime ?? existingTimeline.endTime
    })

    const timeline = await repository.updateById(id, safePayload)
    return normalizeTimeline(timeline)
  }

  const deleteTimeline = async (id) => {
    await ensureTimelineExists(id)
    await repository.deleteById(id)
  }

  return {
    listTimelines,
    getTimelineById,
    createTimeline,
    updateTimeline,
    deleteTimeline
  }
}

export const TIMELINE_SERVICE = {
  ...createTimelineService(),
  normalizeTimeline
}
