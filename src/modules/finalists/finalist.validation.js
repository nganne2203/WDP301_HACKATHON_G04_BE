import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const FINALIST_VALIDATION = {
  listFinalists: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(500).default(10),
      eventId: objectId,
      roundId: objectId,
      trackId: objectId
    })
  },
  selectFinalists: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required()
    })
  },
  selectManualFinalists: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required(),
      teamIds: Joi.array().items(objectId.required()).unique().min(1).max(200).required(),
      selectionReason: Joi.string().trim().max(500).allow('', null)
    })
  }
}
