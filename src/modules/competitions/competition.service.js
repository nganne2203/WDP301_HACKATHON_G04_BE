import mongoose from 'mongoose'

import { COMPETITION_REPOSITORY } from './competition.repository.js'
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
import TimelineActivity from '#models/timelineActivity.model.js'
import Track from '#models/track.model.js'
import { isActiveJudge } from '#utils/domainAccessUtil.js'
import { isWithinCompetitionDateWindow } from '#utils/competitionDateWindow.js'

const COMPETITION_STATUSES = ['DRAFT', 'OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'ONGOING', 'SCORING', 'COMPLETED', 'ARCHIVED']
const ACTIVE_COMPETITION_STATUSES = ['OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'ONGOING', 'SCORING']
const COMPETITION_TRANSITIONS = {
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
const COMPETITION_FIELDS = [
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
const DRAFT_VIEWER_ROLES = new Set(['ADMIN', 'COMPETITION_COORDINATOR', 'COORDINATOR'])

const canViewDraftCompetitions = (actor = {}) => {
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

const isRegistrationOpen = (competition, now = new Date()) => {
  if (competition?.status !== 'OPEN_REGISTRATION') return false
  if (competition.registrationStart && now < new Date(competition.registrationStart)) return false
  if (competition.registrationEnd && now > new Date(competition.registrationEnd)) return false
  return true
}

const ensureObjectId = (id, fieldName = 'competition id') => {
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

const buildCompetitionConfig = (payload = {}, existingCompetition = null) => {
  const existingConfig = existingCompetition?.competitionConfig || {}
  const incomingConfig = payload.competitionConfig || {}

  const boardCount = incomingConfig.boardCount ?? incomingConfig.trackCount ?? existingConfig.boardCount ?? existingConfig.trackCount
  const trackCount = incomingConfig.trackCount ?? incomingConfig.boardCount ?? existingConfig.trackCount ?? existingConfig.boardCount
  const finalistsPerBoard = incomingConfig.finalistsPerBoard
    ?? payload.finalistSlotsPerTrack
    ?? existingConfig.finalistsPerBoard
    ?? existingCompetition?.finalistSlotsPerTrack
  const suppliedFinalistCount = incomingConfig.finalistCount
    ?? payload.totalFinalistSlots
    ?? existingConfig.finalistCount
    ?? existingCompetition?.totalFinalistSlots
  // The total is derived so the stored rule cannot disagree with its board quotas.
  const finalistCount = boardCount && finalistsPerBoard
    ? Number(boardCount) * Number(finalistsPerBoard)
    : suppliedFinalistCount

  const competitionConfig = {
    boardCount,
    trackCount,
    maxTeamsPerBoard: incomingConfig.maxTeamsPerBoard ?? existingConfig.maxTeamsPerBoard,
    finalistCount,
    finalistsPerBoard,
    finalistSelectionMode: incomingConfig.finalistSelectionMode ?? existingConfig.finalistSelectionMode ?? 'FIXED_PER_BOARD',
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

  if (competitionConfig.maxTeamsPerBoard && finalistsPerBoard && finalistsPerBoard > competitionConfig.maxTeamsPerBoard) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['competitionConfig.finalistsPerBoard cannot exceed competitionConfig.maxTeamsPerBoard'])
  }

  if (tieBreakDurationMinutes && !competitionConfig.tieBreakRule) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['competitionConfig.tieBreakRule is required when competitionConfig.tieBreakDurationMinutes is provided'])
  }
}

const syncLegacyCompetitionFields = (safePayload = {}, competitionConfig = {}, existingCompetition = null) => {
  const syncedPayload = { ...safePayload }

  // Board configuration is the source of truth for registration capacity.
  // Keeping maxTeams in sync preserves compatibility with existing APIs while
  // preventing a competition from accepting more teams than its boards hold.
  const boardCount = Number(competitionConfig.boardCount)
  const maxTeamsPerBoard = Number(competitionConfig.maxTeamsPerBoard)
  if (boardCount > 0 && maxTeamsPerBoard > 0) {
    syncedPayload.maxTeams = boardCount * maxTeamsPerBoard
  }

  if (competitionConfig.finalistsPerBoard !== undefined) {
    syncedPayload.finalistSlotsPerTrack = competitionConfig.finalistsPerBoard
  } else if (syncedPayload.finalistSlotsPerTrack === undefined && existingCompetition?.finalistSlotsPerTrack !== undefined) {
    syncedPayload.finalistSlotsPerTrack = existingCompetition.finalistSlotsPerTrack
  }

  if (competitionConfig.finalistCount !== undefined) {
    syncedPayload.totalFinalistSlots = competitionConfig.finalistCount
  } else if (syncedPayload.totalFinalistSlots === undefined && existingCompetition?.totalFinalistSlots !== undefined) {
    syncedPayload.totalFinalistSlots = existingCompetition.totalFinalistSlots
  }

  syncedPayload.competitionConfig = competitionConfig
  return syncedPayload
}

const buildCompetitionFilter = (query = {}) => {
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

const normalizeCompetition = (competition, stats = {}) => {
  if (!competition) return null

  const plainCompetition = typeof competition.toObject === 'function'
    ? competition.toObject({ getters: true, virtuals: false })
    : competition

  return {
    id: plainCompetition._id?.toString() || plainCompetition.id,
    title: plainCompetition.title,
    description: plainCompetition.description,
    semester: plainCompetition.semester,
    seriesName: plainCompetition.seriesName,
    season: plainCompetition.season,
    year: plainCompetition.year,
    theme: plainCompetition.theme,
    registrationStart: plainCompetition.registrationStart,
    registrationEnd: plainCompetition.registrationEnd,
    registrationClosedAt: plainCompetition.registrationClosedAt,
    registrationCloseReason: plainCompetition.registrationCloseReason,
    startDate: plainCompetition.startDate,
    endDate: plainCompetition.endDate,
    maxTeams: plainCompetition.maxTeams,
    minTeamMembers: plainCompetition.minTeamMembers,
    maxTeamMembers: plainCompetition.maxTeamMembers,
    competitionConfig: plainCompetition.competitionConfig || null,
    finalistSlotsPerTrack: plainCompetition.finalistSlotsPerTrack,
    totalFinalistSlots: plainCompetition.totalFinalistSlots,
    roundCount: stats.roundCount ?? plainCompetition.roundCount ?? 0,
    status: plainCompetition.status,
    createdBy: normalizeCreator(plainCompetition.createdBy),
    createdAt: plainCompetition.createdAt,
    updatedAt: plainCompetition.updatedAt
  }
}

const createCompetitionService = ({
  repository = COMPETITION_REPOSITORY,
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
  timelineModel = TimelineActivity,
  trackModel = Track,
  userModel = User,
  nowProvider = () => new Date()
} = {}) => {
  const ensureCompetitionExists = async (id) => {
    ensureObjectId(id)

    const competition = await repository.findById(id)
    if (!competition) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
    }

    return competition
  }

  const getCompetitionId = (competition) => competition?._id?.toString?.() || competition?.id?.toString?.()

  const ensureCompetitionWindowContainsScheduledItems = async ({ competitionId, competition }) => {
    const schedules = [
      {
        label: 'Round',
        model: roundModel,
        fields: ['startTime', 'endTime', 'submissionOpenAt', 'submissionCloseAt', 'submissionDeadline', 'publishTime']
      },
      {
        label: 'Timeline activity',
        model: timelineModel,
        fields: ['startTime', 'endTime']
      },
      {
        label: 'Workshop',
        model: workshopModel,
        fields: ['startTime', 'endTime']
      }
    ]

    for (const { label, model, fields } of schedules) {
      if (typeof model?.find !== 'function') continue
      const items = await model.find({ competitionId }).select(fields.join(' ')).lean()
      for (const item of items) {
        for (const field of fields) {
          if (!item[field]) continue
          if (!isWithinCompetitionDateWindow({ competition, value: item[field] })) {
            throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Competition date window cannot exclude an existing ${label.toLowerCase()} ${field}`])
          }
        }
      }
    }
  }

  const buildRoundCountMap = async (competitions = []) => {
    const competitionIds = competitions
      .map(competition => competition?._id || competition?.id)
      .filter(Boolean)

    if (competitionIds.length === 0 || !roundModel) return new Map()

    if (typeof roundModel.aggregate === 'function') {
      const counts = await roundModel.aggregate([
        { $match: { competitionId: { $in: competitionIds } } },
        { $group: { _id: '$competitionId', count: { $sum: 1 } } }
      ])

      return new Map(counts.map(item => [item._id?.toString?.() || item._id?.toString(), item.count]))
    }

    if (typeof roundModel.countDocuments === 'function') {
      const counts = await Promise.all(competitionIds.map(async (competitionId) => [
        competitionId?.toString?.() || String(competitionId),
        await roundModel.countDocuments({ competitionId })
      ]))

      return new Map(counts)
    }

    return new Map()
  }

  const normalizeCompetitionWithRoundCount = async (competition) => {
    const roundCountMap = await buildRoundCountMap([competition])
    return normalizeCompetition(competition, { roundCount: roundCountMap.get(getCompetitionId(competition)) ?? 0 })
  }

  const listCompetitions = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildCompetitionFilter(query)
    if (!canViewDraftCompetitions(actor)) {
      filter.status = query.status === 'DRAFT' ? { $in: [] } : { $ne: 'DRAFT' }
    }
    if (isParticipantOnly(actor)) {
      const [participantCompetitionIds, openRegistrationCompetitionIds] = await Promise.all([
        repository.findCompetitionIdsForParticipant(actor.id),
        repository.findOpenRegistrationCompetitionIds()
      ])
      filter._id = { $in: [...new Set([...participantCompetitionIds, ...openRegistrationCompetitionIds].map(id => id.toString()))] }
    }
    const skip = (page - 1) * limit

    const [competitions, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
    ])

    const roundCountMap = await buildRoundCountMap(competitions)

    return {
      competitions: competitions.map(competition => normalizeCompetition(competition, { roundCount: roundCountMap.get(getCompetitionId(competition)) ?? 0 })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getCompetitionById = async (id, actor = {}) => {
    const competition = await ensureCompetitionExists(id)
    if (competition.status === 'DRAFT' && !canViewDraftCompetitions(actor)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
    }
    if (isParticipantOnly(actor)) {
      const participantCompetitionIds = await repository.findCompetitionIdsForParticipant(actor.id)
      const isParticipant = participantCompetitionIds.some(competitionId => competitionId.toString() === competition._id.toString())
      if (!isParticipant && !isRegistrationOpen(competition)) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
    }
    return await normalizeCompetitionWithRoundCount(competition)
  }

  const getRawCompetitionById = async (id) => {
    return await ensureCompetitionExists(id)
  }

  const ensureValidCompetitionTransition = (competition, nextStatus) => {
    if (competition.status === nextStatus) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Competition is already ${nextStatus}`])
    }

    const allowedStatuses = COMPETITION_TRANSITIONS[competition.status] || []
    if (!allowedStatuses.includes(nextStatus)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid competition status transition from ${competition.status} to ${nextStatus}`])
    }
  }

  const ensureManualTransitionWindow = (competition, nextStatus) => {
    const now = nowProvider()

    if (nextStatus === 'OPEN_REGISTRATION') {
      if (competition.registrationStart && now < new Date(competition.registrationStart)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Registration cannot be opened before registrationStart'])
      }
      if (competition.registrationEnd && now > new Date(competition.registrationEnd)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Registration cannot be opened after registrationEnd'])
      }
    }

    if (nextStatus === 'ONGOING' && competition.startDate && now < new Date(competition.startDate)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Competition cannot start before startDate'])
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

  const ensureCompetitionCanBeDeleted = async (competition) => {
    if (competition.status !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only unused DRAFT competitions can be deleted; archive the competition through the lifecycle workflow instead'])
    }

    const competitionId = competition._id || competition.id
    const dependencyChecks = [
      ['rounds', countDocuments(roundModel, { competitionId })],
      ['judging boards', countDocuments(boardModel, { competitionId })],
      ['tracks', countDocuments(trackModel, { competitionId })],
      ['timelines', countDocuments(timelineModel, { competitionId })],
      ['workshops', countDocuments(workshopModel, { competitionId })],
      ['teams', countDocuments(teamModel, { competitionId })],
      ['submissions', countDocuments(submissionModel, { competitionId })],
      ['rankings', countDocuments(rankingModel, { competitionId })],
      ['repositories', countDocuments(repositoryModel, { competitionId })]
    ]

    const counts = await Promise.all(dependencyChecks.map(async ([name, promise]) => [name, await promise]))
    const blockingDependencies = counts.filter(([, count]) => count > 0).map(([name]) => name)
    if (blockingDependencies.length > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Cannot delete competition with existing ${blockingDependencies.join(', ')}`])
    }
  }

  const findScoringBoards = async ({ competitionId, roundId }) => {
    if (boardModel.find) {
      return await boardModel.find({
        competitionId,
        roundId,
        status: 'SCORING',
        judgeIds: { $exists: true, $ne: [] },
        teamIds: { $exists: true, $ne: [] }
      })
    }

    const board = await boardModel.findOne({
      competitionId,
      roundId,
      status: 'SCORING',
      judgeIds: { $exists: true, $ne: [] },
      teamIds: { $exists: true, $ne: [] }
    })
    return board ? [board] : []
  }

  const ensureScoringReady = async (competitionId) => {
    const scoringRound = await roundModel.findOne({
      competitionId,
      status: 'SCORING',
      rubricId: { $exists: true, $ne: null }
    })

    if (!scoringRound) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['At least one round with an active rubric must be in SCORING before the competition can enter SCORING'])
    }

    const [scoringBoards, scorableSubmission] = await Promise.all([
      findScoringBoards({ competitionId, roundId: scoringRound._id }),
      submissionModel.findOne({
        competitionId,
        roundId: scoringRound._id,
        status: { $in: ['SUBMITTED', 'ACCEPTED'] }
      })
    ])

    if (scoringBoards.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['At least one judging board must be in SCORING before the competition can enter SCORING'])
    }
    if (!scorableSubmission) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['At least one submitted or accepted submission is required before the competition can enter SCORING'])
    }

    for (const board of scoringBoards) {
      await findActiveJudges(board.judgeIds || [])
    }
  }

  const createCompetitionStatusAudit = async ({ actor, competition, fromStatus, toStatus }) => {
    if (!auditLogRepository?.create) return

    await auditLogRepository.create({
      userId: actor?.id,
      action: 'COMPETITION_STATUS_CHANGED',
      resourceType: 'Competition',
      resourceId: competition._id || competition.id,
      metadata: {
        fromStatus,
        toStatus,
        manual: true
      }
    })
  }

  const createCompetition = async (payload = {}, actor = {}) => {
    ensureDateRange(payload)
    ensureLifecycleDates(payload)
    ensureTeamRule(payload)

    const safePayload = pickSafeFields(payload, COMPETITION_FIELDS)
    if (safePayload.status && safePayload.status !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Competitions must be created in DRAFT status and moved through the lifecycle workflow'])
    }
    const competitionConfig = buildCompetitionConfig(payload)
    ensureCompetitionRule(competitionConfig)
    const normalizedPayload = syncLegacyCompetitionFields(safePayload, competitionConfig)

    const competition = await repository.create({
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

    return await normalizeCompetitionWithRoundCount(await repository.findById(competition._id))
  }

  const updateCompetition = async (id, payload = {}) => {
    const existingCompetition = await ensureCompetitionExists(id)
    const safePayload = pickSafeFields(payload, COMPETITION_FIELDS)
    if (safePayload.status && safePayload.status !== existingCompetition.status) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Use the competition status workflow endpoint to change competition status'])
    }
    delete safePayload.status

    const competitionConfig = buildCompetitionConfig(payload, existingCompetition)

    ensureDateRange({
      registrationStart: safePayload.registrationStart ?? existingCompetition.registrationStart,
      registrationEnd: safePayload.registrationEnd ?? existingCompetition.registrationEnd,
      startDate: safePayload.startDate ?? existingCompetition.startDate,
      endDate: safePayload.endDate ?? existingCompetition.endDate
    })
    ensureLifecycleDates({
      registrationStart: safePayload.registrationStart ?? existingCompetition.registrationStart,
      registrationEnd: safePayload.registrationEnd ?? existingCompetition.registrationEnd,
      startDate: safePayload.startDate ?? existingCompetition.startDate,
      endDate: safePayload.endDate ?? existingCompetition.endDate
    })
    ensureTeamRule({
      minTeamMembers: safePayload.minTeamMembers ?? existingCompetition.minTeamMembers,
      maxTeamMembers: safePayload.maxTeamMembers ?? existingCompetition.maxTeamMembers
    })
    ensureCompetitionRule(competitionConfig)

    if (safePayload.startDate !== undefined || safePayload.endDate !== undefined) {
      await ensureCompetitionWindowContainsScheduledItems({
        competitionId: getCompetitionId(existingCompetition),
        competition: {
          startDate: safePayload.startDate ?? existingCompetition.startDate,
          endDate: safePayload.endDate ?? existingCompetition.endDate
        }
      })
    }

    const normalizedPayload = syncLegacyCompetitionFields(safePayload, competitionConfig, existingCompetition)
    const competition = await repository.updateById(id, normalizedPayload)

    return await normalizeCompetitionWithRoundCount(competition)
  }

  const updateCompetitionStatus = async (id, status, actor = {}) => {
    if (!COMPETITION_STATUSES.includes(status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid competition status'])
    }

    ensureObjectId(id)
    const existingCompetition = await ensureCompetitionExists(id)
    if (!env.workflow.relaxedDemoRules) {
      ensureValidCompetitionTransition(existingCompetition, status)
      ensureManualTransitionWindow(existingCompetition, status)
    }
    if (status === 'SCORING' && !env.workflow.relaxedDemoRules) {
      await ensureScoringReady(id)
    }

    if (ACTIVE_COMPETITION_STATUSES.includes(status)) {
      const competitions = await repository.findAll({
        filter: { status: { $in: ACTIVE_COMPETITION_STATUSES } },
        limit: 1000
      })
      const activeCompetition = competitions.find(competition => {
        const competitionId = competition?._id?.toString?.() || competition?.id?.toString?.()
        return competitionId !== id && ACTIVE_COMPETITION_STATUSES.includes(competition.status)
      })
      if (activeCompetition) {
        throw new ApiError(ERROR_CODES.CONFLICT, [`${activeCompetition.title || 'Another competition'} is already active. Complete or archive it before activating another competition.`])
      }
    }

    const updatePayload = { status }
    if (status === 'OPEN_REGISTRATION') {
      updatePayload.registrationClosedAt = null
      updatePayload.registrationCloseReason = null
    } else if (status === 'REGISTRATION_CLOSED') {
      updatePayload.registrationClosedAt = new Date()
      updatePayload.registrationCloseReason = 'MANUALLY_CLOSED'
    }

    const competition = await repository.updateById(id, updatePayload)
    if (!competition) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
    }

    if (status === 'REGISTRATION_CLOSED' && existingCompetition.status !== 'REGISTRATION_CLOSED') {
      await teamService.rejectUnconfirmedTeamsForRegistrationClosure({
        competition,
        reason: TEAM_REJECTION_REASONS.REGISTRATION_CLOSED
      })
    }

    await createCompetitionStatusAudit({
      actor,
      competition,
      fromStatus: existingCompetition.status,
      toStatus: status
    })

    return await normalizeCompetitionWithRoundCount(competition)
  }

  const deleteCompetition = async (id) => {
    const competition = await ensureCompetitionExists(id)
    await ensureCompetitionCanBeDeleted(competition)
    await repository.deleteById(id)
  }

  const sendInvitations = async (id, payload = {}, actor = {}) => {
    const competition = await ensureCompetitionExists(id)

    return await notificationService.sendCompetitionInvitations({
      competition,
      emails: payload.emails || [],
      message: payload.message,
      actor
    })
  }

  return {
    listCompetitions,
    getCompetitionById,
    getRawCompetitionById,
    createCompetition,
    updateCompetition,
    updateCompetitionStatus,
    deleteCompetition,
    sendInvitations
  }
}

export const COMPETITION_SERVICE = {
  COMPETITION_STATUSES,
  COMPETITION_TRANSITIONS,
  ...createCompetitionService(),
  normalizeCompetition
}

export {
  buildCompetitionConfig,
  createCompetitionService,
  ensureCompetitionRule,
  syncLegacyCompetitionFields
}
