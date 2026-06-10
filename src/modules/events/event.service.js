import mongoose from 'mongoose'

import { EVENT_REPOSITORY } from './event.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'

const EVENT_STATUSES = ['DRAFT', 'OPEN_REGISTRATION', 'ONGOING', 'SCORING', 'COMPLETED', 'ARCHIVED']
const RANKING_SCOPES = ['TEAM', 'CHAPTER', 'INDIVIDUAL']
const FINALIST_SELECTION_MODES = ['FIXED_PER_BOARD', 'TOP_PER_BOARD_WITH_WILDCARD', 'OVERALL_SCORE', 'CUSTOM']
const EVENT_FIELDS = [
  'title',
  'description',
  'semester',
  'seriesName',
  'season',
  'year',
  'theme',
  'registrationStart',
  'registrationEnd',
  'startDate',
  'endDate',
  'maxTeams',
  'minTeamMembers',
  'maxTeamMembers',
  'competitionConfig',
  'finalistSlotsPerTrack',
  'totalFinalistSlots',
  'status'
]

const ensureObjectId = (id, fieldName = 'event id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureDateRange = (payload = {}) => {
  if (payload.startDate && payload.endDate) {
    const startDate = new Date(payload.startDate)
    const endDate = new Date(payload.endDate)

    if (startDate > endDate) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['startDate must be before or equal to endDate'])
    }
  }

  if (payload.registrationStart && payload.registrationEnd) {
    const registrationStart = new Date(payload.registrationStart)
    const registrationEnd = new Date(payload.registrationEnd)

    if (registrationStart > registrationEnd) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['registrationStart must be before or equal to registrationEnd'])
    }
  }
}

const ensureTeamRule = (payload = {}) => {
  if (!payload.minTeamMembers || !payload.maxTeamMembers) return

  if (payload.minTeamMembers > payload.maxTeamMembers) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['minTeamMembers must be less than or equal to maxTeamMembers'])
  }
}

