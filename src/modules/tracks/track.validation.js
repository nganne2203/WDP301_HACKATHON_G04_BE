import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const trackType = Joi.string().trim().uppercase().valid('PRELIMINARY_GROUP', 'FINAL_POOL', 'GENERAL')
const trackStatus = Joi.string().trim().uppercase().valid('DRAFT', 'OPEN', 'LOCKED', 'COMPLETED')

const idParam = Joi.object({
  id: objectId.required()
})

const listTracks = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    competitionId: objectId,
    status: trackStatus,
    search: Joi.string().trim().max(100)
  })
}

const createTrack = {
  body: Joi.object({
    competitionId: objectId.required(),
    code: Joi.string().trim().uppercase().max(20),
    name: Joi.string().trim().min(2).max(120).required(),
    description: Joi.string().trim().max(1000).allow('', null),
    topic: Joi.string().trim().max(300).allow('', null),
    problemStatement: Joi.string().trim().max(10000).allow('', null),
    type: trackType.default('PRELIMINARY_GROUP'),
    teamIds: Joi.array().items(objectId).unique().default([]),
    maxTeams: Joi.number().integer().min(2).required(),
    status: trackStatus.default('DRAFT')
  })
}

const updateTrack = {
  params: idParam,
  body: Joi.object({
    competitionId: objectId,
    code: Joi.string().trim().uppercase().max(20),
    name: Joi.string().trim().min(2).max(120),
    description: Joi.string().trim().max(1000).allow('', null),
    topic: Joi.string().trim().max(300).allow('', null),
    problemStatement: Joi.string().trim().max(10000).allow('', null),
    type: trackType,
    teamIds: Joi.array().items(objectId).unique(),
    maxTeams: Joi.number().integer().min(2),
    status: trackStatus
  }).min(1)
}

const getTrackById = {
  params: idParam
}

export const TRACK_VALIDATION = {
  listTracks,
  createTrack,
  updateTrack,
  getTrackById
}
