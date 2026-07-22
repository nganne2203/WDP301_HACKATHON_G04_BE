import mongoose from 'mongoose'

import { TIMELINE_REPOSITORY } from './timeline.repository.js'
import { COMPETITION_SERVICE } from '#modules/competitions/competition.service.js'
import ApiError from '#utils/ApiError.js'
import { isWithinCompetitionDateWindow } from '#utils/competitionDateWindow.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import Workshop from '#models/workshop.model.js'
import {
  applyCompetitionVisibilityScope,
  ensureCanViewCompetitionChild
} from '#utils/competitionVisibilityUtil.js'

const TIMELINE_FIELDS = ['competitionId', 'title', 'description', 'startTime', 'endTime', 'activityType', 'status']
const TIMELINE_STATUS_TRANSITIONS = {
  SCHEDULED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
}

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

const ensureTimelineWithinCompetitionWindow = ({ competition, startTime, endTime }) => {
  if (!competition || !startTime || !endTime) return
  if (!isWithinCompetitionDateWindow({ competition, value: startTime })) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Timeline startTime must be within the competition date window'])
  }
  if (!isWithinCompetitionDateWindow({ competition, value: endTime })) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Timeline endTime must be within the competition date window'])
  }
}

const ensureTimelineStatusTransition = ({ fromStatus, toStatus, isCreate = false }) => {
  if (!toStatus || fromStatus === toStatus) return
  if (isCreate) {
    if (toStatus !== 'SCHEDULED') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Timeline competitions must be created in SCHEDULED status'])
    }
    return
  }

  const allowedStatuses = TIMELINE_STATUS_TRANSITIONS[fromStatus] || []
  if (!allowedStatuses.includes(toStatus)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid timeline status transition from ${fromStatus} to ${toStatus}`])
  }
}

const buildTimelineFilter = (query = {}) => {
  const filter = {}

  if (query.competitionId) {
    ensureObjectId(query.competitionId, 'competition id')
    filter.competitionId = query.competitionId
  }

  if (query.activityType) filter.activityType = query.activityType
  if (query.status) filter.status = query.status

  if (query.search) {
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) {
      filter.$or = [
        { title: pattern },
        { description: pattern }
      ]
    }
  }

  return filter
}

const normalizeCompetition = (competition) => {
  if (!competition) return null
  if (typeof competition === 'string' || competition instanceof mongoose.Types.ObjectId) return { id: competition.toString() }

  return {
    id: competition._id?.toString() || competition.id,
    title: competition.title,
    semester: competition.semester,
    season: competition.season,
    year: competition.year,
    status: competition.status
  }
}

const countDocuments = async (model, filter) => {
  if (!model?.countDocuments) return 0
  return await model.countDocuments(filter)
}

const normalizeTimeline = (timeline) => {
  if (!timeline) return null

  const plainTimeline = typeof timeline.toObject === 'function'
    ? timeline.toObject({ getters: true, virtuals: false })
    : timeline

  return {
    id: plainTimeline._id?.toString() || plainTimeline.id,
    competition: normalizeCompetition(plainTimeline.competitionId),
    competitionId: plainTimeline.competitionId?._id?.toString?.() || plainTimeline.competitionId?.toString?.() || plainTimeline.competitionId,
    title: plainTimeline.title,
    description: plainTimeline.description,
    startTime: plainTimeline.startTime,
    endTime: plainTimeline.endTime,
    activityType: plainTimeline.activityType,
    status: plainTimeline.status,
    createdAt: plainTimeline.createdAt,
    updatedAt: plainTimeline.updatedAt
  }
}

export const createTimelineService = ({
  repository = TIMELINE_REPOSITORY,
  competitionService = COMPETITION_SERVICE
} = {}) => {
  const ensureTimelineExists = async (id) => {
    ensureObjectId(id)
    const timeline = await repository.findById(id)
    if (!timeline) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Timeline not found'])
    return timeline
  }

  const listTimelines = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = await applyCompetitionVisibilityScope({
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
    await ensureCanViewCompetitionChild({
      resource: timeline,
      actor,
      repository,
      notFoundMessage: 'Timeline not found'
    })
    return normalizeTimeline(timeline)
  }

  const ensureTimelineCanBeDeleted = async (timeline) => {
    if (timeline.status !== 'SCHEDULED') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only SCHEDULED timeline competitions can be deleted'])
    }

    const linkedWorkshopCount = await countDocuments(Workshop, { timelineActivityId: timeline._id || timeline.id })
    if (linkedWorkshopCount > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cannot delete timeline competition while workshops are linked to it'])
    }
  }

  const createTimeline = async (payload = {}) => {
    ensureDateRange(payload)
    const competition = await competitionService.getRawCompetitionById(payload.competitionId)
    ensureTimelineWithinCompetitionWindow({
      competition,
      startTime: payload.startTime,
      endTime: payload.endTime
    })
    ensureTimelineStatusTransition({
      toStatus: payload.status || 'SCHEDULED',
      isCreate: true
    })

    const timeline = await repository.create(pickSafeFields(payload, TIMELINE_FIELDS))
    return normalizeTimeline(await repository.findById(timeline._id))
  }

  const updateTimeline = async (id, payload = {}) => {
    const existingTimeline = await ensureTimelineExists(id)
    const safePayload = pickSafeFields(payload, TIMELINE_FIELDS)

    if (safePayload.competitionId) {
      await competitionService.getRawCompetitionById(safePayload.competitionId)
    }
    const competitionId = safePayload.competitionId || existingTimeline.competitionId?._id?.toString?.() || existingTimeline.competitionId?.toString?.()
    const competition = await competitionService.getRawCompetitionById(competitionId)

    const nextSchedule = {
      startTime: safePayload.startTime ?? existingTimeline.startTime,
      endTime: safePayload.endTime ?? existingTimeline.endTime
    }
    ensureDateRange(nextSchedule)
    ensureTimelineWithinCompetitionWindow({ competition, ...nextSchedule })
    ensureTimelineStatusTransition({
      fromStatus: existingTimeline.status || 'SCHEDULED',
      toStatus: safePayload.status
    })

    const timeline = await repository.updateById(id, safePayload)
    return normalizeTimeline(timeline)
  }

  const deleteTimeline = async (id) => {
    const timeline = await ensureTimelineExists(id)
    await ensureTimelineCanBeDeleted(timeline)
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
