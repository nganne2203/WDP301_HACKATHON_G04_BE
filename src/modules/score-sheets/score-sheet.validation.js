import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const scoreSheetStatus = Joi.string().trim().uppercase().valid('DRAFT', 'SUBMITTED', 'LOCKED')
const scoreValue = Joi.number().min(0).precision(2).required()

const scoreItem = Joi.object({
  criterionId: objectId.required(),
  scoreValue,
  comment: Joi.string().trim().max(2000).allow('', null)
})

export const SCORE_SHEET_VALIDATION = {
  listScoreSheets: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      eventId: objectId,
      roundId: objectId,
      teamId: objectId,
      judgeId: objectId,
      status: scoreSheetStatus
    })
  },
  createScoreSheet: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required(),
      boardId: objectId.required(),
      teamId: objectId.required(),
      submissionId: objectId.required(),
      rubricId: objectId.allow(null),
      generalComment: Joi.string().trim().max(2000).allow('', null),
      scores: Joi.array().items(scoreItem).default([])
    })
  },
  getScoreSheetById: {
    params: Joi.object({
      id: objectId.required()
    })
  },
  updateScoreSheet: {
    params: Joi.object({
      id: objectId.required()
    }),
    body: Joi.object({
      generalComment: Joi.string().trim().max(2000).allow('', null),
      scores: Joi.array().items(scoreItem).default([])
    }).min(1)
  },
  submitScoreSheet: {
    params: Joi.object({
      id: objectId.required()
    })
  }
}
