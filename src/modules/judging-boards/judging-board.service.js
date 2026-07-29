import mongoose from 'mongoose'

import { JUDGING_BOARD_REPOSITORY } from './judging-board.repository.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import Competition from '#models/competition.model.js'
import Round from '#models/round.model.js'
import Team from '#models/team.model.js'
import Track from '#models/track.model.js'
import User from '#models/user.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'
import Ranking from '#models/ranking.model.js'
import { actorHasRole, getActorId, isActiveJudge, isPrivilegedCompetitionActor } from '#utils/domainAccessUtil.js'
import { env } from '#configs/environment.js'

const BOARD_FIELDS = [
  'competitionId',
  'roundId',
  'trackId',
  'name',
  'boardNumber',
  'teamIds',
  'judgeIds',
  'maxTeams',
  'status'
]

const BOARD_LOCKED_COMPETITION_STATUSES = new Set(['COMPLETED', 'ARCHIVED'])

const ensureObjectId = (id, fieldName = 'judging board id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
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

const normalizeRound = (round) => {
  if (!round) return null
  if (typeof round === 'string' || round instanceof mongoose.Types.ObjectId) return { id: round.toString() }
  return {
    id: round._id?.toString() || round.id,
    name: round.name,
    roundType: round.roundType,
    status: round.status,
    trackId: round.trackId?._id?.toString?.() || round.trackId?.toString?.() || round.trackId
  }
}

const normalizeBoard = (board) => {
  if (!board) return null
  const plainBoard = typeof board.toObject === 'function'
    ? board.toObject({ getters: true, virtuals: false })
    : board

  const configuredCapacity = Number(plainBoard.competitionId?.competitionConfig?.maxTeamsPerBoard || 0)
  const effectiveMaxTeams = Math.max(
    (plainBoard.teamIds || []).length,
    configuredCapacity || plainBoard.maxTeams || 1
  )

  return {
    id: plainBoard._id?.toString() || plainBoard.id,
    competition: normalizeCompetition(plainBoard.competitionId),
    competitionId: plainBoard.competitionId?._id?.toString?.() || plainBoard.competitionId?.toString?.() || plainBoard.competitionId,
    round: normalizeRound(plainBoard.roundId),
    roundId: plainBoard.roundId?._id?.toString?.() || plainBoard.roundId?.toString?.() || plainBoard.roundId,
    track: normalizeTrack(plainBoard.trackId),
    trackId: plainBoard.trackId?._id?.toString?.() || plainBoard.trackId?.toString?.() || plainBoard.trackId || null,
    name: plainBoard.name,
    boardNumber: plainBoard.boardNumber,
    teams: (plainBoard.teamIds || []).map(normalizeTeam),
    teamIds: (plainBoard.teamIds || []).map(team => team._id?.toString?.() || team.toString?.() || team),
    judges: (plainBoard.judgeIds || []).map(normalizeJudge),
    judgeIds: (plainBoard.judgeIds || []).map(judge => judge._id?.toString?.() || judge.toString?.() || judge),
    // The competition configuration is the source of truth.  This also makes
    // boards created before the configuration was saved stop displaying the
    // schema's legacy default (10) after the next read.
    maxTeams: effectiveMaxTeams,
    status: plainBoard.status,
    createdAt: plainBoard.createdAt,
    updatedAt: plainBoard.updatedAt
  }
}

const buildBoardFilter = (query = {}) => {
  const filter = {}
  if (query.competitionId) {
    ensureObjectId(query.competitionId, 'competition id')
    filter.competitionId = query.competitionId
  }
  if (query.roundId) {
    ensureObjectId(query.roundId, 'round id')
    filter.roundId = query.roundId
  }
  if (query.trackId) {
    ensureObjectId(query.trackId, 'track id')
    filter.trackId = query.trackId
  }
  if (query.status) filter.status = query.status
  if (query.search) {
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) filter.$or = [{ name: pattern }]
  }
  return filter
}

const ensureCompetitionExists = async (competitionId) => {
  ensureObjectId(competitionId, 'competition id')
  const competition = await Competition.findById(competitionId)
  if (!competition) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
  return competition
}

