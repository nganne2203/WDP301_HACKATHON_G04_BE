import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const rubricStatus = Joi.string().trim().uppercase().valid('DRAFT', 'ACTIVE', 'ARCHIVED')

export const RUBRIC_VALIDATION = {
  listRubrics: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      eventId: objectId,
      roundId: objectId,
      status: rubricStatus
    })
  },
  createRubric: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.allow(null),
      title: Joi.string().trim().min(2).max(200).required(),
      description: Joi.string().trim().max(2000).allow('', null),
      totalScore: Joi.number().min(0),
      version: Joi.number().integer().min(1).default(1),
      status: rubricStatus.default('DRAFT')
    })
  },
  getRubricById: {
    params: Joi.object({
      id: objectId.required()
    })
  },
  addCriterion: {
    params: Joi.object({
      id: objectId.required()
    }),
    body: Joi.object({
      name: Joi.string().trim().min(2).max(200).required(),
      description: Joi.string().trim().max(2000).allow('', null),
      maxScore: Joi.number().min(0).required(),
      weight: Joi.number().min(0).default(1),
      order: Joi.number().integer().min(1)
    })
  }
}
