import mongoose from 'mongoose'

import { ROUND_REPOSITORY } from './round.repository.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import Competition from '#models/competition.model.js'
import Rubric from '#models/rubric.model.js'
import Team from '#models/team.model.js'
import Track from '#models/track.model.js'
import User from '#models/user.model.js'
import Submission from '#models/submission.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'
import { isWithinCompetitionDateWindow } from '#utils/competitionDateWindow.js'
import Ranking from '#models/ranking.model.js'
import { JUDGING_BOARD_REPOSITORY } from '#modules/judging-boards/judging-board.repository.js'
import { actorHasRole, getActorId, isActiveJudge, isParticipantOnlyActor, isPrivilegedCompetitionActor } from '#utils/domainAccessUtil.js'
import { ensureCompetitionAllowsChildMutations } from '#utils/competitionLifecycleUtil.js'

const ROUND_FIELDS = [
  'competitionId',
  'trackId',
  'name',
  'roundType',
  'problemStatement',
  'examDriveUrl',
  'assignedTeamIds',
  'promotedTeamIds',
  'maxPromotedTeams',
  'startTime',
  'endTime',
  'submissionOpenAt',
  'submissionCloseAt',
  'submissionDeadline',
  'publishTime',
  'assignedJudgeIds',
  'rubricId',
  'promotionRule',
  'tieBreakRule',
  'tieBreakDurationMinutes',
  'status'
]

const ROUND_ASSIGNABLE_TEAM_STATUSES = ['CONFIRMED']

const ensureObjectId = (id, fieldName = 'round id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureDateOrder = (payload = {}) => {
  const submissionOpenAt = payload.submissionOpenAt || payload.startTime
  const submissionCloseAt = payload.submissionCloseAt || payload.submissionDeadline

  if (payload.startTime && payload.endTime && new Date(payload.startTime) > new Date(payload.endTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['startTime must be before or equal to endTime'])
  }

  if (payload.startTime && payload.submissionDeadline && new Date(payload.startTime) > new Date(payload.submissionDeadline)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['submissionDeadline must be after or equal to startTime'])
  }

  if (payload.submissionDeadline && payload.endTime && new Date(payload.submissionDeadline) > new Date(payload.endTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['submissionDeadline must be before or equal to endTime'])
  }

  if (submissionOpenAt && submissionCloseAt && new Date(submissionOpenAt) > new Date(submissionCloseAt)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['submissionOpenAt must be before or equal to submissionCloseAt'])
  }

  if (payload.startTime && payload.submissionOpenAt && new Date(payload.submissionOpenAt) < new Date(payload.startTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['submissionOpenAt must be after or equal to startTime'])
  }

  if (payload.submissionCloseAt && payload.endTime && new Date(payload.submissionCloseAt) > new Date(payload.endTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['submissionCloseAt must be before or equal to endTime'])
  }

  if (payload.publishTime && payload.endTime && new Date(payload.publishTime) < new Date(payload.endTime)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['publishTime must be after or equal to endTime'])
  }
}

const ensureRoundWindowWithinCompetition = (competition, payload = {}) => {
  const fields = [
    ['startTime', 'Round start time'],
    ['endTime', 'Round end time'],
    ['submissionOpenAt', 'Round submission open time'],
    ['submissionCloseAt', 'Round submission close time'],
    ['submissionDeadline', 'Round submission deadline'],
    ['publishTime', 'Round publish time']
  ]

  for (const [field, label] of fields) {
    if (!payload[field]) continue
    if (!isWithinCompetitionDateWindow({ competition, value: payload[field] })) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`${label} must be within the competition date range`])
    }
  }
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

const normalizeTrack = (track) => {
  if (!track) return null
  if (typeof track === 'string' || track instanceof mongoose.Types.ObjectId) return { id: track.toString() }
  return {
    id: track._id?.toString() || track.id,
    code: track.code,
    name: track.name,
    type: track.type,
    maxTeams: track.maxTeams,
    status: track.status
  }
}

const normalizeTeam = (team) => {
  if (!team) return null
  if (typeof team === 'string' || team instanceof mongoose.Types.ObjectId) return { id: team.toString() }
  return {
    id: team._id?.toString() || team.id,
    name: team.name,
    chapterName: team.chapterName,
    projectName: team.projectName,
    status: team.status,
    trackId: team.trackId?._id?.toString?.() || team.trackId?.toString?.() || team.trackId,
    boardNumber: team.boardNumber,
    placementSlot: team.placementSlot
  }
}