const ensureCompetitionAllowsBoardChanges = (competition) => {
  if (BOARD_LOCKED_COMPETITION_STATUSES.has(String(competition?.status || '').toUpperCase())) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Judging board assignments cannot be changed after the competition has been completed or archived'])
  }
}

const ensureRoundBelongsToCompetition = async ({ competitionId, roundId }) => {
  ensureObjectId(roundId, 'round id')
  const round = await Round.findById(roundId)
  if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
  if (round.competitionId?.toString() !== competitionId.toString()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified competition'])
  }
  return round
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

const ensureTeamsBelongToBoardContext = async ({ competitionId, trackId, teamIds = [] }) => {
  for (const teamId of teamIds) ensureObjectId(teamId, 'team id')
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
  }
}

const ensureUsersExist = async (userIds = []) => {
  for (const userId of userIds) ensureObjectId(userId, 'judge id')
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

const ensureBoardCapacity = ({ teamIds = [], maxTeams }) => {
  if (maxTeams && teamIds.length > maxTeams) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['teamIds cannot exceed maxTeams'])
  }
}

const countDocuments = async (model, filter) => {
  if (!model?.countDocuments) return 0
  return await model.countDocuments(filter)
}

const ELIGIBLE_TEAM_STATUSES = new Set(['CONFIRMED'])

const buildBoardLabel = (boardNumber) => {
  let value = Number(boardNumber || 0)
  if (value <= 0) return String(boardNumber || '')

  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

const shuffleItems = (items, randomFn = Math.random) => {
  const copied = [...items]
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1))
    ;[copied[index], copied[swapIndex]] = [copied[swapIndex], copied[index]]
  }
  return copied
}

const distributeTeamsAcrossBoards = ({ teams = [], boardCount }) => {
  const boards = Array.from({ length: boardCount }, () => [])
  // Keep the split balanced and predictable. Any remainder is assigned to
  // the first boards, so 25 teams across 3 boards becomes 9 / 8 / 8.
  const baseSize = Math.floor(teams.length / boardCount)
  const remainder = teams.length % boardCount
  const extraBoards = new Set(Array.from({ length: remainder }, (_, index) => index))
  let offset = 0
  boards.forEach((board, index) => {
    const size = baseSize + (extraBoards.has(index) ? 1 : 0)
    board.push(...teams.slice(offset, offset + size))
    offset += size
  })
  return boards
}

