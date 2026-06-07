import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const RESULT_VALIDATION = {
  publishResults: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required()
    })
  }
}
