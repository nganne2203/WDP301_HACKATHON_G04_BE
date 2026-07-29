import mongoose from 'mongoose'

import { TRACK_REPOSITORY } from './track.repository.js'
import { COMPETITION_SERVICE } from '#modules/competitions/competition.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import { ensureCompetitionAllowsChildMutations } from '#utils/competitionLifecycleUtil.js'
import Team from '#models/team.model.js'
import Round from '#models/round.model.js'
import {
  applyCompetitionVisibilityScope,
  ensureCanViewCompetitionChild
} from '#utils/competitionVisibilityUtil.js'

const TRACK_FIELDS = ['competitionId', 'code', 'name', 'description', 'topic', 'problemStatement', 'type', 'teamIds', 'maxTeams', 'status']
const TRACK_STATUS_TRANSITIONS = {
  DRAFT: ['OPEN'],
  OPEN: ['LOCKED'],
  LOCKED: ['COMPLETED'],
  COMPLETED: []
}

const ensureObjectId = (id, fieldName = 'track id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const buildTrackFilter = (query = {}) => {
  const filter = {}

  if (query.competitionId) {
    ensureObjectId(query.competitionId, 'competition id')
    filter.competitionId = query.competitionId
  }
  if (query.status) filter.status = query.status

  if (query.search) {
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) {
      filter.$or = [
        { code: pattern },
        { name: pattern },
        { description: pattern }
      ]
    }
  }

  return filter
}

const ensureTrackStatusTransition = ({ fromStatus, toStatus, isCreate = false }) => {
  if (!toStatus || fromStatus === toStatus) return
  if (isCreate) {
    if (toStatus !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Tracks must be created in DRAFT status'])
    }
    return
  }

  const allowedStatuses = TRACK_STATUS_TRANSITIONS[fromStatus] || []
  if (!allowedStatuses.includes(toStatus)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid track status transition from ${fromStatus} to ${toStatus}`])
  }
}

const normalizeCompetition = (competition) => {
  if (!competition) return null
  if (typeof competition === 'string' || competition instanceof mongoose.Types.ObjectId) return { id: competition.toString() }

  return {
    id: competition._id?.toString() || competition.id,
    title: competition.title,
    semester: competition.semester,
    status: competition.status
  }
}

const getCompetitionIdValue = (competition) => {
  if (!competition) return competition
  if (typeof competition === 'string' || competition instanceof mongoose.Types.ObjectId) return competition
  return competition._id || competition.id
}

const countDocuments = async (model, filter) => {
  if (!model?.countDocuments) return 0
  return await model.countDocuments(filter)
}

const normalizeTrack = (track) => {
  if (!track) return null

  const plainTrack = typeof track.toObject === 'function'
    ? track.toObject({ getters: true, virtuals: false })
    : track

  return {
    id: plainTrack._id?.toString() || plainTrack.id,
    competition: normalizeCompetition(plainTrack.competitionId),
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
  competitionService = COMPETITION_SERVICE
} = {}) => {
  const ensureTrackExistsWithRepository = async (id) => {
    ensureObjectId(id)

    const track = await repository.findById(id)
    if (!track) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Track not found'])
    }

    return track
  }

  const ensureUniqueTrackNameWithRepository = async ({ competitionId, name, ignoreTrackId }) => {
    if (!competitionId || !name) return

    const existingTrack = await repository.findByCompetitionAndName(competitionId, name)
    if (existingTrack && existingTrack._id.toString() !== ignoreTrackId) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Track name already exists in this competition'])
    }
  }

  const ensureUniqueTrackCodeWithRepository = async ({ competitionId, code, ignoreTrackId }) => {
    if (!competitionId || !code) return

    const normalizedCode = code.trim().toUpperCase()
    const existingTrack = await repository.findByCompetitionAndCode(competitionId, normalizedCode)
    if (existingTrack && existingTrack._id.toString() !== ignoreTrackId) {
      throw new ApiError(ERROR_CODES.CONFLICT, [`A track with code “${normalizedCode}” already exists in this competition`])
    }
  }

  const listTracks = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = await applyCompetitionVisibilityScope({
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
    await ensureCanViewCompetitionChild({
      resource: track,
      actor,
      repository,
      notFoundMessage: 'Track not found'
    })
    return normalizeTrack(track)
  }

  const ensureTrackCanBeDeleted = async (track) => {
    if (track.status !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only unused DRAFT tracks can be deleted'])
    }

    const trackId = track._id || track.id
    const [teamCount, roundCount] = await Promise.all([
      countDocuments(Team, { trackId }),
      countDocuments(Round, { trackId })
    ])

    if (teamCount || roundCount || (track.teamIds || []).length > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cannot delete track after teams or rounds have been assigned'])
    }
  }

  const createTrack = async (payload = {}) => {
    const competition = await competitionService.getRawCompetitionById(payload.competitionId)
    ensureCompetitionAllowsChildMutations(competition, 'Tracks')
    ensureTrackStatusTransition({
      toStatus: payload.status || 'DRAFT',
      isCreate: true
    })
    await ensureUniqueTrackNameWithRepository(payload)
    await ensureUniqueTrackCodeWithRepository(payload)

    let track
    try {
      track = await repository.create(pickSafeFields(payload, TRACK_FIELDS))
    } catch (error) {
      if (error?.code === 11000 && error?.keyPattern?.code) {
        throw new ApiError(ERROR_CODES.CONFLICT, [`A track with code “${payload.code?.trim().toUpperCase()}” already exists in this competition`])
      }
      if (error?.code === 11000 && error?.keyPattern?.name) {
        throw new ApiError(ERROR_CODES.CONFLICT, ['A track with this name already exists in this competition'])
      }
      throw error
    }
    return normalizeTrack(await repository.findById(track._id))
  }

  const updateTrack = async (id, payload = {}) => {
    const existingTrack = await ensureTrackExistsWithRepository(id)
    const safePayload = pickSafeFields(payload, TRACK_FIELDS)
    const currentCompetition = await competitionService.getRawCompetitionById(getCompetitionIdValue(existingTrack.competitionId))
    ensureCompetitionAllowsChildMutations(currentCompetition, 'Tracks')

    if (safePayload.competitionId) {
      const nextCompetition = await competitionService.getRawCompetitionById(safePayload.competitionId)
      ensureCompetitionAllowsChildMutations(nextCompetition, 'Tracks')
    }
    ensureTrackStatusTransition({
      fromStatus: existingTrack.status || 'DRAFT',
      toStatus: safePayload.status
    })

    await ensureUniqueTrackNameWithRepository({
      competitionId: safePayload.competitionId || getCompetitionIdValue(existingTrack.competitionId),
      name: safePayload.name || existingTrack.name,
      ignoreTrackId: id
    })
    await ensureUniqueTrackCodeWithRepository({
      competitionId: safePayload.competitionId || getCompetitionIdValue(existingTrack.competitionId),
      code: safePayload.code || existingTrack.code,
      ignoreTrackId: id
    })

    const track = await repository.updateById(id, safePayload)
    return normalizeTrack(track)
  }

  const deleteTrack = async (id) => {
    const track = await ensureTrackExistsWithRepository(id)
    const competition = await competitionService.getRawCompetitionById(getCompetitionIdValue(track.competitionId))
    ensureCompetitionAllowsChildMutations(competition, 'Tracks')
    await ensureTrackCanBeDeleted(track)
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