const normalizeRankingScopes = (scopes = []) => {
  const normalizedScopes = Array.isArray(scopes)
    ? scopes
      .map(scope => String(scope).trim().toUpperCase())
      .filter(Boolean)
    : []

  const uniqueScopes = [...new Set(normalizedScopes)]
  const invalidScope = uniqueScopes.find(scope => !RANKING_SCOPES.includes(scope))
  if (invalidScope) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ranking scope: ${invalidScope}`])
  }

  return uniqueScopes.length > 0 ? uniqueScopes : ['TEAM']
}

const buildCompetitionConfig = (payload = {}, existingEvent = null) => {
  const existingConfig = existingEvent?.competitionConfig || {}
  const incomingConfig = payload.competitionConfig || {}

  const boardCount = incomingConfig.boardCount ?? incomingConfig.trackCount ?? existingConfig.boardCount ?? existingConfig.trackCount
  const trackCount = incomingConfig.trackCount ?? incomingConfig.boardCount ?? existingConfig.trackCount ?? existingConfig.boardCount
  const finalistsPerBoard = incomingConfig.finalistsPerBoard
    ?? payload.finalistSlotsPerTrack
    ?? existingConfig.finalistsPerBoard
    ?? existingEvent?.finalistSlotsPerTrack
  const finalistCount = incomingConfig.finalistCount
    ?? payload.totalFinalistSlots
    ?? existingConfig.finalistCount
    ?? existingEvent?.totalFinalistSlots

  const competitionConfig = {
    boardCount,
    trackCount,
    maxTeamsPerBoard: incomingConfig.maxTeamsPerBoard ?? existingConfig.maxTeamsPerBoard,
    finalistCount,
    finalistsPerBoard,
    finalistSelectionMode: incomingConfig.finalistSelectionMode ?? existingConfig.finalistSelectionMode ?? 'FIXED_PER_BOARD',
    fillRemainingFinalistsByOverallScore: incomingConfig.fillRemainingFinalistsByOverallScore ?? existingConfig.fillRemainingFinalistsByOverallScore ?? false,
    rankingScopes: normalizeRankingScopes(incomingConfig.rankingScopes ?? existingConfig.rankingScopes),
    tieBreakRule: incomingConfig.tieBreakRule ?? existingConfig.tieBreakRule,
    tieBreakDurationMinutes: incomingConfig.tieBreakDurationMinutes ?? existingConfig.tieBreakDurationMinutes
  }

  return Object.fromEntries(
    Object.entries(competitionConfig).filter(([, value]) => value !== undefined)
  )
}

const ensureCompetitionRule = (competitionConfig = {}) => {
  const {
    boardCount,
    trackCount,
    finalistCount,
    finalistsPerBoard,
    finalistSelectionMode,
    tieBreakDurationMinutes
  } = competitionConfig

  if (boardCount && trackCount && boardCount !== trackCount) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['competitionConfig.boardCount must match competitionConfig.trackCount when both are provided'])
  }

  if (finalistSelectionMode && !FINALIST_SELECTION_MODES.includes(finalistSelectionMode)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid competitionConfig.finalistSelectionMode'])
  }

  if (finalistsPerBoard && finalistCount && finalistsPerBoard > finalistCount) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['competitionConfig.finalistsPerBoard must be less than or equal to competitionConfig.finalistCount'])
  }

  if (finalistSelectionMode === 'FIXED_PER_BOARD' && boardCount && finalistsPerBoard && finalistCount &&
    (boardCount * finalistsPerBoard) !== finalistCount) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['competitionConfig.finalistCount must equal boardCount * finalistsPerBoard for FIXED_PER_BOARD mode'])
  }

  if (tieBreakDurationMinutes && !competitionConfig.tieBreakRule) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['competitionConfig.tieBreakRule is required when competitionConfig.tieBreakDurationMinutes is provided'])
  }
}

const syncLegacyEventFields = (safePayload = {}, competitionConfig = {}, existingEvent = null) => {
  const syncedPayload = { ...safePayload }

  if (competitionConfig.finalistsPerBoard !== undefined) {
    syncedPayload.finalistSlotsPerTrack = competitionConfig.finalistsPerBoard
  } else if (syncedPayload.finalistSlotsPerTrack === undefined && existingEvent?.finalistSlotsPerTrack !== undefined) {
    syncedPayload.finalistSlotsPerTrack = existingEvent.finalistSlotsPerTrack
  }

  if (competitionConfig.finalistCount !== undefined) {
    syncedPayload.totalFinalistSlots = competitionConfig.finalistCount
  } else if (syncedPayload.totalFinalistSlots === undefined && existingEvent?.totalFinalistSlots !== undefined) {
    syncedPayload.totalFinalistSlots = existingEvent.totalFinalistSlots
  }

  syncedPayload.competitionConfig = competitionConfig
  return syncedPayload
}

const buildEventFilter = (query = {}) => {
  const filter = {}

  if (query.status) {
    filter.status = query.status
  }

  if (query.semester) {
    filter.semester = query.semester
  }

  if (query.season) {
    filter.season = query.season
  }

  if (query.year) {
    filter.year = Number(query.year)
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
    seriesName: plainEvent.seriesName,
    season: plainEvent.season,
    year: plainEvent.year,
    theme: plainEvent.theme,
    registrationStart: plainEvent.registrationStart,
    registrationEnd: plainEvent.registrationEnd,
    startDate: plainEvent.startDate,
    endDate: plainEvent.endDate,
    maxTeams: plainEvent.maxTeams,
    minTeamMembers: plainEvent.minTeamMembers,
    maxTeamMembers: plainEvent.maxTeamMembers,
    competitionConfig: plainEvent.competitionConfig || null,
    finalistSlotsPerTrack: plainEvent.finalistSlotsPerTrack,
    totalFinalistSlots: plainEvent.totalFinalistSlots,
    status: plainEvent.status,
    createdBy: normalizeCreator(plainEvent.createdBy),
    createdAt: plainEvent.createdAt,
    updatedAt: plainEvent.updatedAt
  }
}

const createEventService = ({
  repository = EVENT_REPOSITORY,
  notificationService = NOTIFICATION_SERVICE
} = {}) => {
  const ensureEventExists = async (id) => {
    ensureObjectId(id)

    const event = await repository.findById(id)
    if (!event) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }

    return event
  }

  const listEvents = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildEventFilter(query)
    const skip = (page - 1) * limit

    const [events, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
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
    ensureTeamRule(payload)

    const safePayload = pickSafeFields(payload, EVENT_FIELDS)
    const competitionConfig = buildCompetitionConfig(payload)
    ensureCompetitionRule(competitionConfig)
    const normalizedPayload = syncLegacyEventFields(safePayload, competitionConfig)

    const event = await repository.create({
      ...normalizedPayload,
      createdBy: actor.id
    })

    return normalizeEvent(await repository.findById(event._id))
  }

  const updateEvent = async (id, payload = {}) => {
    const existingEvent = await ensureEventExists(id)
    const safePayload = pickSafeFields(payload, EVENT_FIELDS)
    const competitionConfig = buildCompetitionConfig(payload, existingEvent)

    ensureDateRange({
      registrationStart: safePayload.registrationStart ?? existingEvent.registrationStart,
      registrationEnd: safePayload.registrationEnd ?? existingEvent.registrationEnd,
      startDate: safePayload.startDate ?? existingEvent.startDate,
      endDate: safePayload.endDate ?? existingEvent.endDate
    })
    ensureTeamRule({
      minTeamMembers: safePayload.minTeamMembers ?? existingEvent.minTeamMembers,
      maxTeamMembers: safePayload.maxTeamMembers ?? existingEvent.maxTeamMembers
    })
    ensureCompetitionRule(competitionConfig)

    const normalizedPayload = syncLegacyEventFields(safePayload, competitionConfig, existingEvent)
    const event = await repository.updateById(id, normalizedPayload)
    return normalizeEvent(event)
  }

  const updateEventStatus = async (id, status) => {
    if (!EVENT_STATUSES.includes(status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid event status'])
    }

    ensureObjectId(id)
    const event = await repository.updateById(id, { status })
    if (!event) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }

    return normalizeEvent(event)
  }

  const deleteEvent = async (id) => {
    await ensureEventExists(id)
    await repository.deleteById(id)
  }

  const sendInvitations = async (id, payload = {}, actor = {}) => {
    const event = await ensureEventExists(id)

    return await notificationService.sendEventInvitations({
      event,
      emails: payload.emails || [],
      message: payload.message,
      actor
    })
  }

  return {
    listEvents,
    getEventById,
    getRawEventById,
    createEvent,
    updateEvent,
    updateEventStatus,
    deleteEvent,
    sendInvitations
  }
}

export const EVENT_SERVICE = {
  EVENT_STATUSES,
  ...createEventService(),
  normalizeEvent
}

export {
  buildCompetitionConfig,
  createEventService,
  ensureCompetitionRule,
  syncLegacyEventFields
}
