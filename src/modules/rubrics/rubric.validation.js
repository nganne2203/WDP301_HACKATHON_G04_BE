import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const rubricStatus = Joi.string().trim().uppercase().valid('DRAFT', 'ACTIVE', 'ARCHIVED')
const scoreScale = Joi.number().valid(4, 10, 100)
const scoreNumber = Joi.number().positive().precision(2)

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
      totalScore: scoreScale.default(100),
      version: Joi.number().integer().min(1).default(1),
      status: rubricStatus.default('DRAFT')
    })
  },
  updateRubric: {
    params: Joi.object({
      id: objectId.required()
    }),
    body: Joi.object({
      title: Joi.string().trim().min(2).max(200),
      description: Joi.string().trim().max(2000).allow('', null),
      totalScore: scoreScale,
      version: Joi.number().integer().min(1),
      status: rubricStatus
    }).min(1)
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
      maxScore: scoreNumber.required(),
      weight: scoreNumber.default(1),
      order: Joi.number().integer().min(1),
      judgeOnly: Joi.boolean().default(false),
      aiSupportForAudit: Joi.boolean().default(true),
      aiInstruction: Joi.string().trim().max(2000).allow('', null)
    })
  },
  updateCriterion: {
    params: Joi.object({
      id: objectId.required(),
      criterionId: objectId.required()
    }),
    body: Joi.object({
      name: Joi.string().trim().min(2).max(200),
      description: Joi.string().trim().max(2000).allow('', null),
      maxScore: scoreNumber,
      weight: scoreNumber,
      order: Joi.number().integer().min(1),
      judgeOnly: Joi.boolean(),
      aiSupportForAudit: Joi.boolean(),
      aiInstruction: Joi.string().trim().max(2000).allow('', null)
    }).min(1)
  },
  deleteCriterion: {
    params: Joi.object({
      id: objectId.required(),
      criterionId: objectId.required()
    })
  }
}
