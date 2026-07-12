import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const workshopStatus = Joi.string().trim().uppercase().valid('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED')

const idParam = Joi.object({
  id: objectId.required()
})

const questionIdParam = Joi.object({
  questionId: objectId.required()
})

const paginationQuery = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
}

const speakerInfo = Joi.object({
  name: Joi.string().trim().max(120).allow('', null),
  title: Joi.string().trim().max(160).allow('', null),
  bio: Joi.string().trim().max(1000).allow('', null),
  email: Joi.string().email().trim().lowercase().allow('', null)
})

const listWorkshops = {
  query: Joi.object({
    ...paginationQuery,
    eventId: objectId,
    presenterId: objectId,
    status: workshopStatus,
    search: Joi.string().trim().max(100)
  })
}

const createWorkshop = {
  body: Joi.object({
    eventId: objectId.required(),
    timelineEventId: objectId,
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(2000).allow('', null),
    presenterId: objectId,
    speakerInfo,
    meetLink: Joi.string().uri({ scheme: ['http', 'https'] }).allow('', null),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
    questionnaire: Joi.array().items(Joi.string().trim().min(1).max(500)).unique().default([]),
    status: workshopStatus.default('SCHEDULED')
  })
}

const updateWorkshop = {
  params: idParam,
  body: Joi.object({
    eventId: objectId,
    timelineEventId: objectId.allow(null),
    title: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(2000).allow('', null),
    presenterId: objectId.allow(null),
    speakerInfo,
    meetLink: Joi.string().uri({ scheme: ['http', 'https'] }).allow('', null),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso(),
    questionnaire: Joi.array().items(Joi.string().trim().min(1).max(500)).unique(),
    status: workshopStatus
  }).min(1)
}

const getWorkshopById = {
  params: idParam
}

const createQuestion = {
  params: idParam,
  body: Joi.object({
    content: Joi.string().trim().min(2).max(1000).required()
  })
}

const listQuestions = {
  params: idParam,
  query: Joi.object({
    ...paginationQuery
  })
}

const voteQuestion = {
  params: questionIdParam
}

const createRating = {
  params: idParam,
  body: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required()
  })
}

const listRatings = {
  params: idParam,
  query: Joi.object({
    ...paginationQuery,
    mine: Joi.boolean().default(false)
  })
}

const getRatingStats = {
  params: idParam
}

const createFeedback = {
  params: idParam,
  body: Joi.object({
    comment: Joi.string().trim().min(2).max(2000).required()
  })
}

const createGoogleMeet = {
  params: idParam,
  body: Joi.object({
    organizerUserId: objectId.required(),
    attendees: Joi.array()
      .items(Joi.string().email().trim().lowercase())
      .unique()
      .default([])
  })
}

const listFeedback = {
  params: idParam,
  query: Joi.object({
    ...paginationQuery,
    mine: Joi.boolean().default(false)
  })
}

export const WORKSHOP_VALIDATION = {
  listWorkshops,
  createWorkshop,
  updateWorkshop,
  getWorkshopById,
  createQuestion,
  listQuestions,
  voteQuestion,
  createRating,
  listRatings,
  getRatingStats,
  createFeedback,
  listFeedback,
  createGoogleMeet
}
