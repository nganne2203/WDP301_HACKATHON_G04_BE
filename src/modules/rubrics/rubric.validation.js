import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const rubricStatus = Joi.string().trim().uppercase().valid('DRAFT', 'ACTIVE', 'ARCHIVED')
const totalWeight = Joi.number().valid(10, 100)
const scoringCoefficient = Joi.number().valid(4, 10, 100)
const coefficientNumber = Joi.number().integer().positive()

export const RUBRIC_VALIDATION = {
  listRubrics: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      competitionId: objectId,
      roundId: objectId,
      status: rubricStatus
    })
  },
  createRubric: {
    body: Joi.object({
      competitionId: objectId.required(),
      roundId: objectId.allow(null),
      title: Joi.string().trim().min(2).max(200).required(),
      description: Joi.string().trim().max(2000).allow('', null),
      totalScore: totalWeight.default(100),
      criterionMaxScore: scoringCoefficient.default(10),
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
      totalScore: totalWeight,
      criterionMaxScore: scoringCoefficient,
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
      weight: coefficientNumber.default(1),
      order: Joi.number().integer().min(1),
      judgeOnly: Joi.boolean().default(false),
      aiSupportForAudit: Joi.boolean().default(false),
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
      weight: coefficientNumber,
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
