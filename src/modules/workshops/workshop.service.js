import mongoose from 'mongoose'

import { WORKSHOP_REPOSITORY } from './workshop.repository.js'
import { GOOGLE_SERVICE } from '#modules/google/google.service.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'
import { PERMISSIONS } from '#constants/permissions.js'
import ApiError from '#utils/ApiError.js'
import { isWithinCompetitionDateWindow } from '#utils/competitionDateWindow.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import { ensureCompetitionAllowsChildMutations } from '#utils/competitionLifecycleUtil.js'
import {
  getActorId,
  getIdString,
  isPrivilegedCompetitionActor
} from '#utils/domainAccessUtil.js'

const WORKSHOP_STATUSES = ['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED']
const WORKSHOP_STATUS_TRANSITIONS = {
  SCHEDULED: ['LIVE', 'CANCELLED'],
  LIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
}
const WORKSHOP_FIELDS = [
  'competitionId',
  'timelineActivityId',
  'title',
  'description',
  'presenterId',
  'speakerInfo',
  'meetLink',
  'startTime',
  'endTime',
  'questionnaire',
  'status'
]

const notifyPresenterAssignment = async (workshop) => {
  const presenter = workshop?.presenterId
  const presenterId = getIdString(presenter)
  const workshopId = getIdString(workshop?._id || workshop?.id)

  if (!presenterId || !presenter?.email || !workshopId) return

  const competitionTitle = workshop.competitionId?.title || 'SEAL Hackathon'

  await NOTIFICATION_SERVICE.notifyUser({
    user: presenter,
    title: 'Workshop assignment',
    message: `You were assigned as the speaker for "${workshop.title}" in ${competitionTitle}.`,
    type: 'WORKSHOP',
    dedupeKey: `workshop-speaker-assigned:${workshopId}:${presenterId}`,
    metadata: {
      action: 'WORKSHOP_SPEAKER_ASSIGNED',
      workshopId,
      competitionId: getIdString(workshop.competitionId),
      targetPath: '/mentor/workshops'
    },
    channels: ['IN_APP', 'EMAIL']
  })
}

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureWorkshopTimeRange = (payload = {}) => {
  if (!payload.startTime || !payload.endTime) return

  const startTime = new Date(payload.startTime)
  const endTime = new Date(payload.endTime)

  if (endTime <= startTime) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['endTime must be after startTime'])
  }
}

const ensureWorkshopWithinCompetitionWindow = ({ competition, startTime, endTime }) => {
  if (!competition || !startTime || !endTime) return
  if (!isWithinCompetitionDateWindow({ competition, value: startTime })) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Workshop startTime must be within the competition date window'])
  }
  if (!isWithinCompetitionDateWindow({ competition, value: endTime })) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Workshop endTime must be within the competition date window'])
  }
}

