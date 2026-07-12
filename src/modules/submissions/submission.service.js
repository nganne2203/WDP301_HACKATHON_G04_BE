import mongoose from 'mongoose'

import { AUDIT_LOG_REPOSITORY } from '#modules/audit-logs/audit-log.repository.js'
import { SUBMISSION_REPOSITORY } from './submission.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import Event from '#models/event.model.js'
import JudgingBoard from '#models/judgingBoard.model.js'
import Repository from '#models/repository.model.js'
import Round from '#models/round.model.js'
import Team from '#models/team.model.js'
import Participant from '#models/participant.model.js'
import {
  actorHasRole,
  getActorId,
  getIdString,
  idListIncludes,
  idsEqual,
  isPrivilegedEventActor
} from '#utils/domainAccessUtil.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'

const SUBMISSION_FIELDS = [
  'repositoryId',
  'demoUrl',
  'reportUrl',
  'presentationUrl'
]

const SUBMISSION_CREATE_FIELDS = [
  'eventId',
  'roundId',
  'teamId',
  'repositoryId',
  'demoUrl',
  'reportUrl',
  'presentationUrl',
  'status'
]

const SUBMISSION_EDITABLE_STATUSES = new Set(['DRAFT'])
const SUBMISSION_REVIEWABLE_STATUSES = new Set(['ACCEPTED', 'REJECTED'])
const SUBMISSION_TEAM_STATUSES = new Set(['CONFIRMED'])
const ACTIVE_TEAM_STATUSES = ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED']
const IN_APP_ONLY = ['IN_APP']

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

const getId = (value) => {
  return value?._id?.toString?.() || value?.id || value?.toString?.()
}

const isActorTeamMember = (team, actor = {}) => {
  const actorId = getActorId(actor)
  if (!actorId || !team) return false
  return idsEqual(team.leaderId, actorId) || idListIncludes(team.memberIds, actorId)
}

const isActorTeamMentor = (team, actor = {}) => {
  const actorId = getActorId(actor)
  if (!actorId || !team) return false
  return idListIncludes(team.mentorIds, actorId)
}

const mergeTeamScope = (filter = {}, teamIds = []) => {
  const allowedTeamIds = [...new Set(teamIds.map(getIdString).filter(Boolean))]
  if (allowedTeamIds.length === 0) return { ...filter, teamId: { $in: [] } }

  if (filter.teamId) {
    return allowedTeamIds.includes(getIdString(filter.teamId))
      ? filter
      : { ...filter, teamId: { $in: [] } }
  }

  return {
    ...filter,
    teamId: { $in: allowedTeamIds }
  }
}

