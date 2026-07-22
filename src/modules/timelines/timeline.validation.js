import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const activityType = Joi.string().trim().uppercase().valid('WORKSHOP', 'CHECK_IN', 'ROUND', 'RESULT_PUBLISHING', 'CEREMONY', 'OTHER')
const timelineStatus = Joi.string().trim().uppercase().valid('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED')

const idParam = Joi.object({
  id: objectId.required()
})

const listTimelines = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    competitionId: objectId,
    activityType,
    status: timelineStatus,
    search: Joi.string().trim().max(100)
  })
}

const createTimeline = {
  body: Joi.object({
    competitionId: objectId.required(),
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(2000).allow('', null),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso().min(Joi.ref('startTime')),
    activityType: activityType.default('OTHER'),
    status: timelineStatus.default('SCHEDULED')
  })
}

const updateTimeline = {
  params: idParam,
  body: Joi.object({
    competitionId: objectId,
    title: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(2000).allow('', null),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso(),
    activityType,
    status: timelineStatus
  }).min(1)
}

const getTimelineById = {
  params: idParam
}

export const TIMELINE_VALIDATION = {
  listTimelines,
  createTimeline,
  updateTimeline,
  getTimelineById
}
