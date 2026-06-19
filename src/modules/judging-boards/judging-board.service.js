import mongoose from 'mongoose'

import { JUDGING_BOARD_REPOSITORY } from './judging-board.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import Event from '#models/event.model.js'
import Round from '#models/round.model.js'
import Team from '#models/team.model.js'
import Track from '#models/track.model.js'
import User from '#models/user.model.js'

const BOARD_FIELDS = [
  'eventId',
  'roundId',
  'trackId',
  'name',
  'boardNumber',
  'teamIds',
  'judgeIds',
  'maxTeams',
  'status'
]

const ensureObjectId = (id, fieldName = 'judging board id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
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

  return {
    id: plainBoard._id?.toString() || plainBoard.id,
    event: normalizeEvent(plainBoard.eventId),
    eventId: plainBoard.eventId?._id?.toString?.() || plainBoard.eventId?.toString?.() || plainBoard.eventId,
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
    maxTeams: plainBoard.maxTeams,
    status: plainBoard.status,
    createdAt: plainBoard.createdAt,
    updatedAt: plainBoard.updatedAt
  }
}

const buildBoardFilter = (query = {}) => {
  const filter = {}
  if (query.eventId) {
    ensureObjectId(query.eventId, 'event id')
    filter.eventId = query.eventId
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
    const pattern = new RegExp(query.search, 'i')
    filter.$or = [{ name: pattern }]
  }
  return filter
}

const ensureEventExists = async (eventId) => {
  ensureObjectId(eventId, 'event id')
  const event = await Event.findById(eventId)
  if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
  return event
}

const ensureRoundBelongsToEvent = async ({ eventId, roundId }) => {
  ensureObjectId(roundId, 'round id')
  const round = await Round.findById(roundId)
  if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
  if (round.eventId?.toString() !== eventId.toString()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified event'])
  }
  return round
}

const ensureTrackBelongsToEvent = async ({ eventId, trackId }) => {
  if (!trackId) return null
  ensureObjectId(trackId, 'track id')
  const track = await Track.findById(trackId)
  if (!track) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Track not found'])
  if (track.eventId?.toString() !== eventId.toString()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Track does not belong to the specified event'])
  }
  return track
}

const ensureTeamsBelongToBoardContext = async ({ eventId, trackId, teamIds = [] }) => {
  for (const teamId of teamIds) ensureObjectId(teamId, 'team id')
  const teams = await Team.find({ _id: { $in: teamIds } })
  if (teams.length !== teamIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more teams do not exist'])
  }
  for (const team of teams) {
    if (team.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Assigned teams must belong to the specified event'])
    }
    if (trackId && team.trackId?.toString() !== trackId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Assigned teams must belong to the selected track'])
    }
  }
}

const ensureUsersExist = async (userIds = []) => {
  for (const userId of userIds) ensureObjectId(userId, 'judge id')
  const users = await User.find({ _id: { $in: userIds } })
  if (users.length !== userIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more judges do not exist'])
  }
}

const ensureBoardCapacity = ({ teamIds = [], maxTeams }) => {
  if (maxTeams && teamIds.length > maxTeams) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['teamIds cannot exceed maxTeams'])
  }
}

const ELIGIBLE_TEAM_STATUSES = new Set(['CONFIRMED', 'ACTIVE'])

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

