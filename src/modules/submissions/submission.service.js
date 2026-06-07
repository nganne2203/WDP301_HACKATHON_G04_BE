import mongoose from 'mongoose'

import { SUBMISSION_REPOSITORY } from './submission.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import Event from '#models/event.model.js'
import Repository from '#models/repository.model.js'
import Round from '#models/round.model.js'
import Team from '#models/team.model.js'

const SUBMISSION_FIELDS = [
  'eventId',
  'roundId',
  'teamId',
  'repositoryId',
  'demoUrl',
  'reportUrl',
  'presentationUrl',
  'status'
]

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const normalizeSubmission = (submission) => {
  if (!submission) return null
  const plainSubmission = typeof submission.toObject === 'function'
    ? submission.toObject({ getters: true, virtuals: false })
    : submission

  return {
    id: plainSubmission._id?.toString() || plainSubmission.id,
    eventId: plainSubmission.eventId?._id?.toString?.() || plainSubmission.eventId?.toString?.() || plainSubmission.eventId,
    roundId: plainSubmission.roundId?._id?.toString?.() || plainSubmission.roundId?.toString?.() || plainSubmission.roundId,
    teamId: plainSubmission.teamId?._id?.toString?.() || plainSubmission.teamId?.toString?.() || plainSubmission.teamId,
    repositoryId: plainSubmission.repositoryId?._id?.toString?.() || plainSubmission.repositoryId?.toString?.() || plainSubmission.repositoryId || null,
    event: plainSubmission.eventId && typeof plainSubmission.eventId === 'object'
      ? {
        id: plainSubmission.eventId._id?.toString() || plainSubmission.eventId.id,
        title: plainSubmission.eventId.title,
        status: plainSubmission.eventId.status
      }
      : null,
    round: plainSubmission.roundId && typeof plainSubmission.roundId === 'object'
      ? {
        id: plainSubmission.roundId._id?.toString() || plainSubmission.roundId.id,
        name: plainSubmission.roundId.name,
        roundType: plainSubmission.roundId.roundType,
        status: plainSubmission.roundId.status
      }
      : null,
    team: plainSubmission.teamId && typeof plainSubmission.teamId === 'object'
      ? {
        id: plainSubmission.teamId._id?.toString() || plainSubmission.teamId.id,
        name: plainSubmission.teamId.name,
        chapterName: plainSubmission.teamId.chapterName,
        projectName: plainSubmission.teamId.projectName,
        status: plainSubmission.teamId.status,
        boardNumber: plainSubmission.teamId.boardNumber
      }
      : null,
    repository: plainSubmission.repositoryId && typeof plainSubmission.repositoryId === 'object'
      ? {
        id: plainSubmission.repositoryId._id?.toString() || plainSubmission.repositoryId.id,
        repositoryFullName: plainSubmission.repositoryId.repositoryFullName,
        repositoryUrl: plainSubmission.repositoryId.repositoryUrl,
        status: plainSubmission.repositoryId.status
      }
      : null,
    demoUrl: plainSubmission.demoUrl,
    reportUrl: plainSubmission.reportUrl,
    presentationUrl: plainSubmission.presentationUrl,
    submittedAt: plainSubmission.submittedAt,
    status: plainSubmission.status,
    createdAt: plainSubmission.createdAt,
    updatedAt: plainSubmission.updatedAt
  }
}

const buildSubmissionFilter = (query = {}) => {
  const filter = {}
  if (query.eventId) filter.eventId = query.eventId
  if (query.roundId) filter.roundId = query.roundId
  if (query.teamId) filter.teamId = query.teamId
  if (query.repositoryId) filter.repositoryId = query.repositoryId
  if (query.status) filter.status = query.status
  return filter
}

export const createSubmissionService = ({
  repository = SUBMISSION_REPOSITORY,
  eventModel = Event,
  roundModel = Round,
  teamModel = Team,
  repositoryModel = Repository
} = {}) => {
  const ensureSubmissionExists = async (id) => {
    ensureObjectId(id, 'submission id')
    const submission = await repository.findById(id)
    if (!submission) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Submission not found'])
    }
    return submission
  }

  const ensureContext = async ({ eventId, roundId, teamId, repositoryId = null }) => {
    ensureObjectId(eventId, 'event id')
    ensureObjectId(roundId, 'round id')
    ensureObjectId(teamId, 'team id')

    const [event, round, team, linkedRepository] = await Promise.all([
      eventModel.findById(eventId),
      roundModel.findById(roundId),
      teamModel.findById(teamId),
      repositoryId ? repositoryModel.findById(repositoryId) : null
    ])

    if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
    if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

    if (round.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified event'])
    }

    if (team.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team does not belong to the specified event'])
    }

    const assignedTeamIds = (round.assignedTeamIds || []).map(value => value.toString())
    if (assignedTeamIds.length > 0 && !assignedTeamIds.includes(teamId.toString())) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team is not assigned to the specified round'])
    }

    if (linkedRepository) {
      if (linkedRepository.eventId?.toString() !== eventId.toString()) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Repository does not belong to the specified event'])
      }
      if (linkedRepository.teamId?.toString() !== teamId.toString()) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Repository does not belong to the specified team'])
      }
      if (linkedRepository.roundId && linkedRepository.roundId.toString() !== roundId.toString()) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Repository does not belong to the specified round'])
      }
    }

    return {
      event,
      round,
      team,
      linkedRepository
    }
  }

  const listSubmissions = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = buildSubmissionFilter(query)

    const [submissions, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
    ])

    return {
      submissions: submissions.map(normalizeSubmission),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getSubmissionById = async (id) => {
    return normalizeSubmission(await ensureSubmissionExists(id))
  }

  const createSubmission = async (payload = {}) => {
    const safePayload = pickSafeFields(payload, SUBMISSION_FIELDS)
    await ensureContext({
      eventId: safePayload.eventId,
      roundId: safePayload.roundId,
      teamId: safePayload.teamId,
      repositoryId: safePayload.repositoryId
    })

    const existingSubmission = await repository.findByRoundAndTeam({
      roundId: safePayload.roundId,
      teamId: safePayload.teamId
    })
    if (existingSubmission) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Submission already exists for this round and team'])
    }

    const status = safePayload.status || 'DRAFT'
    const submission = await repository.create({
      ...safePayload,
      status,
      submittedAt: status === 'SUBMITTED' ? new Date() : null
    })

    return normalizeSubmission(await repository.findById(submission._id))
  }

  const updateSubmissionStatus = async (id, status) => {
    const submission = await ensureSubmissionExists(id)
    const updatedSubmission = await repository.updateById(id, {
      status,
      submittedAt: status === 'SUBMITTED'
        ? submission.submittedAt || new Date()
        : submission.submittedAt
    })
    return normalizeSubmission(updatedSubmission)
  }

  return {
    listSubmissions,
    getSubmissionById,
    createSubmission,
    updateSubmissionStatus
  }
}

export const SUBMISSION_SERVICE = {
  ...createSubmissionService(),
  normalizeSubmission
}
