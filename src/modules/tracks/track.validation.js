import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

const idParam = Joi.object({
  id: objectId.required()
})

const listTracks = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    eventId: objectId,
    search: Joi.string().trim().max(100)
  })
}

const createTrack = {
  body: Joi.object({
    eventId: objectId.required(),
    name: Joi.string().trim().min(2).max(120).required(),
    description: Joi.string().trim().max(1000).allow('', null)
  })
}

const updateTrack = {
  params: idParam,
  body: Joi.object({
    eventId: objectId,
    name: Joi.string().trim().min(2).max(120),
    description: Joi.string().trim().max(1000).allow('', null)
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
