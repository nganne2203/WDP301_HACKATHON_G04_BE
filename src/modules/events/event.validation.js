import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const eventStatus = Joi.string().trim().uppercase().valid('DRAFT', 'OPEN_REGISTRATION', 'ONGOING', 'SCORING', 'COMPLETED', 'ARCHIVED')
const season = Joi.string().trim().uppercase().valid('SPRING', 'SUMMER', 'FALL')

const idParam = Joi.object({
  id: objectId.required()
})

const listEvents = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: eventStatus,
    semester: Joi.string().trim().max(50),
    season,
    year: Joi.number().integer().min(2000).max(2100),
    search: Joi.string().trim().max(100)
  })
}

const createEvent = {
  body: Joi.object({
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(2000).allow('', null),
    semester: Joi.string().trim().max(50).allow('', null),
    seriesName: Joi.string().trim().max(120).allow('', null),
    season,
    year: Joi.number().integer().min(2000).max(2100),
    theme: Joi.string().trim().max(200).allow('', null),
    registrationStart: Joi.date().iso(),
    registrationEnd: Joi.date().iso().min(Joi.ref('registrationStart')),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    minTeamMembers: Joi.number().integer().min(1).max(20).default(3),
    maxTeamMembers: Joi.number().integer().min(Joi.ref('minTeamMembers')).max(20).default(5),
    finalistSlotsPerTrack: Joi.number().integer().min(1).default(5),
    totalFinalistSlots: Joi.number().integer().min(1).default(10),
    status: eventStatus.default('DRAFT')
  })
}

const updateEvent = {
  params: idParam,
  body: Joi.object({
    title: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(2000).allow('', null),
    semester: Joi.string().trim().max(50).allow('', null),
    seriesName: Joi.string().trim().max(120).allow('', null),
    season,
    year: Joi.number().integer().min(2000).max(2100),
    theme: Joi.string().trim().max(200).allow('', null),
    registrationStart: Joi.date().iso(),
    registrationEnd: Joi.date().iso(),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    minTeamMembers: Joi.number().integer().min(1).max(20),
    maxTeamMembers: Joi.number().integer().min(1).max(20),
    finalistSlotsPerTrack: Joi.number().integer().min(1),
    totalFinalistSlots: Joi.number().integer().min(1),
    status: eventStatus
  }).min(1)
}

const updateEventStatus = {
  params: idParam,
  body: Joi.object({
    status: eventStatus.required()
  })
}

const getEventById = {
  params: idParam
}

export const EVENT_VALIDATION = {
  listEvents,
  createEvent,
  updateEvent,
  updateEventStatus,
  getEventById
}
