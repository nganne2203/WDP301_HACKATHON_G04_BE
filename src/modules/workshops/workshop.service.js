import mongoose from 'mongoose'

import { WORKSHOP_REPOSITORY } from './workshop.repository.js'
import { GOOGLE_SERVICE } from '#modules/google/google.service.js'
import { PERMISSIONS } from '#constants/permissions.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import {
  getActorId,
  getIdString,
  isPrivilegedEventActor
} from '#utils/domainAccessUtil.js'

const WORKSHOP_STATUSES = ['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED']
const WORKSHOP_FIELDS = [
  'eventId',
  'timelineEventId',
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

const ensureEventExists = async (eventId) => {
  ensureObjectId(eventId, 'event id')

  const event = await WORKSHOP_REPOSITORY.findEventById(eventId)
  if (!event) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
  }

  return event
}

const ensureWorkshopExists = async (id) => {
  ensureObjectId(id, 'workshop id')

  const workshop = await WORKSHOP_REPOSITORY.findWorkshopById(id)
  if (!workshop) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])
  }

  return workshop
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

const escapeRegex = (value = '') => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const buildWorkshopFilter = (query = {}) => {
  const filter = {}

  if (query.eventId) {
    filter.eventId = query.eventId
  }

  if (query.status) {
    filter.status = query.status
  }

  if (query.presenterId) {
    filter.presenterId = query.presenterId
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [
      { title: pattern },
      { description: pattern },
      { 'speakerInfo.name': pattern }
    ]
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

const normalizeEventSummary = (event) => {
  if (!event) return null
  if (typeof event === 'string' || event instanceof mongoose.Types.ObjectId) return { id: event.toString() }

  return {
    id: event._id?.toString() || event.id,
    title: event.title,
    seriesName: event.seriesName,
    season: event.season,
    year: event.year,
    status: event.status
  }
}

const normalizeWorkshop = (workshop) => {
  if (!workshop) return null

  const plainWorkshop = typeof workshop.toObject === 'function'
    ? workshop.toObject({ getters: true, virtuals: false })
    : workshop

  return {
    id: plainWorkshop._id?.toString() || plainWorkshop.id,
    event: normalizeEventSummary(plainWorkshop.eventId),
    eventId: plainWorkshop.eventId?._id?.toString() || plainWorkshop.eventId?.toString(),
    timelineEventId: plainWorkshop.timelineEventId?.toString(),
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
        calendarEventId: plainWorkshop.googleMeet.calendarEventId,
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

const findVisibleEventIdsForActor = async (actor = {}) => {
  if (isPrivilegedEventActor(actor)) return null

  const actorId = getActorId(actor)
  if (!actorId) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])
  }

  if (isParticipantOnly(actor)) {
    const [participantEventIds, openRegistrationEventIds] = await Promise.all([
      WORKSHOP_REPOSITORY.findEventIdsForParticipant(actorId),
      WORKSHOP_REPOSITORY.findOpenRegistrationEventIds()
    ])
    return [...new Set([...participantEventIds, ...openRegistrationEventIds].map(getIdString).filter(Boolean))]
  }

  const nonDraftEventIds = await WORKSHOP_REPOSITORY.findNonDraftEventIds()
  return nonDraftEventIds.map(getIdString).filter(Boolean)
}

const applyEventVisibilityScope = async (filter = {}, actor = {}) => {
  const visibleEventIds = await findVisibleEventIdsForActor(actor)
  if (!visibleEventIds) return filter

  if (filter.eventId) {
    return visibleEventIds.includes(getIdString(filter.eventId))
      ? filter
      : { ...filter, eventId: { $in: [] } }
  }

  return { ...filter, eventId: { $in: visibleEventIds } }
}

const ensureCanViewWorkshop = async (workshop, actor = {}) => {
  if (isPrivilegedEventActor(actor)) return

  const event = workshop?.eventId
  const eventId = getIdString(event)
  if (!eventId) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])

  if (event?.status === 'DRAFT') {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])
  }

  if (isParticipantOnly(actor)) {
    const visibleEventIds = await findVisibleEventIdsForActor(actor)
    if (!visibleEventIds.includes(eventId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Workshop not found'])
    }
  }
}

const ensureActorJoinedWorkshopEvent = async (workshop, actor = {}) => {
  const actorId = getActorId(actor)
  if (!actorId) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])

  const eventId = getIdString(workshop?.eventId)
  const participant = await WORKSHOP_REPOSITORY.findJoinedParticipant({ eventId, userId: actorId })
  if (!participant) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only joined participants of this event can interact with the workshop'])
  }
}

const listWorkshops = async (query = {}, actor = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = await applyEventVisibilityScope(buildWorkshopFilter(query), actor)
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

const createWorkshop = async (payload = {}) => {
  await ensureEventExists(payload.eventId)
  ensureWorkshopTimeRange(payload)

  const workshop = await WORKSHOP_REPOSITORY.createWorkshop(pickSafeFields(payload, WORKSHOP_FIELDS))

  return normalizeWorkshop(await WORKSHOP_REPOSITORY.findWorkshopById(workshop._id))
}

const updateWorkshop = async (id, payload = {}) => {
  const existingWorkshop = await ensureWorkshopExists(id)
  const safePayload = pickSafeFields(payload, WORKSHOP_FIELDS)

  if (safePayload.eventId) {
    await ensureEventExists(safePayload.eventId)
  }

  ensureWorkshopTimeRange({
    startTime: safePayload.startTime ?? existingWorkshop.startTime,
    endTime: safePayload.endTime ?? existingWorkshop.endTime
  })

  if (safePayload.status && !WORKSHOP_STATUSES.includes(safePayload.status)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid workshop status'])
  }

  return normalizeWorkshop(await WORKSHOP_REPOSITORY.updateWorkshopById(id, safePayload))
}

const deleteWorkshop = async (id) => {
  await ensureWorkshopExists(id)
  await WORKSHOP_REPOSITORY.deleteWorkshopInteractions(id)
  await WORKSHOP_REPOSITORY.deleteWorkshopById(id)
}

const createGoogleMeet = async (workshopId, payload = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
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

  const googleMeet = await GOOGLE_SERVICE.createGoogleMeetEvent({
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
    calendarEventId: googleMeet.calendarEventId,
    htmlLink: googleMeet.htmlLink,
    organizerUserId: payload.organizerUserId,
    organizerEmail: googleMeet.organizerEmail,
    createdAt: new Date()
  })

  return {
    meetLink: updatedWorkshop.googleMeet.meetLink,
    calendarEventId: updatedWorkshop.googleMeet.calendarEventId,
    htmlLink: updatedWorkshop.googleMeet.htmlLink,
    organizerEmail: updatedWorkshop.googleMeet.organizerEmail
  }
}

const createQuestion = async (workshopId, payload = {}, actor = {}) => {
  const workshop = await ensureWorkshopExists(workshopId)
  await ensureActorJoinedWorkshopEvent(workshop, actor)

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
  await ensureActorJoinedWorkshopEvent(workshop, actor)
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
  await ensureActorJoinedWorkshopEvent(workshop, actor)

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
  await ensureActorJoinedWorkshopEvent(workshop, actor)

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
