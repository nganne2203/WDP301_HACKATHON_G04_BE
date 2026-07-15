import mongoose from 'mongoose'

import { EVENT_REPOSITORY } from './event.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import { env } from '#configs/environment.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'
import { TEAM_REJECTION_REASONS, TEAM_SERVICE } from '#modules/teams/team.service.js'
import { AUDIT_LOG_REPOSITORY } from '#modules/audit-logs/audit-log.repository.js'
import Round from '#models/round.model.js'
import Submission from '#models/submission.model.js'
import JudgingBoard from '#models/judgingBoard.model.js'
import User from '#models/user.model.js'
import Team from '#models/team.model.js'
import Repository from '#models/repository.model.js'
import Ranking from '#models/ranking.model.js'
import Workshop from '#models/workshop.model.js'
import TimelineEvent from '#models/timelineEvent.model.js'
import Track from '#models/track.model.js'
import { isActiveJudge } from '#utils/domainAccessUtil.js'

const EVENT_STATUSES = ['DRAFT', 'OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'ONGOING', 'SCORING', 'COMPLETED', 'ARCHIVED']
const EVENT_TRANSITIONS = {
  DRAFT: ['OPEN_REGISTRATION'],
  OPEN_REGISTRATION: ['REGISTRATION_CLOSED'],
  REGISTRATION_CLOSED: ['ONGOING'],
  ONGOING: ['SCORING'],
  SCORING: ['COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: []
}
const RANKING_SCOPES = ['TEAM']
const UNSUPPORTED_RANKING_SCOPES = ['CHAPTER', 'INDIVIDUAL']
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
const DRAFT_VIEWER_ROLES = new Set(['ADMIN', 'EVENT_COORDINATOR', 'COORDINATOR'])

const canViewDraftEvents = (actor = {}) => {
  const roles = Array.isArray(actor.roles) ? actor.roles : [actor.role]
  return roles.some(role => DRAFT_VIEWER_ROLES.has(typeof role === 'string' ? role : role?.code))
}

const isParticipantOnly = (actor = {}) => {
  const roles = (Array.isArray(actor.roles) ? actor.roles : [actor.role])
    .map(role => (typeof role === 'string' ? role : role?.code || role?.name))
    .filter(Boolean)
    .map(role => String(role).toUpperCase())

  return roles.length > 0 && roles.every(role => role === 'PARTICIPANT' || role === 'USER')
}

const isRegistrationOpen = (event, now = new Date()) => {
  if (event?.status !== 'OPEN_REGISTRATION') return false
  if (event.registrationStart && now < new Date(event.registrationStart)) return false
  if (event.registrationEnd && now > new Date(event.registrationEnd)) return false
  return true
}

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

const ensureLifecycleDates = (payload = {}) => {
  const registrationStart = payload.registrationStart ? new Date(payload.registrationStart) : null
  const registrationEnd = payload.registrationEnd ? new Date(payload.registrationEnd) : null
  const startDate = payload.startDate ? new Date(payload.startDate) : null
  const endDate = payload.endDate ? new Date(payload.endDate) : null

  if (registrationStart && registrationEnd && registrationStart > registrationEnd) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['registrationStart must be before or equal to registrationEnd'])
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['startDate must be before or equal to endDate'])
  }
  if (registrationEnd && startDate && registrationEnd > startDate) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['registrationEnd must be before or equal to startDate'])
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
  const unsupportedScope = uniqueScopes.find(scope => UNSUPPORTED_RANKING_SCOPES.includes(scope))
  if (unsupportedScope) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Ranking scope ${unsupportedScope} is not supported for official generation yet`])
  }

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
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) {
      filter.$or = [
        { title: pattern },
        { description: pattern },
        { semester: pattern }
      ]
    }
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

const normalizeEvent = (event, stats = {}) => {
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
    registrationClosedAt: plainEvent.registrationClosedAt,
    registrationCloseReason: plainEvent.registrationCloseReason,
    startDate: plainEvent.startDate,
    endDate: plainEvent.endDate,
    maxTeams: plainEvent.maxTeams,
    minTeamMembers: plainEvent.minTeamMembers,
    maxTeamMembers: plainEvent.maxTeamMembers,
    competitionConfig: plainEvent.competitionConfig || null,
    finalistSlotsPerTrack: plainEvent.finalistSlotsPerTrack,
    totalFinalistSlots: plainEvent.totalFinalistSlots,
    roundCount: stats.roundCount ?? plainEvent.roundCount ?? 0,
    status: plainEvent.status,
    createdBy: normalizeCreator(plainEvent.createdBy),
    createdAt: plainEvent.createdAt,
    updatedAt: plainEvent.updatedAt
  }
}

const createEventService = ({
  repository = EVENT_REPOSITORY,
  notificationService = NOTIFICATION_SERVICE,
  teamService = TEAM_SERVICE,
  auditLogRepository = AUDIT_LOG_REPOSITORY,
  roundModel = Round,
  submissionModel = Submission,
  boardModel = JudgingBoard,
  teamModel = Team,
  repositoryModel = Repository,
  rankingModel = Ranking,
  workshopModel = Workshop,
  timelineModel = TimelineEvent,
  trackModel = Track,
  userModel = User,
  nowProvider = () => new Date()
} = {}) => {
  const ensureEventExists = async (id) => {
    ensureObjectId(id)

    const event = await repository.findById(id)
    if (!event) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }

    return event
  }

  const getEventId = (event) => event?._id?.toString?.() || event?.id?.toString?.()

  const buildRoundCountMap = async (events = []) => {
    const eventIds = events
      .map(event => event?._id || event?.id)
      .filter(Boolean)

    if (eventIds.length === 0 || !roundModel) return new Map()

    if (typeof roundModel.aggregate === 'function') {
      const counts = await roundModel.aggregate([
        { $match: { eventId: { $in: eventIds } } },
        { $group: { _id: '$eventId', count: { $sum: 1 } } }
      ])

      return new Map(counts.map(item => [item._id?.toString?.() || item._id?.toString(), item.count]))
    }

    if (typeof roundModel.countDocuments === 'function') {
      const counts = await Promise.all(eventIds.map(async (eventId) => [
        eventId?.toString?.() || String(eventId),
        await roundModel.countDocuments({ eventId })
      ]))

      return new Map(counts)
    }

    return new Map()
  }

  const normalizeEventWithRoundCount = async (event) => {
    const roundCountMap = await buildRoundCountMap([event])
    return normalizeEvent(event, { roundCount: roundCountMap.get(getEventId(event)) ?? 0 })
  }

  const listEvents = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildEventFilter(query)
    if (!canViewDraftEvents(actor)) {
      filter.status = query.status === 'DRAFT' ? { $in: [] } : { $ne: 'DRAFT' }
    }
    if (isParticipantOnly(actor)) {
      const [participantEventIds, openRegistrationEventIds] = await Promise.all([
        repository.findEventIdsForParticipant(actor.id),
        repository.findOpenRegistrationEventIds()
      ])
      filter._id = { $in: [...new Set([...participantEventIds, ...openRegistrationEventIds].map(id => id.toString()))] }
    }
    const skip = (page - 1) * limit

    const [events, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
    ])

    const roundCountMap = await buildRoundCountMap(events)

    return {
      events: events.map(event => normalizeEvent(event, { roundCount: roundCountMap.get(getEventId(event)) ?? 0 })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getEventById = async (id, actor = {}) => {
    const event = await ensureEventExists(id)
    if (event.status === 'DRAFT' && !canViewDraftEvents(actor)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }
    if (isParticipantOnly(actor)) {
      const participantEventIds = await repository.findEventIdsForParticipant(actor.id)
      const isParticipant = participantEventIds.some(eventId => eventId.toString() === event._id.toString())
      if (!isParticipant && !isRegistrationOpen(event)) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }
    return await normalizeEventWithRoundCount(event)
  }

  const getRawEventById = async (id) => {
    return await ensureEventExists(id)
  }

  const ensureValidEventTransition = (event, nextStatus) => {
    if (event.status === nextStatus) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Event is already ${nextStatus}`])
    }

    const allowedStatuses = EVENT_TRANSITIONS[event.status] || []
    if (!allowedStatuses.includes(nextStatus)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid event status transition from ${event.status} to ${nextStatus}`])
    }
  }

  const ensureManualTransitionWindow = (event, nextStatus) => {
    const now = nowProvider()

    if (nextStatus === 'OPEN_REGISTRATION') {
      if (event.registrationStart && now < new Date(event.registrationStart)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Registration cannot be opened before registrationStart'])
      }
      if (event.registrationEnd && now > new Date(event.registrationEnd)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Registration cannot be opened after registrationEnd'])
      }
    }

    if (nextStatus === 'ONGOING' && event.startDate && now < new Date(event.startDate)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Event cannot start before startDate'])
    }
  }

  const findActiveJudges = async (judgeIds = []) => {
    const normalizedJudgeIds = [...new Set((judgeIds || []).map(judge => judge?._id?.toString?.() || judge?.toString?.()).filter(Boolean))]
    if (normalizedJudgeIds.length === 0) return []

    const query = userModel.find({ _id: { $in: normalizedJudgeIds } })
    const users = query && typeof query.populate === 'function'
      ? await query.populate({ path: 'roles', select: 'name code' })
      : await query

    if (users.length !== normalizedJudgeIds.length || users.some(user => !isActiveJudge(user))) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['All scoring board judges must have ACTIVE accounts and the JUDGE role'])
    }

    return users
  }

  const countDocuments = async (model, filter) => {
    if (!model?.countDocuments) return 0
    return await model.countDocuments(filter)
  }

  const ensureEventCanBeDeleted = async (event) => {
    if (event.status !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only unused DRAFT events can be deleted; archive the event through the lifecycle workflow instead'])
    }

    const eventId = event._id || event.id
    const dependencyChecks = [
      ['rounds', countDocuments(roundModel, { eventId })],
      ['judging boards', countDocuments(boardModel, { eventId })],
      ['tracks', countDocuments(trackModel, { eventId })],
      ['timelines', countDocuments(timelineModel, { eventId })],
      ['workshops', countDocuments(workshopModel, { eventId })],
      ['teams', countDocuments(teamModel, { eventId })],
      ['submissions', countDocuments(submissionModel, { eventId })],
      ['rankings', countDocuments(rankingModel, { eventId })],
      ['repositories', countDocuments(repositoryModel, { eventId })]
    ]

    const counts = await Promise.all(dependencyChecks.map(async ([name, promise]) => [name, await promise]))
    const blockingDependencies = counts.filter(([, count]) => count > 0).map(([name]) => name)
    if (blockingDependencies.length > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Cannot delete event with existing ${blockingDependencies.join(', ')}`])
    }
  }

  const findScoringBoards = async ({ eventId, roundId }) => {
    if (boardModel.find) {
      return await boardModel.find({
        eventId,
        roundId,
        status: 'SCORING',
        judgeIds: { $exists: true, $ne: [] },
        teamIds: { $exists: true, $ne: [] }
      })
    }

    const board = await boardModel.findOne({
      eventId,
      roundId,
      status: 'SCORING',
      judgeIds: { $exists: true, $ne: [] },
      teamIds: { $exists: true, $ne: [] }
    })
    return board ? [board] : []
  }

  const ensureScoringReady = async (eventId) => {
    const scoringRound = await roundModel.findOne({
      eventId,
      status: 'SCORING',
      rubricId: { $exists: true, $ne: null }
    })

    if (!scoringRound) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['At least one round with an active rubric must be in SCORING before the event can enter SCORING'])
    }

    const [scoringBoards, scorableSubmission] = await Promise.all([
      findScoringBoards({ eventId, roundId: scoringRound._id }),
      submissionModel.findOne({
        eventId,
        roundId: scoringRound._id,
        status: { $in: ['SUBMITTED', 'ACCEPTED'] }
      })
    ])

    if (scoringBoards.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['At least one judging board must be in SCORING before the event can enter SCORING'])
    }
    if (!scorableSubmission) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['At least one submitted or accepted submission is required before the event can enter SCORING'])
    }

    for (const board of scoringBoards) {
      await findActiveJudges(board.judgeIds || [])
    }
  }

  const createEventStatusAudit = async ({ actor, event, fromStatus, toStatus }) => {
    if (!auditLogRepository?.create) return

    await auditLogRepository.create({
      userId: actor?.id,
      action: 'EVENT_STATUS_CHANGED',
      resourceType: 'Event',
      resourceId: event._id || event.id,
      metadata: {
        fromStatus,
        toStatus,
        manual: true
      }
    })
  }

  const createEvent = async (payload = {}, actor = {}) => {
    ensureDateRange(payload)
    ensureLifecycleDates(payload)
    ensureTeamRule(payload)

    const safePayload = pickSafeFields(payload, EVENT_FIELDS)
    if (safePayload.status && safePayload.status !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Events must be created in DRAFT status and moved through the lifecycle workflow'])
    }
    const competitionConfig = buildCompetitionConfig(payload)
    ensureCompetitionRule(competitionConfig)
    const normalizedPayload = syncLegacyEventFields(safePayload, competitionConfig)

    const event = await repository.create({
      ...normalizedPayload,
      status: 'DRAFT',
      ...(normalizedPayload.status === 'OPEN_REGISTRATION'
        ? {
          registrationClosedAt: null,
          registrationCloseReason: null
        }
        : {}),
      createdBy: actor.id
    })

    return await normalizeEventWithRoundCount(await repository.findById(event._id))
  }

  const updateEvent = async (id, payload = {}) => {
    const existingEvent = await ensureEventExists(id)
    const safePayload = pickSafeFields(payload, EVENT_FIELDS)
    if (safePayload.status && safePayload.status !== existingEvent.status) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Use the event status workflow endpoint to change event status'])
    }
    delete safePayload.status

    const competitionConfig = buildCompetitionConfig(payload, existingEvent)

    ensureDateRange({
      registrationStart: safePayload.registrationStart ?? existingEvent.registrationStart,
      registrationEnd: safePayload.registrationEnd ?? existingEvent.registrationEnd,
      startDate: safePayload.startDate ?? existingEvent.startDate,
      endDate: safePayload.endDate ?? existingEvent.endDate
    })
    ensureLifecycleDates({
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

    return await normalizeEventWithRoundCount(event)
  }

  const updateEventStatus = async (id, status, actor = {}) => {
    if (!EVENT_STATUSES.includes(status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid event status'])
    }

    ensureObjectId(id)
    const existingEvent = await ensureEventExists(id)
    if (!env.workflow.relaxedDemoRules) {
      ensureValidEventTransition(existingEvent, status)
      ensureManualTransitionWindow(existingEvent, status)
    }
    if (status === 'SCORING' && !env.workflow.relaxedDemoRules) {
      await ensureScoringReady(id)
    }

    const updatePayload = { status }
    if (status === 'OPEN_REGISTRATION') {
      updatePayload.registrationClosedAt = null
      updatePayload.registrationCloseReason = null
    } else if (status === 'REGISTRATION_CLOSED') {
      updatePayload.registrationClosedAt = new Date()
      updatePayload.registrationCloseReason = 'MANUALLY_CLOSED'
    }

    const event = await repository.updateById(id, updatePayload)
    if (!event) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }

    if (status === 'REGISTRATION_CLOSED' && existingEvent.status !== 'REGISTRATION_CLOSED') {
      await teamService.rejectUnconfirmedTeamsForRegistrationClosure({
        event,
        reason: TEAM_REJECTION_REASONS.REGISTRATION_CLOSED
      })
    }

    await createEventStatusAudit({
      actor,
      event,
      fromStatus: existingEvent.status,
      toStatus: status
    })

    return await normalizeEventWithRoundCount(event)
  }

  const deleteEvent = async (id) => {
    const event = await ensureEventExists(id)
    await ensureEventCanBeDeleted(event)
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
  EVENT_TRANSITIONS,
  ...createEventService(),
  normalizeEvent
}

export {
  buildCompetitionConfig,
  createEventService,
  ensureCompetitionRule,
  syncLegacyEventFields
}