export const createJudgingBoardService = ({
  repository = JUDGING_BOARD_REPOSITORY,
  notificationService = NOTIFICATION_SERVICE,
  randomFn = Math.random,
  relaxedWorkflow = false
} = {}) => {
  const notifyAssignedJudges = async ({ board, previousJudgeIds = [] }) => {
    const previousIds = new Set(previousJudgeIds.map(id => id?.toString?.() || String(id)))
    const boardId = board?._id?.toString?.() || board?.id
    const competitionId = board?.competitionId?._id?.toString?.() || board?.competitionId?.id || board?.competitionId?.toString?.()
    const eventTitle = board?.competitionId?.title || 'SEAL Hackathon'
    const roundName = board?.roundId?.name

    const addedJudges = (board?.judgeIds || []).filter(judge => {
      const judgeId = judge?._id?.toString?.() || judge?.id || judge?.toString?.()
      return judgeId && !previousIds.has(judgeId)
    })

    await Promise.all(addedJudges.map(judge => notificationService.notifyUser({
      user: judge,
      title: 'Judging board assignment',
      message: `You were assigned to ${board.name || `Board ${board.boardNumber}`} for ${roundName ? `${roundName} of ` : ''}${eventTitle}.`,
      type: 'SYSTEM',
      // A board is created from a Round in the current workflow. Reuse the
      // round-level key so that automatic board sync does not duplicate the
      // Round assignment notification.
      dedupeKey: `judge-round-assigned:${board?.roundId?._id?.toString?.() || board?.roundId?.id || board?.roundId?.toString?.()}:${judge?._id?.toString?.() || judge?.id}`,
      metadata: {
        action: 'JUDGE_BOARD_ASSIGNED',
        competitionId,
        roundId: board?.roundId?._id?.toString?.() || board?.roundId?.id || board?.roundId?.toString?.(),
        boardId,
        targetPath: '/judge'
      },
      channels: ['IN_APP']
    })))
  }

  const ensureBoardExists = async (id) => {
    ensureObjectId(id)
    const board = await repository.findById(id)
    if (!board) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Judging board not found'])
    return board
  }

  const applyJudgeBoardScope = (filter = {}, actor = {}) => {
    if (!actorHasRole(actor, 'JUDGE') || isPrivilegedCompetitionActor(actor)) return filter

    const actorId = getActorId(actor)
    if (!actorId) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated judge is required'])
    return { ...filter, judgeIds: actorId }
  }

  const ensureJudgeCanReadBoard = (board, actor = {}) => {
    if (!actorHasRole(actor, 'JUDGE') || isPrivilegedCompetitionActor(actor)) return

    const actorId = getActorId(actor)
    if (!actorId) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated judge is required'])

    const judgeIds = (board.judgeIds || []).map(judge => judge?._id?.toString?.() || judge?.id || judge?.toString?.())
    if (!judgeIds.includes(actorId)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You are not assigned to this judging board'])
    }
  }

  const listBoards = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = applyJudgeBoardScope(buildBoardFilter(query), actor)
    const skip = (page - 1) * limit

    const [boards, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
    ])

    return {
      boards: boards.map(normalizeBoard),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getBoardById = async (id, actor = {}) => {
    const board = await ensureBoardExists(id)
    ensureJudgeCanReadBoard(board, actor)
    return normalizeBoard(board)
  }

  const ensureBoardCanBeDeleted = async (board) => {
    if (!['DRAFT', 'ASSIGNED'].includes(board.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only DRAFT or ASSIGNED judging boards can be deleted before scoring starts'])
    }

    const boardId = board._id || board.id
    const roundId = board.roundId?._id || board.roundId
    const [scoreSheetCount, rankingCount] = await Promise.all([
      countDocuments(ScoreSheet, { boardId }),
      countDocuments(Ranking, { roundId })
    ])

    if (scoreSheetCount || rankingCount) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cannot delete judging board after score sheets or rankings have been created'])
    }
  }

  const createBoard = async (payload = {}) => {
    const competition = await ensureCompetitionExists(payload.competitionId)
    ensureCompetitionAllowsBoardChanges(competition)
    const round = await ensureRoundBelongsToCompetition({ competitionId: competition._id, roundId: payload.roundId })
    const trackId = payload.trackId || round.trackId
    await ensureTrackBelongsToCompetition({ competitionId: competition._id, trackId })
    const configuredCapacity = Number(competition.competitionConfig?.maxTeamsPerBoard || 0)
    const resolvedMaxTeams = payload.maxTeams ?? (configuredCapacity || round.trackId?.maxTeams || 1)
    await ensureTeamsBelongToBoardContext({ competitionId: competition._id, trackId, teamIds: payload.teamIds || [] })
    await ensureUsersExist(payload.judgeIds || [])
    ensureBoardCapacity({ teamIds: payload.teamIds || [], maxTeams: resolvedMaxTeams })

    const existingBoard = await repository.findByRoundAndBoardNumber({
      roundId: payload.roundId,
      boardNumber: payload.boardNumber
    })
    if (existingBoard) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Board number already exists for this round'])
    }

    const board = await repository.create({
      ...pickSafeFields(payload, BOARD_FIELDS),
      trackId: trackId || undefined,
      maxTeams: resolvedMaxTeams
    })
    const createdBoard = await repository.findById(board._id)
    await notifyAssignedJudges({ board: createdBoard })
    return normalizeBoard(createdBoard)
  }

  const updateBoard = async (id, payload = {}) => {
    const existingBoard = await ensureBoardExists(id)
    const safePayload = pickSafeFields(payload, BOARD_FIELDS)
    const competitionId = safePayload.competitionId || existingBoard.competitionId?._id || existingBoard.competitionId
    const roundId = safePayload.roundId || existingBoard.roundId?._id || existingBoard.roundId
    const round = await ensureRoundBelongsToCompetition({ competitionId, roundId })
    const eventForUpdate = await ensureCompetitionExists(competitionId)
    if (existingBoard.status === 'COMPLETED' ||
      round.status === 'COMPLETED' ||
      BOARD_LOCKED_COMPETITION_STATUSES.has(String(eventForUpdate.status || '').toUpperCase())) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Judging board assignments cannot be changed after the competition is completed or archived, or the judging round is completed'])
    }
    const trackId = safePayload.trackId !== undefined ? safePayload.trackId : (existingBoard.trackId?._id || existingBoard.trackId || round.trackId)

    await ensureTrackBelongsToCompetition({ competitionId, trackId })
    if (safePayload.teamIds) await ensureTeamsBelongToBoardContext({ competitionId, trackId, teamIds: safePayload.teamIds })
    if (safePayload.judgeIds) await ensureUsersExist(safePayload.judgeIds)
    ensureBoardCapacity({
      teamIds: safePayload.teamIds || existingBoard.teamIds || [],
      maxTeams: safePayload.maxTeams ?? existingBoard.maxTeams
    })

    if (safePayload.boardNumber && safePayload.boardNumber !== existingBoard.boardNumber) {
      const conflict = await repository.findByRoundAndBoardNumber({ roundId, boardNumber: safePayload.boardNumber })
      if (conflict && conflict._id.toString() !== id) {
        throw new ApiError(ERROR_CODES.CONFLICT, ['Board number already exists for this round'])
      }
    }

    const previousJudgeIds = (existingBoard.judgeIds || [])
      .map(judge => judge?._id?.toString?.() || judge?.id || judge?.toString?.())
      .filter(Boolean)
    const board = await repository.updateById(id, safePayload)
    if (safePayload.judgeIds !== undefined) {
      await notifyAssignedJudges({ board, previousJudgeIds })
    }
    return normalizeBoard(board)
  }

  const deleteBoard = async (id) => {
    const board = await ensureBoardExists(id)
    const competitionId = board.competitionId?._id || board.competitionId
    if (competitionId) {
      ensureCompetitionAllowsBoardChanges(await ensureCompetitionExists(competitionId))
    }
    await ensureBoardCanBeDeleted(board)
    await repository.deleteById(id)
  }

  const getRandomizationContext = async ({ competitionId, roundId }) => {
    const competition = await ensureCompetitionExists(competitionId)
    ensureCompetitionAllowsBoardChanges(competition)
    const round = await ensureRoundBelongsToCompetition({ competitionId: competition._id, roundId })
    const isFinalRound = round.roundType === 'FINAL'
    const stageRounds = isFinalRound
      ? [round]
      : await Round.find({ competitionId: competition._id, roundType: 'PRELIMINARY' }).select('_id name trackId')
    const boardCount = stageRounds.length
    const teamFilter = { competitionId: competition._id }

    if (isFinalRound) {
      // Final rounds receive only the finalists selected from preliminary rounds.
      const preliminaryRounds = await Round.find({ competitionId: competition._id, roundType: 'PRELIMINARY' }).select('promotedTeamIds')
      const finalistIds = [...new Set(preliminaryRounds.flatMap(item =>
        (item.promotedTeamIds || []).map(value => value.toString())
      ))]
      teamFilter._id = { $in: finalistIds }
    }

    const roundTeams = await Team.find(teamFilter).sort({ createdAt: 1, name: 1 })

    const eligibleTeams = roundTeams.filter(team => ELIGIBLE_TEAM_STATUSES.has(team.status))
    const ineligibleTeams = roundTeams.filter(team => !ELIGIBLE_TEAM_STATUSES.has(team.status))
    const configuredMaxTeamsPerBoard = Number(competition.competitionConfig?.maxTeamsPerBoard || 0) || null
    const maxTeamsPerBoard = Number(configuredMaxTeamsPerBoard || Math.ceil(eligibleTeams.length / Math.max(boardCount, 1)) || 0)
    const stageRoundIds = stageRounds.map(item => item._id)

    if (maxTeamsPerBoard && eligibleTeams.length > boardCount * maxTeamsPerBoard) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Eligible teams exceed configured board capacity'])
    }

    return {
      competition,
      round,
      boardCount,
      maxTeamsPerBoard,
      eligibleTeams,
      ineligibleTeams,
      stageRounds,
      stageRoundIds
    }
  }

  const buildBoardPlan = async ({ competitionId, roundId, randomize = true, predefinedBoards = null }) => {
    const context = await getRandomizationContext({ competitionId, roundId })
    const existingBoards = context.stageRoundIds.length > 1
      ? await repository.findByRoundIds(context.stageRoundIds)
      : await repository.findByRoundId(roundId)
    const normalizedExistingBoards = existingBoards.map(normalizeBoard)

    let boardPlans
    if (predefinedBoards) {
      boardPlans = predefinedBoards.map(board => ({
        roundId: board.roundId || roundId,
        boardNumber: board.boardNumber,
        boardLabel: buildBoardLabel(board.boardNumber),
        name: board.name || `Board ${buildBoardLabel(board.boardNumber)}`,
        maxTeams: context.maxTeamsPerBoard,
        judgeIds: normalizedExistingBoards.find(item => item.boardNumber === board.boardNumber)?.judgeIds || [],
        teams: (board.teamIds || [])
          .map(teamId => context.eligibleTeams.find(team => team._id.toString() === teamId))
          .filter(Boolean)
          .map((team, index) => ({
            ...normalizeTeam(team),
            placementSlot: index + 1
          })),
        teamIds: board.teamIds || []
      }))
    } else {
      const shuffledTeams = randomize ? shuffleItems(context.eligibleTeams, randomFn) : [...context.eligibleTeams]
      const distributedTeams = distributeTeamsAcrossBoards({
        teams: shuffledTeams,
        boardCount: context.boardCount
      })
      boardPlans = Array.from({ length: context.boardCount }, (_, index) => {
        const targetRound = context.stageRounds[index]
        const boardNumber = index + 1
        const boardLabel = buildBoardLabel(boardNumber)
        const boardTeams = distributedTeams[index]
        const existingBoard = normalizedExistingBoards.find(item => item.boardNumber === boardNumber)

        return {
          boardNumber,
          boardLabel,
          roundId: targetRound?._id?.toString?.() || targetRound?.id || roundId,
          name: targetRound?.name || `Board ${boardLabel}`,
          maxTeams: context.maxTeamsPerBoard,
          judgeIds: existingBoard?.judgeIds || [],
          teams: boardTeams.map((team, teamIndex) => ({
            ...normalizeTeam(team),
            placementSlot: teamIndex + 1
          })),
          teamIds: boardTeams.map(team => team._id.toString())
        }
      })
    }

    return {
      ...context,
      boards: boardPlans,
      existingBoards: normalizedExistingBoards
    }
  }

  const previewRandomizedBoards = async ({ competitionId, roundId }) => {
    const result = await buildBoardPlan({ competitionId, roundId, randomize: true })

    return {
      competition: normalizeCompetition(result.competition),
      round: normalizeRound(result.round),
      boardCount: result.boardCount,
      maxTeamsPerBoard: result.maxTeamsPerBoard,
      eligibleTeamCount: result.eligibleTeams.length,
      ineligibleTeamCount: result.ineligibleTeams.length,
      boards: result.boards
    }
  }

  const confirmRandomizedBoards = async ({ competitionId, roundId, boards }) => {
    const result = await buildBoardPlan({ competitionId, roundId, randomize: false, predefinedBoards: boards })
    const eligibleIds = new Set(result.eligibleTeams.map(team => team._id.toString()))
    const submittedIds = result.boards.flatMap(board => board.teamIds)
    const expectedBoardNumbers = new Set(Array.from({ length: result.boardCount }, (_, index) => index + 1))
    const submittedBoardNumbers = result.boards.map(board => Number(board.boardNumber))

    if (!relaxedWorkflow && result.boards.length !== result.boardCount) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Randomized board confirmation must include exactly the configured number of boards'])
    }
    if (new Set(submittedBoardNumbers).size !== submittedBoardNumbers.length) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Randomized board confirmation contains duplicate board numbers'])
    }
    for (const boardNumber of submittedBoardNumbers) {
      if (!expectedBoardNumbers.has(boardNumber)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Randomized board confirmation contains an unexpected board number'])
      }
    }
    for (const board of result.boards) {
      if (result.maxTeamsPerBoard && board.teamIds.length > result.maxTeamsPerBoard) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Randomized board confirmation exceeds maxTeamsPerBoard'])
      }
    }
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Randomized board confirmation contains duplicate team assignments'])
    }
    if (submittedIds.length !== eligibleIds.size) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Randomized board confirmation must include every eligible team exactly once'])
    }
    for (const teamId of submittedIds) {
      if (!eligibleIds.has(teamId)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Randomized board confirmation includes a team that is not eligible'])
      }
    }

    // The round mirrors the confirmed board lineup for read-only display and
    // participant access. Coordinators cannot manually alter this list.
    const teamIdsByRound = new Map()
    for (const board of result.boards) teamIdsByRound.set(board.roundId || roundId, board.teamIds)
    await Promise.all([...teamIdsByRound.entries()].map(([targetRoundId, teamIds]) =>
      Round.findByIdAndUpdate(targetRoundId, { assignedTeamIds: teamIds })
    ))

    await Team.updateMany(
      { _id: { $in: [...eligibleIds] } },
      { $unset: { boardNumber: 1, placementSlot: 1 } }
    )

    for (const board of result.boards) {
      for (const [index, teamId] of board.teamIds.entries()) {
        await Team.findByIdAndUpdate(teamId, {
          boardNumber: board.boardNumber,
          placementSlot: index + 1
        })
      }
    }

    const confirmedBoards = []
    const boardIdsByNumber = new Map()
    for (const board of result.boards) {
      const targetRoundId = board.roundId || roundId
      const existingBoard = await repository.findByRoundAndBoardNumber({
        roundId: targetRoundId,
        boardNumber: board.boardNumber
      })

      const payload = {
        competitionId,
        roundId: targetRoundId,
        trackId: undefined,
        name: board.name,
        boardNumber: board.boardNumber,
        teamIds: board.teamIds,
        judgeIds: (existingBoard?.judgeIds || []).map(judge => judge._id?.toString?.() || judge.toString?.() || judge),
        maxTeams: board.maxTeams,
        status: board.teamIds.length > 0 ? 'ASSIGNED' : 'DRAFT'
      }

      const savedBoard = existingBoard
        ? await repository.updateById(existingBoard._id.toString(), payload)
        : await repository.create(payload)

      boardIdsByNumber.set(board.boardNumber, savedBoard._id)
      confirmedBoards.push(normalizeBoard(await repository.findById(savedBoard._id)))
    }

    await Promise.all([...teamIdsByRound.keys()].map((targetRoundId) => repository.deleteManyByRoundExcludingBoardNumbers({
      roundId: targetRoundId,
      boardNumbers: result.boards.filter((board) => (board.roundId || roundId) === targetRoundId).map(board => board.boardNumber)
    })))

    if (repository.replaceRoundTeamPlacements) {
      await repository.replaceRoundTeamPlacements({
        competitionId,
        roundId,
        placements: result.boards.flatMap(board => board.teamIds.map((teamId, index) => ({
          competitionId,
          roundId: board.roundId || roundId,
          teamId,
          boardId: boardIdsByNumber.get(board.boardNumber),
          boardNumber: board.boardNumber,
          placementSlot: index + 1
        })))
      })
    }

    return {
      competition: normalizeCompetition(result.competition),
      round: normalizeRound(await Round.findById(roundId)),
      boardCount: result.boardCount,
      confirmedTeamCount: result.eligibleTeams.length,
      boards: confirmedBoards
    }
  }

  const autoAssignBoards = async ({ competitionId, roundId }) => {
    const preview = await previewRandomizedBoards({ competitionId, roundId })
    const confirmed = await confirmRandomizedBoards({
      competitionId,
      roundId,
      boards: preview.boards.map(board => ({
        boardNumber: board.boardNumber,
        name: board.name,
        teamIds: board.teamIds
      }))
    })

    return {
      totalBoards: confirmed.boards.length,
      boards: confirmed.boards
    }
  }

  return {
    listBoards,
    getBoardById,
    createBoard,
    updateBoard,
    deleteBoard,
    previewRandomizedBoards,
    confirmRandomizedBoards,
    autoAssignBoards
  }
}

export const JUDGING_BOARD_SERVICE = {
  ...createJudgingBoardService({ relaxedWorkflow: env.workflow.relaxedDemoRules }),
  normalizeBoard
}