const uniqueUsersFromTeam = (team = {}) => {
  const users = []
  const seen = new Set()
  const addUser = (user) => {
    const userId = getId(user)
    if (!userId || seen.has(userId)) return
    seen.add(userId)
    users.push(typeof user === 'object' ? user : { _id: userId })
  }

  addUser(team.leaderId)
  for (const member of team.memberIds || []) addUser(member)

  return users
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
  auditLogRepository = AUDIT_LOG_REPOSITORY,
  eventModel = Event,
  roundModel = Round,
  teamModel = Team,
  participantModel = Participant,
  repositoryModel = Repository,
  boardModel = JudgingBoard,
  notificationService = null
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
    if (assignedTeamIds.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round has no assigned teams'])
    }
    if (!assignedTeamIds.includes(teamId.toString())) {
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

  const findScopedTeamIds = async ({ actor = {}, filter = {} }) => {
    if (isPrivilegedEventActor(actor)) return null

    const actorId = getActorId(actor)
    if (!actorId) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated actor is required'])
    }

    const teamIds = new Set()
    const eventScopedFilter = filter.eventId ? { eventId: filter.eventId } : {}

    if (teamModel?.find) {
      const teamFilters = [{
        ...eventScopedFilter,
        status: { $in: ACTIVE_TEAM_STATUSES },
        $or: [
          { leaderId: actorId },
          { memberIds: actorId }
        ]
      }]

      if (actorHasRole(actor, 'MENTOR')) {
        teamFilters.push({
          ...eventScopedFilter,
          status: { $in: ACTIVE_TEAM_STATUSES },
          mentorIds: actorId
        })
      }

      for (const teamFilter of teamFilters) {
        const teams = await teamModel.find(teamFilter)
        for (const team of teams || []) teamIds.add(getIdString(team._id || team.id))
      }
    }

    if (actorHasRole(actor, 'JUDGE') && boardModel?.find) {
      const boardFilter = {
        judgeIds: actorId,
        status: 'SCORING'
      }
      if (filter.eventId) boardFilter.eventId = filter.eventId
      if (filter.roundId) boardFilter.roundId = filter.roundId

      const boards = await boardModel.find(boardFilter)
      for (const board of boards || []) {
        for (const teamId of board.teamIds || []) teamIds.add(getIdString(teamId))
      }
    }

    return [...teamIds]
  }

  const ensureCanReadSubmission = async ({ submission, actor = {} }) => {
    if (isPrivilegedEventActor(actor)) return

    const actorId = getActorId(actor)
    if (!actorId) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated actor is required'])
    }

    const eventId = getIdString(submission.eventId)
    const roundId = getIdString(submission.roundId)
    const teamId = getIdString(submission.teamId)

    const team = teamModel?.findById ? await teamModel.findById(teamId) : null
    if (isActorTeamMember(team, actor) || isActorTeamMentor(team, actor)) return

    if (actorHasRole(actor, 'JUDGE') && boardModel?.findOne) {
      const round = submission.roundId && typeof submission.roundId === 'object'
        ? submission.roundId
        : await roundModel.findById(roundId)
      if (round?.status !== 'SCORING') {
        throw new ApiError(ERROR_CODES.FORBIDDEN, ['Judge can only access assigned submissions while the round is scoring'])
      }
      const board = await boardModel.findOne({
        eventId,
        roundId,
        judgeIds: actorId,
        teamIds: teamId,
        status: 'SCORING'
      })
      if (board) return
    }

    throw new ApiError(ERROR_CODES.FORBIDDEN, ['You cannot access another team submission'])
  }

  const ensureCanWriteSubmission = async ({ team, actor = {} }) => {
    const actorId = getActorId(actor)
    if (!actorId) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated actor is required'])
    }

    if (!isActorTeamMember(team, actor)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only joined members of the submission team can modify it'])
    }

    if (team.status && !SUBMISSION_TEAM_STATUSES.has(team.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only confirmed teams can submit artifacts'])
    }

    if (participantModel?.findOne) {
      const participant = await participantModel.findOne({
        eventId: getIdString(team.eventId),
        teamId: getIdString(team._id || team.id),
        userId: actorId,
        status: 'JOINED'
      })
      if (!participant) {
        throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only joined members of the submission team can modify it'])
      }
    }
  }

  const resolveRepositoryLink = async ({ eventId, teamId, repositoryId = null, linkedRepository = null }) => {
    if (linkedRepository) return linkedRepository
    if (repositoryId) return linkedRepository

    return await repositoryModel.findOne({
      eventId,
      teamId
    })
  }

  const ensureSubmissionWindow = ({ round }) => {
    const now = new Date()

    if (round.status !== 'OPEN') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round is not accepting submissions at this time'])
    }

    if (round.submissionDeadline && now > new Date(round.submissionDeadline)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Submission deadline has passed'])
    }

    if (round.endTime && now > new Date(round.endTime)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round has already ended'])
    }
  }

  const ensureSubmissionArtifacts = ({ payload = {}, repositoryId = null }) => {
    const hasArtifact = Boolean(payload.demoUrl || payload.reportUrl || payload.presentationUrl || repositoryId)
    if (!hasArtifact) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Submission must include at least one artifact URL or a linked repository'])
    }
  }

  const createAudit = async ({ actorId = null, action, resourceId, metadata = {} }) => {
    await auditLogRepository.create({
      userId: actorId,
      action,
      resourceType: 'Submission',
      resourceId,
      metadata
    })
  }

  const findTeamForNotification = async (teamId) => {
    if (!teamId || !teamModel?.findById) return null

    const query = teamModel.findById(teamId)
    if (query && typeof query.populate === 'function') {
      return await query.populate([
        { path: 'leaderId', select: 'email fullName status' },
        { path: 'memberIds', select: 'email fullName status' }
      ])
    }

    return await query
  }

  const notifySubmissionReviewed = async ({ submission, status }) => {
    if (!notificationService?.notifyUser) return

    const teamId = getId(submission.teamId)
    const team = await findTeamForNotification(teamId)
    const users = uniqueUsersFromTeam(team)
    if (users.length === 0) return

    const roundName = submission.roundId?.name || 'the round'
    const teamName = team?.name || submission.teamId?.name || 'your team'
    const title = status === 'ACCEPTED' ? 'Submission accepted' : 'Submission rejected'
    const message = `${teamName}'s submission for ${roundName} was ${status.toLowerCase()}.`

    await Promise.all(users.map(user => notificationService.notifyUser({
      user,
      title,
      message,
      type: 'FEEDBACK',
      dedupeKey: `submission-reviewed:${getId(submission)}:${status}:${getId(user)}`,
      metadata: {
        action: 'SUBMISSION_REVIEWED',
        eventId: getId(submission.eventId),
        roundId: getId(submission.roundId),
        teamId,
        submissionId: getId(submission),
        status,
        targetPath: '/participant/submissions'
      },
      channels: IN_APP_ONLY
    })))
  }

  const listSubmissions = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const baseFilter = buildSubmissionFilter(query)
    const scopedTeamIds = await findScopedTeamIds({ actor, filter: baseFilter })
    const filter = scopedTeamIds ? mergeTeamScope(baseFilter, scopedTeamIds) : baseFilter

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

  const getSubmissionById = async (id, actor = {}) => {
    const submission = await ensureSubmissionExists(id)
    await ensureCanReadSubmission({ submission, actor })
    return normalizeSubmission(submission)
  }

  const createSubmission = async (payload = {}, actor = {}) => {
    const safePayload = pickSafeFields(payload, SUBMISSION_CREATE_FIELDS)
    if (safePayload.status && SUBMISSION_REVIEWABLE_STATUSES.has(safePayload.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Submission cannot be created directly with review-only status'])
    }

    const context = await ensureContext({
      eventId: safePayload.eventId,
      roundId: safePayload.roundId,
      teamId: safePayload.teamId,
      repositoryId: safePayload.repositoryId
    })
    await ensureCanWriteSubmission({ team: context.team, actor })
    ensureSubmissionWindow({ round: context.round })
    const resolvedRepository = await resolveRepositoryLink({
      eventId: safePayload.eventId,
      teamId: safePayload.teamId,
      repositoryId: safePayload.repositoryId,
      linkedRepository: context.linkedRepository
    })

    const existingSubmission = await repository.findByRoundAndTeam({
      roundId: safePayload.roundId,
      teamId: safePayload.teamId
    })
    if (existingSubmission) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Submission already exists for this round and team'])
    }

    const status = safePayload.status || 'DRAFT'
    if (status === 'SUBMITTED') {
      ensureSubmissionArtifacts({
        payload: safePayload,
        repositoryId: resolvedRepository?._id || null
      })
    }

    const submission = await repository.create({
      ...safePayload,
      repositoryId: resolvedRepository?._id || safePayload.repositoryId || undefined,
      status,
      submittedAt: status === 'SUBMITTED' ? new Date() : null
    })

    await createAudit({
      actorId: getActorId(actor),
      action: status === 'SUBMITTED' ? 'SUBMISSION_CREATED_AND_SUBMITTED' : 'SUBMISSION_CREATED',
      resourceId: submission._id,
      metadata: {
        eventId: safePayload.eventId,
        roundId: safePayload.roundId,
        teamId: safePayload.teamId,
        repositoryId: resolvedRepository?._id || safePayload.repositoryId || null,
        status
      }
    })

    return normalizeSubmission(await repository.findById(submission._id))
  }

  const updateSubmission = async (id, payload = {}, actor = {}) => {
    const submission = await ensureSubmissionExists(id)
    if (!SUBMISSION_EDITABLE_STATUSES.has(submission.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only draft submissions can be edited'])
    }

    const safePayload = pickSafeFields(payload, SUBMISSION_FIELDS)
    const eventId = submission.eventId?._id?.toString?.() || submission.eventId?.toString?.()
    const roundId = submission.roundId?._id?.toString?.() || submission.roundId?.toString?.()
    const teamId = submission.teamId?._id?.toString?.() || submission.teamId?.toString?.()
    const repositoryId = safePayload.repositoryId ?? submission.repositoryId?._id?.toString?.() ?? submission.repositoryId?.toString?.() ?? null

    const context = await ensureContext({
      eventId,
      roundId,
      teamId,
      repositoryId
    })
    await ensureCanWriteSubmission({ team: context.team, actor })
    ensureSubmissionWindow({ round: context.round })

    const resolvedRepository = await resolveRepositoryLink({
      eventId,
      teamId,
      repositoryId,
      linkedRepository: context.linkedRepository
    })

    const updatedSubmission = await repository.updateById(id, {
      ...safePayload,
      repositoryId: resolvedRepository?._id || repositoryId || null
    })

    await createAudit({
      actorId: getActorId(actor),
      action: 'SUBMISSION_UPDATED',
      resourceId: updatedSubmission._id,
      metadata: {
        eventId,
        roundId,
        teamId,
        repositoryId: resolvedRepository?._id || repositoryId || null
      }
    })

    return normalizeSubmission(updatedSubmission)
  }

  const submitSubmission = async (id, actor = {}) => {
    const submission = await ensureSubmissionExists(id)
    const eventId = submission.eventId?._id?.toString?.() || submission.eventId?.toString?.()
    const roundId = submission.roundId?._id?.toString?.() || submission.roundId?.toString?.()
    const teamId = submission.teamId?._id?.toString?.() || submission.teamId?.toString?.()
    const repositoryId = submission.repositoryId?._id?.toString?.() || submission.repositoryId?.toString?.() || null

    if (submission.status === 'SUBMITTED') {
      return normalizeSubmission(submission)
    }

    if (!SUBMISSION_EDITABLE_STATUSES.has(submission.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only draft submissions can be submitted'])
    }

    const context = await ensureContext({
      eventId,
      roundId,
      teamId,
      repositoryId
    })
    await ensureCanWriteSubmission({ team: context.team, actor })

    ensureSubmissionWindow({ round: context.round })
    ensureSubmissionArtifacts({
      payload: submission,
      repositoryId
    })

    const updatedSubmission = await repository.updateById(id, {
      status: 'SUBMITTED',
      submittedAt: submission.submittedAt || new Date()
    })

    await createAudit({
      actorId: getActorId(actor),
      action: 'SUBMISSION_SUBMITTED',
      resourceId: updatedSubmission._id,
      metadata: {
        eventId,
        roundId,
        teamId,
        repositoryId
      }
    })

    return normalizeSubmission(updatedSubmission)
  }

  const updateSubmissionStatus = async (id, status, actor = {}) => {
    const submission = await ensureSubmissionExists(id)
    if (status === 'SUBMITTED') {
      return await submitSubmission(id, actor)
    }

    if (status === 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Use submission update flow for draft changes'])
    }

    if (!SUBMISSION_REVIEWABLE_STATUSES.has(status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Unsupported submission status transition'])
    }

    if (submission.status !== 'SUBMITTED') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only submitted submissions can be accepted or rejected'])
    }

    const updatedSubmission = await repository.updateById(id, {
      status,
      submittedAt: status === 'SUBMITTED'
        ? submission.submittedAt || new Date()
        : submission.submittedAt
    })

    await createAudit({
      actorId: getActorId(actor),
      action: `SUBMISSION_${status}`,
      resourceId: updatedSubmission._id,
      metadata: {
        eventId: updatedSubmission.eventId?._id || updatedSubmission.eventId,
        roundId: updatedSubmission.roundId?._id || updatedSubmission.roundId,
        teamId: updatedSubmission.teamId?._id || updatedSubmission.teamId
      }
    })

    await notifySubmissionReviewed({
      submission: updatedSubmission,
      status
    })

    return normalizeSubmission(updatedSubmission)
  }

  return {
    listSubmissions,
    getSubmissionById,
    createSubmission,
    updateSubmission,
    submitSubmission,
    updateSubmissionStatus
  }
}

export const SUBMISSION_SERVICE = {
  ...createSubmissionService({ notificationService: NOTIFICATION_SERVICE }),
  normalizeSubmission
}
