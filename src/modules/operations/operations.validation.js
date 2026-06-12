import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const OPERATIONS_VALIDATION = {
  scopedQuery: {
    query: Joi.object({
      eventId: objectId,
      roundId: objectId
    })
  }
}