export const createJudgingBoardService = ({
  repository = JUDGING_BOARD_REPOSITORY,
  randomFn = Math.random
} = {}) => {
  const ensureBoardExists = async (id) => {
    ensureObjectId(id)
    const board = await repository.findById(id)
    if (!board) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Judging board not found'])
    return board
  }

  const listBoards = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildBoardFilter(query)
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

  const getBoardById = async (id) => normalizeBoard(await ensureBoardExists(id))

  const createBoard = async (payload = {}) => {
    const event = await ensureEventExists(payload.eventId)
    const round = await ensureRoundBelongsToEvent({ eventId: event._id, roundId: payload.roundId })
    const trackId = payload.trackId || round.trackId
    await ensureTrackBelongsToEvent({ eventId: event._id, trackId })
    await ensureTeamsBelongToBoardContext({ eventId: event._id, trackId, teamIds: payload.teamIds || [] })
    await ensureUsersExist(payload.judgeIds || [])
    ensureBoardCapacity({ teamIds: payload.teamIds || [], maxTeams: payload.maxTeams })

    const existingBoard = await repository.findByRoundAndBoardNumber({
      roundId: payload.roundId,
      boardNumber: payload.boardNumber
    })
    if (existingBoard) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Board number already exists for this round'])
    }

    const board = await repository.create({
      ...pickSafeFields(payload, BOARD_FIELDS),
      trackId: trackId || undefined
    })
    return normalizeBoard(await repository.findById(board._id))
  }

  const updateBoard = async (id, payload = {}) => {
    const existingBoard = await ensureBoardExists(id)
    const safePayload = pickSafeFields(payload, BOARD_FIELDS)
    const eventId = safePayload.eventId || existingBoard.eventId?._id || existingBoard.eventId
    const roundId = safePayload.roundId || existingBoard.roundId?._id || existingBoard.roundId
    const round = await ensureRoundBelongsToEvent({ eventId, roundId })
    const trackId = safePayload.trackId !== undefined ? safePayload.trackId : (existingBoard.trackId?._id || existingBoard.trackId || round.trackId)

    await ensureTrackBelongsToEvent({ eventId, trackId })
    if (safePayload.teamIds) await ensureTeamsBelongToBoardContext({ eventId, trackId, teamIds: safePayload.teamIds })
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

    const board = await repository.updateById(id, safePayload)
    return normalizeBoard(board)
  }

  const deleteBoard = async (id) => {
    await ensureBoardExists(id)
    await repository.deleteById(id)
  }

  const getRandomizationContext = async ({ eventId, roundId }) => {
    const event = await ensureEventExists(eventId)
    const round = await ensureRoundBelongsToEvent({ eventId: event._id, roundId })
    const boardCount = Number(event.competitionConfig?.boardCount || event.competitionConfig?.trackCount || 0)
    if (!boardCount) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Event competitionConfig.boardCount is required for board randomization'])
    }

    const assignedTeamIds = (round.assignedTeamIds || []).map(value => value.toString())
    const roundTeams = await Team.find({
      _id: { $in: assignedTeamIds }
    }).sort({ createdAt: 1, name: 1 })

    const eligibleTeams = roundTeams.filter(team => ELIGIBLE_TEAM_STATUSES.has(team.status))
    const ineligibleTeams = roundTeams.filter(team => !ELIGIBLE_TEAM_STATUSES.has(team.status))
    const configuredMaxTeamsPerBoard = Number(event.competitionConfig?.maxTeamsPerBoard || 0) || null
    const derivedMaxTeamsPerBoard = eligibleTeams.length > 0
      ? Math.ceil(eligibleTeams.length / boardCount)
      : configuredMaxTeamsPerBoard || 0
    const maxTeamsPerBoard = configuredMaxTeamsPerBoard || derivedMaxTeamsPerBoard || 0

    if (maxTeamsPerBoard && eligibleTeams.length > boardCount * maxTeamsPerBoard) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Eligible teams exceed configured board capacity'])
    }

    return {
      event,
      round,
      boardCount,
      maxTeamsPerBoard,
      eligibleTeams,
      ineligibleTeams
    }
  }

  const buildBoardPlan = async ({ eventId, roundId, randomize = true, predefinedBoards = null }) => {
    const context = await getRandomizationContext({ eventId, roundId })
    const existingBoards = await repository.findByRoundId(roundId)
    const normalizedExistingBoards = existingBoards.map(normalizeBoard)

    let boardPlans
    if (predefinedBoards) {
      boardPlans = predefinedBoards.map(board => ({
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
      boardPlans = Array.from({ length: context.boardCount }, (_, index) => {
        const boardNumber = index + 1
        const boardLabel = buildBoardLabel(boardNumber)
        const start = index * context.maxTeamsPerBoard
        const end = start + context.maxTeamsPerBoard
        const boardTeams = shuffledTeams.slice(start, end)
        const existingBoard = normalizedExistingBoards.find(item => item.boardNumber === boardNumber)

        return {
          boardNumber,
          boardLabel,
          name: `Board ${boardLabel}`,
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

  const previewRandomizedBoards = async ({ eventId, roundId }) => {
    const result = await buildBoardPlan({ eventId, roundId, randomize: true })

    return {
      event: normalizeEvent(result.event),
      round: normalizeRound(result.round),
      boardCount: result.boardCount,
      maxTeamsPerBoard: result.maxTeamsPerBoard,
      eligibleTeamCount: result.eligibleTeams.length,
      ineligibleTeamCount: result.ineligibleTeams.length,
      boards: result.boards
    }
  }

  const confirmRandomizedBoards = async ({ eventId, roundId, boards }) => {
    const result = await buildBoardPlan({ eventId, roundId, randomize: false, predefinedBoards: boards })
    const eligibleIds = new Set(result.eligibleTeams.map(team => team._id.toString()))
    const submittedIds = result.boards.flatMap(board => board.teamIds)

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

    await Team.updateMany(
      { _id: { $in: (result.round.assignedTeamIds || []).map(value => value.toString()) } },
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
    for (const board of result.boards) {
      const existingBoard = await repository.findByRoundAndBoardNumber({
        roundId,
        boardNumber: board.boardNumber
      })

      const payload = {
        eventId,
        roundId,
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

      confirmedBoards.push(normalizeBoard(await repository.findById(savedBoard._id)))
    }

    await repository.deleteManyByRoundExcludingBoardNumbers({
      roundId,
      boardNumbers: result.boards.map(board => board.boardNumber)
    })

    return {
      event: normalizeEvent(result.event),
      round: normalizeRound(result.round),
      boardCount: result.boardCount,
      confirmedTeamCount: result.eligibleTeams.length,
      boards: confirmedBoards
    }
  }

  const autoAssignBoards = async ({ eventId, roundId }) => {
    const preview = await previewRandomizedBoards({ eventId, roundId })
    const confirmed = await confirmRandomizedBoards({
      eventId,
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
  ...createJudgingBoardService(),
  normalizeBoard
}