const normalizeJudge = (judge) => {
  if (!judge) return null
  if (typeof judge === 'string' || judge instanceof mongoose.Types.ObjectId) return { id: judge.toString() }
  return {
    id: judge._id?.toString() || judge.id,
    fullName: judge.fullName,
    email: judge.email,
    githubUsername: judge.githubUsername,
    status: judge.status
  }
}

const normalizeRubric = (rubric) => {
  if (!rubric) return null
  if (typeof rubric === 'string' || rubric instanceof mongoose.Types.ObjectId) return { id: rubric.toString() }
  return {
    id: rubric._id?.toString() || rubric.id,
    title: rubric.title,
    description: rubric.description,
    totalScore: rubric.totalScore,
    criterionMaxScore: rubric.criterionMaxScore
  }
}

const normalizeRound = (round) => {
  if (!round) return null
  const plainRound = typeof round.toObject === 'function'
    ? round.toObject({ getters: true, virtuals: false })
    : round

  return {
    id: plainRound._id?.toString() || plainRound.id,
    competition: normalizeCompetition(plainRound.competitionId),
    competitionId: plainRound.competitionId?._id?.toString?.() || plainRound.competitionId?.toString?.() || plainRound.competitionId,
    track: normalizeTrack(plainRound.trackId),
    trackId: plainRound.trackId?._id?.toString?.() || plainRound.trackId?.toString?.() || plainRound.trackId || null,
    name: plainRound.name,
    roundType: plainRound.roundType,
    problemStatement: plainRound.problemStatement || null,
    examDriveUrl: plainRound.examDriveUrl || null,
    assignedTeams: (plainRound.assignedTeamIds || []).map(normalizeTeam),
    assignedTeamIds: (plainRound.assignedTeamIds || []).map(team => team._id?.toString?.() || team.toString?.() || team),
    promotedTeams: (plainRound.promotedTeamIds || []).map(normalizeTeam),
    promotedTeamIds: (plainRound.promotedTeamIds || []).map(team => team._id?.toString?.() || team.toString?.() || team),
    maxPromotedTeams: plainRound.maxPromotedTeams,
    startTime: plainRound.startTime,
    endTime: plainRound.endTime,
    submissionOpenAt: plainRound.submissionOpenAt,
    submissionCloseAt: plainRound.submissionCloseAt,
    submissionDeadline: plainRound.submissionDeadline,
    publishTime: plainRound.publishTime,
    assignedJudges: (plainRound.assignedJudgeIds || []).map(normalizeJudge),
    assignedJudgeIds: (plainRound.assignedJudgeIds || []).map(judge => judge._id?.toString?.() || judge.toString?.() || judge),
    rubric: normalizeRubric(plainRound.rubricId),
    rubricId: plainRound.rubricId?._id?.toString?.() || plainRound.rubricId?.toString?.() || plainRound.rubricId || null,
    promotionRule: plainRound.promotionRule,
    tieBreakRule: plainRound.tieBreakRule,
    tieBreakDurationMinutes: plainRound.tieBreakDurationMinutes,
    status: plainRound.status,
    createdAt: plainRound.createdAt,
    updatedAt: plainRound.updatedAt
  }
}

const buildRoundFilter = (query = {}) => {
  const filter = {}
  if (query.competitionId) {
    ensureObjectId(query.competitionId, 'competition id')
    filter.competitionId = query.competitionId
  }
  if (query.trackId) {
    ensureObjectId(query.trackId, 'track id')
    filter.trackId = query.trackId
  }
  if (query.roundType) filter.roundType = query.roundType
  if (query.status) filter.status = query.status
  if (query.search) {
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) filter.$or = [{ name: pattern }, { promotionRule: pattern }, { tieBreakRule: pattern }]
  }
  return filter
}

const ensureCompetitionExists = async (competitionId) => {
  ensureObjectId(competitionId, 'competition id')
  const competition = await Competition.findById(competitionId)
  if (!competition) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
  return competition
}

const ensureTrackBelongsToCompetition = async ({ competitionId, trackId }) => {
  if (!trackId) return null
  ensureObjectId(trackId, 'track id')
  const track = await Track.findById(trackId)
  if (!track) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Track not found'])
  if (track.competitionId?.toString() !== competitionId.toString()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Track does not belong to the specified competition'])
  }
  return track
}

const ensureRubricBelongsToCompetition = async ({ competitionId, rubricId }) => {
  if (!rubricId) return null
  ensureObjectId(rubricId, 'rubric id')
  const rubric = await Rubric.findById(rubricId)
  if (!rubric) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Rubric not found'])
  if (rubric.competitionId && rubric.competitionId.toString() !== competitionId.toString()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rubric does not belong to the specified competition'])
  }
  return rubric
}

