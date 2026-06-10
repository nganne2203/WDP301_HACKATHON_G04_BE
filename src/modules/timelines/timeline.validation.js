import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const eventType = Joi.string().valid('WORKSHOP', 'CHECK_IN', 'ROUND', 'RESULT_PUBLISHING', 'CEREMONY', 'OTHER')
const timelineStatus = Joi.string().valid('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED')

const idParam = Joi.object({ id: objectId.required() })

const listTimelines = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    eventId: objectId,
    eventType,
    status: timelineStatus
  })
}

const createTimeline = {
  body: Joi.object({
    eventId: objectId.required(),
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(2000).allow('', null),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')),
    eventType: eventType.default('OTHER'),
    status: timelineStatus.default('SCHEDULED')
  })
}

const updateTimeline = {
  params: idParam,
  body: Joi.object({
    title: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(2000).allow('', null),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso(),
    eventType,
    status: timelineStatus
  }).min(1)
}

const getById = { params: idParam }

export const TIMELINE_VALIDATION = {
  listTimelines,
  createTimeline,
  updateTimeline,
  getById
}