const ensureWorkshopStatusTransition = ({ fromStatus, toStatus, isCreate = false }) => {
  if (!toStatus || fromStatus === toStatus) return
  if (isCreate) {
    if (toStatus !== 'SCHEDULED') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Workshops must be created in SCHEDULED status'])
    }
    return
  }

  const allowedStatuses = WORKSHOP_STATUS_TRANSITIONS[fromStatus] || []
  if (!allowedStatuses.includes(toStatus)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid workshop status transition from ${fromStatus} to ${toStatus}`])
  }
}

const ensureCompetitionExists = async (competitionId) => {
  ensureObjectId(competitionId, 'competition id')

  const competition = await WORKSHOP_REPOSITORY.findCompetitionById(competitionId)
  if (!competition) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
  }

  return competition
}

const ensureWorkshopExists = async (id) => {
  ensureObjectId(id, 'workshop id')

  const workshop = await WORKSHOP_REPOSITORY.findWorkshopById(id)
  if (!workshop) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])
  }

  return workshop
}

const ensureWorkshopCompetitionAllowsMutations = async (workshop, resourceLabel = 'Workshops') => {
  const competition = workshop?.competitionId?.status
    ? workshop.competitionId
    : await ensureCompetitionExists(getIdString(workshop?.competitionId))
  ensureCompetitionAllowsChildMutations(competition, resourceLabel)
  return competition
}

const canSubmitQuestion = (workshop) => {
  const now = new Date()
  return ['SCHEDULED', 'LIVE'].includes(workshop.status) && now <= new Date(workshop.endTime)
}

const canSubmitPostWorkshopInteraction = (workshop) => {
  const now = new Date()
  return workshop.status === 'COMPLETED' || now >= new Date(workshop.endTime)
}

const hasPermission = (actor = {}, permission) => {
  return (actor.permissions || []).includes(permission)
}

const isWorkshopSpeaker = (workshop, actor = {}) => {
  const presenterId = workshop.presenterId?._id || workshop.presenterId
  return presenterId?.toString() === actor.id
}

const ensureCanViewInsights = (workshop, actor = {}, permission) => {
  if (hasPermission(actor, permission) || isWorkshopSpeaker(workshop, actor)) return

  throw new ApiError(ERROR_CODES.FORBIDDEN, ['You do not have permission to perform this action'])
}

const ensureCanCreateGoogleMeet = ({ workshop, actor = {}, organizerUserId }) => {
  if (
    hasPermission(actor, PERMISSIONS.WORKSHOP_MEET_DELETE) ||
    isWorkshopSpeaker(workshop, actor) ||
    organizerUserId === actor.id
  ) {
    return
  }

  throw new ApiError(ERROR_CODES.FORBIDDEN, ['You do not have permission to perform this action'])
}

const buildWorkshopFilter = (query = {}) => {
  const filter = {}

  if (query.competitionId) {
    filter.competitionId = query.competitionId
  }

  if (query.status) {
    filter.status = query.status
  }

  if (query.presenterId) {
    filter.presenterId = query.presenterId
  }

  if (query.search) {
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) {
      filter.$or = [
        { title: pattern },
        { description: pattern },
        { 'speakerInfo.name': pattern }
      ]
    }
  }

  return filter
}

const isParticipantOnly = (actor = {}) => {
  const roles = (Array.isArray(actor.roles) ? actor.roles : [actor.role])
    .map(role => role?.code || role?.name || role)
    .filter(Boolean)
    .map(role => String(role).trim().toUpperCase())

  return roles.length > 0 && roles.every(role => role === 'PARTICIPANT' || role === 'USER')
}

const normalizeUserSummary = (user) => {
  if (!user) return null
  if (typeof user === 'string' || user instanceof mongoose.Types.ObjectId) return { id: user.toString() }

  return {
    id: user._id?.toString() || user.id,
    fullName: user.fullName,
    email: user.email,
    githubUsername: user.githubUsername
  }
}

const normalizeCompetitionSummary = (competition) => {
  if (!competition) return null
  if (typeof competition === 'string' || competition instanceof mongoose.Types.ObjectId) return { id: competition.toString() }

  return {
    id: competition._id?.toString() || competition.id,
    title: competition.title,
    seriesName: competition.seriesName,
    season: competition.season,
    year: competition.year,
    status: competition.status
  }
}

const normalizeWorkshop = (workshop) => {
  if (!workshop) return null

  const plainWorkshop = typeof workshop.toObject === 'function'
    ? workshop.toObject({ getters: true, virtuals: false })
    : workshop

  return {
    id: plainWorkshop._id?.toString() || plainWorkshop.id,
    competition: normalizeCompetitionSummary(plainWorkshop.competitionId),
    competitionId: plainWorkshop.competitionId?._id?.toString() || plainWorkshop.competitionId?.toString(),
    timelineActivityId: plainWorkshop.timelineActivityId?.toString(),
    title: plainWorkshop.title,
    description: plainWorkshop.description,
    presenter: normalizeUserSummary(plainWorkshop.presenterId),
    presenterId: plainWorkshop.presenterId?._id?.toString() || plainWorkshop.presenterId?.toString(),
    speakerInfo: plainWorkshop.speakerInfo,
    meetLink: plainWorkshop.meetLink,
    googleMeet: plainWorkshop.googleMeet
      ? {
        enabled: Boolean(plainWorkshop.googleMeet.enabled),
        meetLink: plainWorkshop.googleMeet.meetLink,
        calendarCompetitionId: plainWorkshop.googleMeet.calendarCompetitionId,
        htmlLink: plainWorkshop.googleMeet.htmlLink,
        organizerUserId: plainWorkshop.googleMeet.organizerUserId?.toString(),
        organizerEmail: plainWorkshop.googleMeet.organizerEmail,
        createdAt: plainWorkshop.googleMeet.createdAt
      }
      : undefined,
    startTime: plainWorkshop.startTime,
    endTime: plainWorkshop.endTime,
    questionnaire: plainWorkshop.questionnaire || [],
    status: plainWorkshop.status,
    createdAt: plainWorkshop.createdAt,
    updatedAt: plainWorkshop.updatedAt
  }
}

const normalizeQuestion = (question, { includeVotes = false } = {}) => {
  if (!question) return null

  const plainQuestion = typeof question.toObject === 'function'
    ? question.toObject({ getters: true, virtuals: false })
    : question

  return {
    id: plainQuestion._id?.toString() || plainQuestion.id,
    workshopId: plainQuestion.workshopId?.toString(),
    author: normalizeUserSummary(plainQuestion.authorId),
    content: plainQuestion.content,
    voteCount: plainQuestion.voteCount,
    votes: includeVotes
      ? (plainQuestion.votes || []).map((vote) => ({
        voter: normalizeUserSummary(vote.voterId),
        votedAt: vote.votedAt
      }))
      : undefined,
    createdAt: plainQuestion.createdAt,
    updatedAt: plainQuestion.updatedAt
  }
}

const canViewQuestionVoteHistory = (workshop, actor = {}) => {
  return isWorkshopSpeaker(workshop, actor) ||
    hasPermission(actor, PERMISSIONS.WORKSHOP_RATING_VIEW) ||
    hasPermission(actor, PERMISSIONS.WORKSHOP_FEEDBACK_VIEW)
}

const normalizeRating = (rating) => {
  if (!rating) return null

  const plainRating = typeof rating.toObject === 'function'
    ? rating.toObject({ getters: true, virtuals: false })
    : rating

  return {
    id: plainRating._id?.toString() || plainRating.id,
    workshopId: plainRating.workshopId?.toString(),
    author: normalizeUserSummary(plainRating.authorId),
    rating: plainRating.rating,
    createdAt: plainRating.createdAt,
    updatedAt: plainRating.updatedAt
  }
}

const normalizeFeedback = (feedback) => {
  if (!feedback) return null

  const plainFeedback = typeof feedback.toObject === 'function'
    ? feedback.toObject({ getters: true, virtuals: false })
    : feedback

  return {
    id: plainFeedback._id?.toString() || plainFeedback.id,
    workshopId: plainFeedback.workshopId?.toString(),
    author: normalizeUserSummary(plainFeedback.authorId),
    comment: plainFeedback.comment,
    createdAt: plainFeedback.createdAt,
    updatedAt: plainFeedback.updatedAt
  }
}

const findVisibleCompetitionIdsForActor = async (actor = {}) => {
  if (isPrivilegedCompetitionActor(actor)) return null

  const actorId = getActorId(actor)
  if (!actorId) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])
  }

  if (isParticipantOnly(actor)) {
    const [participantCompetitionIds, openRegistrationCompetitionIds] = await Promise.all([
      WORKSHOP_REPOSITORY.findCompetitionIdsForParticipant(actorId),
      WORKSHOP_REPOSITORY.findOpenRegistrationCompetitionIds()
    ])
    return [...new Set([...participantCompetitionIds, ...openRegistrationCompetitionIds].map(getIdString).filter(Boolean))]
  }

  const nonDraftCompetitionIds = await WORKSHOP_REPOSITORY.findNonDraftCompetitionIds()
  return nonDraftCompetitionIds.map(getIdString).filter(Boolean)
}

const applyCompetitionVisibilityScope = async (filter = {}, actor = {}) => {
  const visibleCompetitionIds = await findVisibleCompetitionIdsForActor(actor)
  if (!visibleCompetitionIds) return filter

  if (filter.competitionId) {
    return visibleCompetitionIds.includes(getIdString(filter.competitionId))
      ? filter
      : { ...filter, competitionId: { $in: [] } }
  }

  return { ...filter, competitionId: { $in: visibleCompetitionIds } }
}

const ensureCanViewWorkshop = async (workshop, actor = {}) => {
  if (isPrivilegedCompetitionActor(actor)) return

  const competition = workshop?.competitionId
  const competitionId = getIdString(competition)
  if (!competitionId) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])

  if (competition?.status === 'DRAFT') {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])
  }

  if (isParticipantOnly(actor)) {
    const visibleCompetitionIds = await findVisibleCompetitionIdsForActor(actor)
    if (!visibleCompetitionIds.includes(competitionId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])
    }
  }
}

const ensureActorJoinedWorkshopCompetition = async (workshop, actor = {}) => {
  const actorId = getActorId(actor)
  if (!actorId) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])

  const competitionId = getIdString(workshop?.competitionId)
  const participant = await WORKSHOP_REPOSITORY.findJoinedParticipant({ competitionId, userId: actorId })
  if (!participant) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only joined participants of this competition can interact with the workshop'])
  }
}

const listWorkshops = async (query = {}, actor = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = await applyCompetitionVisibilityScope(buildWorkshopFilter(query), actor)
  const skip = (page - 1) * limit

  const [workshops, totalItems] = await Promise.all([
    WORKSHOP_REPOSITORY.findWorkshops({ filter, skip, limit }),
    WORKSHOP_REPOSITORY.countWorkshops(filter)
  ])

  return {
    workshops: workshops.map(normalizeWorkshop),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const getWorkshopById = async (id, actor = {}) => {
  const workshop = await ensureWorkshopExists(id)
  await ensureCanViewWorkshop(workshop, actor)
  return normalizeWorkshop(workshop)
}

const ensureWorkshopCanBeDeleted = async (workshop) => {
  if (workshop.status !== 'SCHEDULED') {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only SCHEDULED workshops can be deleted before they receive interactions'])
  }

  const workshopId = getIdString(workshop._id || workshop.id)
  const [questionCount, ratingCount, feedbackCount] = await Promise.all([
    WORKSHOP_REPOSITORY.countQuestions({ workshopId }),
    WORKSHOP_REPOSITORY.countRatings({ workshopId }),
    WORKSHOP_REPOSITORY.countFeedback({ workshopId })
  ])

  if (questionCount || ratingCount || feedbackCount) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cannot delete workshop after questions, ratings, or feedback have been created'])
  }
}

const createWorkshop = async (payload = {}) => {
  const competition = await ensureCompetitionExists(payload.competitionId)
  ensureCompetitionAllowsChildMutations(competition, 'Workshops')
  ensureWorkshopTimeRange(payload)
  ensureWorkshopWithinCompetitionWindow({
    competition,
    startTime: payload.startTime,
    endTime: payload.endTime
  })
  ensureWorkshopStatusTransition({
    toStatus: payload.status || 'SCHEDULED',
    isCreate: true
  })

  const workshop = await WORKSHOP_REPOSITORY.createWorkshop(pickSafeFields(payload, WORKSHOP_FIELDS))

  const createdWorkshop = await WORKSHOP_REPOSITORY.findWorkshopById(workshop._id)
  await notifyPresenterAssignment(createdWorkshop)

  return normalizeWorkshop(createdWorkshop)
}

const updateWorkshop = async (id, payload = {}) => {
  const existingWorkshop = await ensureWorkshopExists(id)
  const safePayload = pickSafeFields(payload, WORKSHOP_FIELDS)
  await ensureWorkshopCompetitionAllowsMutations(existingWorkshop, 'Workshops')

  if (safePayload.competitionId) {
    const nextCompetition = await ensureCompetitionExists(safePayload.competitionId)
    ensureCompetitionAllowsChildMutations(nextCompetition, 'Workshops')
  }
  const competitionId = safePayload.competitionId || getIdString(existingWorkshop.competitionId)
  const competition = await ensureCompetitionExists(competitionId)

  const nextSchedule = {
    startTime: safePayload.startTime ?? existingWorkshop.startTime,
    endTime: safePayload.endTime ?? existingWorkshop.endTime
  }
  ensureWorkshopTimeRange(nextSchedule)
  ensureWorkshopWithinCompetitionWindow({ competition, ...nextSchedule })

  if (safePayload.status && !WORKSHOP_STATUSES.includes(safePayload.status)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid workshop status'])
  }
  ensureWorkshopStatusTransition({
    fromStatus: existingWorkshop.status,
    toStatus: safePayload.status
  })

  const previousPresenterId = getIdString(existingWorkshop.presenterId)
  const updatedWorkshop = await WORKSHOP_REPOSITORY.updateWorkshopById(id, safePayload)
  const nextPresenterId = getIdString(updatedWorkshop.presenterId)

  if (nextPresenterId && nextPresenterId !== previousPresenterId) {
    await notifyPresenterAssignment(updatedWorkshop)
  }

  return normalizeWorkshop(updatedWorkshop)
}

const deleteWorkshop = async (id) => {
  const workshop = await ensureWorkshopExists(id)
  await ensureWorkshopCompetitionAllowsMutations(workshop, 'Workshops')
  await ensureWorkshopCanBeDeleted(workshop)
  await WORKSHOP_REPOSITORY.deleteWorkshopById(id)
}

const createGoogleMeet = async (workshopId, payload = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  await ensureWorkshopCompetitionAllowsMutations(workshop, 'Workshop meeting links')
  ensureCanCreateGoogleMeet({
    workshop,
    actor,
    organizerUserId: payload.organizerUserId
  })

  if (!workshop.startTime || !workshop.endTime) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Workshop startTime and endTime are required'])
  }

  ensureWorkshopTimeRange({
    startTime: workshop.startTime,
    endTime: workshop.endTime
  })

  const googleMeet = await GOOGLE_SERVICE.createGoogleMeetCompetition({
    organizerUserId: payload.organizerUserId,
    title: workshop.title,
    description: workshop.description,
    startTime: workshop.startTime,
    endTime: workshop.endTime,
    attendees: payload.attendees || []
  })

  const updatedWorkshop = await WORKSHOP_REPOSITORY.updateWorkshopGoogleMeet(workshopId, {
    enabled: true,
    meetLink: googleMeet.meetLink,
    calendarCompetitionId: googleMeet.calendarCompetitionId,
    htmlLink: googleMeet.htmlLink,
    organizerUserId: payload.organizerUserId,
    organizerEmail: googleMeet.organizerEmail,
    createdAt: new Date()
  })

  return {
    meetLink: updatedWorkshop.googleMeet.meetLink,
    calendarCompetitionId: updatedWorkshop.googleMeet.calendarCompetitionId,
    htmlLink: updatedWorkshop.googleMeet.htmlLink,
    organizerEmail: updatedWorkshop.googleMeet.organizerEmail
  }
}

const createQuestion = async (workshopId, payload = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  await ensureWorkshopCompetitionAllowsMutations(workshop, 'Workshop questions')
  await ensureActorJoinedWorkshopCompetition(workshop, actor)

  if (!canSubmitQuestion(workshop)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Questions can only be submitted before or during the workshop'])
  }

  const question = await WORKSHOP_REPOSITORY.createQuestion({
    workshopId,
    authorId: actor.id,
    content: payload.content
  })

  return normalizeQuestion(question)
}

const listQuestions = async (workshopId, query = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  ensureCanViewInsights(workshop, actor, PERMISSIONS.WORKSHOP_QUESTION_VIEW)

  const { page, limit } = normalizePaginationQuery(query)
  const filter = { workshopId }
  const skip = (page - 1) * limit

  const [questions, totalItems] = await Promise.all([
    WORKSHOP_REPOSITORY.findQuestions({ filter, skip, limit }),
    WORKSHOP_REPOSITORY.countQuestions(filter)
  ])

  return {
    questions: questions.map((question) => normalizeQuestion(question, {
      includeVotes: canViewQuestionVoteHistory(workshop, actor)
    })),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const voteQuestion = async (questionId, actor = {}) => {
  ensureObjectId(questionId, 'question id')

  const question = await WORKSHOP_REPOSITORY.findQuestionById(questionId)
  if (!question) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop question not found'])
  }

  const workshop = await ensureWorkshopExists(question.workshopId)
  await ensureWorkshopCompetitionAllowsMutations(workshop, 'Workshop questions')
  await ensureActorJoinedWorkshopCompetition(workshop, actor)
  if (!canSubmitQuestion(workshop)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Questions can only be voted before or during the workshop'])
  }

  const votedQuestion = await WORKSHOP_REPOSITORY.voteQuestion({ questionId, voterId: actor.id })
  if (!votedQuestion) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['You have already voted for this question'])
  }

  return normalizeQuestion(votedQuestion)
}

const createRating = async (workshopId, payload = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  await ensureWorkshopCompetitionAllowsMutations(workshop, 'Workshop ratings')
  await ensureActorJoinedWorkshopCompetition(workshop, actor)

  if (!canSubmitPostWorkshopInteraction(workshop)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Workshop can only be rated after it ends'])
  }

  const existingRating = await WORKSHOP_REPOSITORY.findRatingByAuthor({ workshopId, authorId: actor.id })
  if (existingRating) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['You have already rated this workshop'])
  }

  const rating = await WORKSHOP_REPOSITORY.createRating({
    workshopId,
    authorId: actor.id,
    rating: payload.rating
  })

  return normalizeRating(rating)
}

const listRatings = async (workshopId, query = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  const viewingOwnRating = Boolean(query.mine)
  if (!viewingOwnRating) {
    ensureCanViewInsights(workshop, actor, PERMISSIONS.WORKSHOP_RATING_VIEW)
  } else if (!actor.id) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])
  }

  const { page, limit } = normalizePaginationQuery(query)
  const filter = {
    workshopId,
    ...(viewingOwnRating ? { authorId: actor.id } : {})
  }
  const skip = (page - 1) * limit

  const [ratings, totalItems, stats] = await Promise.all([
    WORKSHOP_REPOSITORY.findRatings({ filter, skip, limit }),
    WORKSHOP_REPOSITORY.countRatings(filter),
    viewingOwnRating
      ? Promise.resolve(null)
      : WORKSHOP_REPOSITORY.getRatingStats(new mongoose.Types.ObjectId(workshopId))
  ])
  const ownAverageRating = ratings.length > 0 ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length : 0

  return {
    ratings: ratings.map(normalizeRating),
    stats: {
      averageRating: viewingOwnRating ? Number(ownAverageRating.toFixed(2)) : Number(stats.averageRating.toFixed(2)),
      totalRatings: viewingOwnRating ? totalItems : stats.totalRatings
    },
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const createFeedback = async (workshopId, payload = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  await ensureWorkshopCompetitionAllowsMutations(workshop, 'Workshop feedback')
  await ensureActorJoinedWorkshopCompetition(workshop, actor)

  if (!canSubmitPostWorkshopInteraction(workshop)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Workshop feedback can only be submitted after it ends'])
  }

  const existingFeedback = await WORKSHOP_REPOSITORY.findFeedbackByAuthor({ workshopId, authorId: actor.id })
  if (existingFeedback) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['You have already submitted feedback for this workshop'])
  }

  const feedback = await WORKSHOP_REPOSITORY.createFeedback({
    workshopId,
    authorId: actor.id,
    comment: payload.comment
  })

  return normalizeFeedback(feedback)
}

const listFeedback = async (workshopId, query = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  const viewingOwnFeedback = Boolean(query.mine)
  if (!viewingOwnFeedback) {
    ensureCanViewInsights(workshop, actor, PERMISSIONS.WORKSHOP_FEEDBACK_VIEW)
  } else if (!actor.id) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])
  }

  const { page, limit } = normalizePaginationQuery(query)
  const filter = {
    workshopId,
    ...(viewingOwnFeedback ? { authorId: actor.id } : {})
  }
  const skip = (page - 1) * limit

  const [feedback, totalItems] = await Promise.all([
    WORKSHOP_REPOSITORY.findFeedback({ filter, skip, limit }),
    WORKSHOP_REPOSITORY.countFeedback(filter)
  ])

  return {
    feedback: feedback.map(normalizeFeedback),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

export const WORKSHOP_SERVICE = {
  WORKSHOP_STATUSES,
  listWorkshops,
  getWorkshopById,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  createGoogleMeet,
  createQuestion,
  listQuestions,
  voteQuestion,
  createRating,
  listRatings,
  createFeedback,
  listFeedback
}