const ensureUsersExist = async (userIds = []) => {
  for (const userId of userIds) {
    ensureObjectId(userId, 'judge id')
  }
  const query = User.find({ _id: { $in: userIds } })
  const users = query && typeof query.populate === 'function'
    ? await query.populate({ path: 'roles', select: 'name code' })
    : await query
  if (users.length !== userIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more judges do not exist'])
  }
  for (const user of users) {
    if (!isActiveJudge(user)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Assigned judges must have ACTIVE accounts and the JUDGE role'])
    }
  }
}

const ensureTeamsBelongToRoundContext = async ({ competitionId, trackId, teamIds = [] }) => {
  for (const teamId of teamIds) {
    ensureObjectId(teamId, 'team id')
  }

  const teams = await Team.find({ _id: { $in: teamIds } })
  if (teams.length !== teamIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more teams do not exist'])
  }

  for (const team of teams) {
    if (team.competitionId?.toString() !== competitionId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Assigned teams must belong to the specified competition'])
    }
    if (trackId && team.trackId?.toString() !== trackId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Assigned teams must belong to the selected track'])
    }
    if (!ROUND_ASSIGNABLE_TEAM_STATUSES.includes(team.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only confirmed teams can be assigned to rounds'])
    }
  }
}

const ensurePromotionRuleConsistency = ({ promotedTeamIds = [], maxPromotedTeams = null }) => {
  if (maxPromotedTeams && promotedTeamIds.length > maxPromotedTeams) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['promotedTeamIds cannot exceed maxPromotedTeams'])
  }
}

const extractIds = (values = []) => values.map(value => value?._id?.toString?.() || value?.toString?.() || value).filter(Boolean)

const countDocuments = async (model, filter) => {
  if (!model?.countDocuments) return 0
  return await model.countDocuments(filter)
}

const syncSingleJudgingBoardForRound = async (round) => {
  if (!round) return

  const roundId = round._id?.toString?.() || round.id?.toString?.() || round._id || round.id
  const competitionId = round.competitionId?._id?.toString?.() || round.competitionId?.toString?.() || round.competitionId
  const trackId = round.trackId?._id?.toString?.() || round.trackId?.toString?.() || round.trackId || null
  const teamIds = extractIds(round.assignedTeamIds || [])
  const judgeIds = extractIds(round.assignedJudgeIds || [])

  const existingBoards = await JUDGING_BOARD_REPOSITORY.findByRoundId(roundId)
  if (existingBoards.length > 1) return

  const boardPayload = {
    competitionId,
    roundId,
    trackId,
    name: existingBoards[0]?.name || `${round.name} Board`,
    boardNumber: existingBoards[0]?.boardNumber || 1,
    teamIds,
    judgeIds,
    maxTeams: Math.max(teamIds.length, existingBoards[0]?.maxTeams || 10),
    status: teamIds.length > 0 ? 'ASSIGNED' : 'DRAFT'
  }

  if (existingBoards.length === 0) {
    await JUDGING_BOARD_REPOSITORY.create(boardPayload)
    return
  }

  await JUDGING_BOARD_REPOSITORY.updateById(existingBoards[0].id || existingBoards[0]._id, boardPayload)
}

