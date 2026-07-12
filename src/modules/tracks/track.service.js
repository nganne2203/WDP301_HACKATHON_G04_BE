import mongoose from 'mongoose'

import { TRACK_REPOSITORY } from './track.repository.js'
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

const TRACK_FIELDS = ['eventId', 'code', 'name', 'description', 'topic', 'problemStatement', 'type', 'teamIds', 'maxTeams', 'status']

const ensureObjectId = (id, fieldName = 'track id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const buildTrackFilter = (query = {}) => {
  const filter = {}

  if (query.eventId) {
    ensureObjectId(query.eventId, 'event id')
    filter.eventId = query.eventId
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [
      { code: pattern },
      { name: pattern },
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
    status: event.status
  }
}

const getEventIdValue = (event) => {
  if (!event) return event
  if (typeof event === 'string' || event instanceof mongoose.Types.ObjectId) return event
  return event._id || event.id
}

const normalizeTrack = (track) => {
  if (!track) return null

  const plainTrack = typeof track.toObject === 'function'
    ? track.toObject({ getters: true, virtuals: false })
    : track

  return {
    id: plainTrack._id?.toString() || plainTrack.id,
    event: normalizeEvent(plainTrack.eventId),
    code: plainTrack.code,
    name: plainTrack.name,
    description: plainTrack.description,
    topic: plainTrack.topic,
    problemStatement: plainTrack.problemStatement,
    type: plainTrack.type,
    teamIds: plainTrack.teamIds?.map((teamId) => teamId.toString?.() || teamId) || [],
    maxTeams: plainTrack.maxTeams,
    status: plainTrack.status,
    createdAt: plainTrack.createdAt,
    updatedAt: plainTrack.updatedAt
  }
}

export const createTrackService = ({
  repository = TRACK_REPOSITORY,
  eventService = EVENT_SERVICE
} = {}) => {
  const ensureTrackExistsWithRepository = async (id) => {
    ensureObjectId(id)

    const track = await repository.findById(id)
    if (!track) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Track not found'])
    }

    return track
  }

  const ensureUniqueTrackNameWithRepository = async ({ eventId, name, ignoreTrackId }) => {
    if (!eventId || !name) return

    const existingTrack = await repository.findByEventAndName(eventId, name)
    if (existingTrack && existingTrack._id.toString() !== ignoreTrackId) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Track name already exists in this event'])
    }
  }

  const listTracks = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = await applyEventVisibilityScope({
      filter: buildTrackFilter(query),
      actor,
      repository
    })
    const skip = (page - 1) * limit

    const [tracks, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
    ])

    return {
      tracks: tracks.map(normalizeTrack),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getTrackById = async (id, actor = {}) => {
    const track = await ensureTrackExistsWithRepository(id)
    await ensureCanViewEventChild({
      resource: track,
      actor,
      repository,
      notFoundMessage: 'Track not found'
    })
    return normalizeTrack(track)
  }

  const createTrack = async (payload = {}) => {
    await eventService.getRawEventById(payload.eventId)
    await ensureUniqueTrackNameWithRepository(payload)

    const track = await repository.create(pickSafeFields(payload, TRACK_FIELDS))
    return normalizeTrack(await repository.findById(track._id))
  }

  const updateTrack = async (id, payload = {}) => {
    const existingTrack = await ensureTrackExistsWithRepository(id)
    const safePayload = pickSafeFields(payload, TRACK_FIELDS)

    if (safePayload.eventId) {
      await eventService.getRawEventById(safePayload.eventId)
    }

    await ensureUniqueTrackNameWithRepository({
      eventId: safePayload.eventId || getEventIdValue(existingTrack.eventId),
      name: safePayload.name || existingTrack.name,
      ignoreTrackId: id
    })

    const track = await repository.updateById(id, safePayload)
    return normalizeTrack(track)
  }

  const deleteTrack = async (id) => {
    await ensureTrackExistsWithRepository(id)
    await repository.deleteById(id)
  }

  return {
    listTracks,
    getTrackById,
    createTrack,
    updateTrack,
    deleteTrack
  }
}

export const TRACK_SERVICE = {
  ...createTrackService(),
  normalizeTrack
}