export const createRoundService = ({
  repository = ROUND_REPOSITORY,
  notificationService = NOTIFICATION_SERVICE
} = {}) => {
  const notifyAssignedJudges = async (round, previousJudgeIds = []) => {
    const previousIds = new Set(previousJudgeIds.map(id => id?.toString?.() || String(id)))
    const roundId = round?._id?.toString?.() || round?.id
    const competitionId = round?.competitionId?._id?.toString?.() || round?.competitionId?.id || round?.competitionId?.toString?.()
    const addedJudges = (round?.assignedJudgeIds || []).filter(judge => {
      const judgeId = judge?._id?.toString?.() || judge?.id || judge?.toString?.()
      return judgeId && !previousIds.has(judgeId)
    })

    await Promise.all(addedJudges.map(judge => notificationService.notifyUser({
      user: judge,
      title: 'Round assignment',
      message: `You were assigned as a judge for ${round.name || 'a competition round'}.`,
      type: 'SYSTEM',
      dedupeKey: `judge-round-assigned:${roundId}:${judge?._id?.toString?.() || judge?.id}`,
      metadata: { action: 'JUDGE_ROUND_ASSIGNED', competitionId, roundId, targetPath: '/judge' },
      channels: ['IN_APP']
    })))
  }
  const ensureRoundExists = async (id) => {
    ensureObjectId(id)
    const round = await repository.findById(id)
    if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
    return round
  }

  const ensureUniqueRoundName = async ({ competitionId, name, ignoreRoundId }) => {
    if (!competitionId || !name || !repository.findByCompetitionAndName) return

    const existingRound = await repository.findByCompetitionAndName(competitionId, name.trim())
    const existingRoundId = existingRound?._id?.toString?.() || existingRound?.id?.toString?.()
    if (existingRound && existingRoundId !== ignoreRoundId) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Round name already exists in this competition'])
    }
  }

  const applyParticipantRoundScope = async (filter = {}, actor = {}) => {
    if (!isParticipantOnlyActor(actor)) return filter

    const actorId = getActorId(actor)
    if (!actorId) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated participant is required'])
    }

    const teamFilter = {
      status: 'CONFIRMED',
      $or: [{ leaderId: actorId }, { memberIds: actorId }]
    }
    if (filter.competitionId) teamFilter.competitionId = filter.competitionId

    const teams = await Team.find(teamFilter).select('_id')
    const teamIds = teams.map(team => team._id)
    return { ...filter, assignedTeamIds: { $in: teamIds } }
  }

  const applyJudgeRoundScope = async (filter = {}, actor = {}) => {
    if (!actorHasRole(actor, 'JUDGE') || isPrivilegedCompetitionActor(actor)) return filter

    const actorId = getActorId(actor)
    if (!actorId) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated judge is required'])
    }

    const boardFilter = { judgeIds: actorId }
    if (filter.competitionId) boardFilter.competitionId = filter.competitionId
    const boards = await JUDGING_BOARD_REPOSITORY.findAll({ filter: boardFilter, limit: 100 })
    const roundIds = [...new Set(boards.map(board => board.roundId?._id?.toString?.() || board.roundId?.id || board.roundId?.toString?.()).filter(Boolean))]

    return { ...filter, _id: { $in: roundIds } }
  }

  const ensureParticipantCanReadRound = async (round, actor = {}) => {
    if (!isParticipantOnlyActor(actor)) return

    const actorId = getActorId(actor)
    if (!actorId) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated participant is required'])
    }

    const assignedTeamIds = (round.assignedTeamIds || []).map(team => team._id || team.id || team)
    const team = await Team.findOne({
      _id: { $in: assignedTeamIds },
      status: 'CONFIRMED',
      $or: [{ leaderId: actorId }, { memberIds: actorId }]
    }).select('_id')

    if (!team) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You are not assigned to this round'])
    }
  }

  const ensureJudgeCanReadRound = async (round, actor = {}) => {
    if (!actorHasRole(actor, 'JUDGE') || isPrivilegedCompetitionActor(actor)) return

    const actorId = getActorId(actor)
    if (!actorId) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated judge is required'])
    }

    const board = (await JUDGING_BOARD_REPOSITORY.findAll({
      filter: { judgeIds: actorId, roundId: round._id || round.id },
      limit: 1
    }))[0]

    if (!board) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You are not assigned to this judging board'])
    }
  }

  const listRounds = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const participantScopedFilter = await applyParticipantRoundScope(buildRoundFilter(query), actor)
    const filter = await applyJudgeRoundScope(participantScopedFilter, actor)
    const skip = (page - 1) * limit

    const [rounds, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
    ])

    return {
      rounds: rounds.map(normalizeRound),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getRoundById = async (id, actor = {}) => {
    const round = await ensureRoundExists(id)
    await ensureParticipantCanReadRound(round, actor)
    await ensureJudgeCanReadRound(round, actor)
    return normalizeRound(round)
  }

  const ensureRoundCanBeDeleted = async (round) => {
    if (round.status !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only unused DRAFT rounds can be deleted'])
    }

    const roundId = round._id || round.id
    const [boardCount, submissionCount, scoreSheetCount, rankingCount] = await Promise.all([
      JUDGING_BOARD_REPOSITORY.count({ roundId }),
      countDocuments(Submission, { roundId }),
      countDocuments(ScoreSheet, { roundId }),
      countDocuments(Ranking, { roundId })
    ])

    if (boardCount || submissionCount || scoreSheetCount || rankingCount) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cannot delete round after boards, submissions, score sheets, or rankings have been created'])
    }
  }

  const createRound = async (payload = {}) => {
    ensureDateOrder(payload)
    const competition = await ensureCompetitionExists(payload.competitionId)
    ensureCompetitionAllowsChildMutations(competition, 'Round')
    ensureRoundWindowWithinCompetition(competition, payload)
    await ensureUniqueRoundName({ competitionId: competition._id, name: payload.name })
    await ensureTrackBelongsToCompetition({ competitionId: competition._id, trackId: payload.trackId })
    await ensureRubricBelongsToCompetition({ competitionId: competition._id, rubricId: payload.rubricId })
    await ensureUsersExist(payload.assignedJudgeIds || [])
    await ensureTeamsBelongToRoundContext({
      competitionId: competition._id,
      trackId: payload.trackId,
      teamIds: payload.assignedTeamIds ?? payload.promotedTeamIds ?? []
    })
    ensurePromotionRuleConsistency(payload)

    let round
    try {
      round = await repository.create(pickSafeFields(payload, ROUND_FIELDS))
    } catch (error) {
      if (error?.code === 11000 && error?.keyPattern?.name) {
        throw new ApiError(ERROR_CODES.CONFLICT, ['Round name already exists in this competition'])
      }
      throw error
    }
    const hydratedRound = await repository.findById(round._id)
    await notifyAssignedJudges(hydratedRound)
    await syncSingleJudgingBoardForRound(hydratedRound)
    return normalizeRound(await repository.findById(round._id))
  }

  const updateRound = async (id, payload = {}) => {
    const existingRound = await ensureRoundExists(id)
    const safePayload = pickSafeFields(payload, ROUND_FIELDS)
    const competitionId = safePayload.competitionId || existingRound.competitionId?._id || existingRound.competitionId
    const trackId = safePayload.trackId !== undefined ? safePayload.trackId : (existingRound.trackId?._id || existingRound.trackId)
    const mergedPayload = {
      startTime: safePayload.startTime ?? existingRound.startTime,
      endTime: safePayload.endTime ?? existingRound.endTime,
      submissionOpenAt: safePayload.submissionOpenAt ?? existingRound.submissionOpenAt,
      submissionCloseAt: safePayload.submissionCloseAt ?? existingRound.submissionCloseAt,
      submissionDeadline: safePayload.submissionDeadline ?? existingRound.submissionDeadline,
      publishTime: safePayload.publishTime ?? existingRound.publishTime
    }

    ensureDateOrder(mergedPayload)
    const competition = await ensureCompetitionExists(competitionId)
    ensureCompetitionAllowsChildMutations(competition, 'Round')
    ensureRoundWindowWithinCompetition(competition, mergedPayload)
    await ensureUniqueRoundName({
      competitionId,
      name: safePayload.name || existingRound.name,
      ignoreRoundId: id
    })
    await ensureTrackBelongsToCompetition({ competitionId, trackId })
    await ensureRubricBelongsToCompetition({
      competitionId,
      rubricId: safePayload.rubricId !== undefined ? safePayload.rubricId : (existingRound.rubricId?._id || existingRound.rubricId)
    })

    if (safePayload.assignedJudgeIds) await ensureUsersExist(safePayload.assignedJudgeIds)
    const teamIdsToValidate = safePayload.assignedTeamIds ?? safePayload.promotedTeamIds
    if (teamIdsToValidate) {
      await ensureTeamsBelongToRoundContext({ competitionId, trackId, teamIds: teamIdsToValidate })
    }

    ensurePromotionRuleConsistency({
      promotedTeamIds: safePayload.promotedTeamIds || existingRound.promotedTeamIds || [],
      maxPromotedTeams: safePayload.maxPromotedTeams ?? existingRound.maxPromotedTeams
    })

    const previousJudgeIds = (existingRound.assignedJudgeIds || [])
      .map(judge => judge?._id?.toString?.() || judge?.id || judge?.toString?.())
      .filter(Boolean)
    let round
    try {
      round = await repository.updateById(id, safePayload)
    } catch (error) {
      if (error?.code === 11000 && error?.keyPattern?.name) {
        throw new ApiError(ERROR_CODES.CONFLICT, ['Round name already exists in this competition'])
      }
      throw error
    }
    if (safePayload.assignedJudgeIds !== undefined) await notifyAssignedJudges(round, previousJudgeIds)
    await syncSingleJudgingBoardForRound(round)
    return normalizeRound(await repository.findById(id))
  }

  const deleteRound = async (id) => {
    const round = await ensureRoundExists(id)
    const competitionId = round.competitionId?._id || round.competitionId
    ensureCompetitionAllowsChildMutations(await ensureCompetitionExists(competitionId), 'Round')
    await ensureRoundCanBeDeleted(round)
    await repository.deleteById(id)
  }

  return {
    listRounds,
    getRoundById,
    createRound,
    updateRound,
    deleteRound
  }
}

export const ROUND_SERVICE = {
  ...createRoundService(),
  normalizeRound
}
