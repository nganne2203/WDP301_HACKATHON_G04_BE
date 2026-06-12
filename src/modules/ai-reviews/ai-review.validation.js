import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const reviewKind = Joi.string().trim().valid('PER_PUSH_TECHNICAL_AUDIT', 'TEAM_AGGREGATE_TECHNICAL_AUDIT')

const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
})

export const AI_REVIEW_VALIDATION = {
  repositoryAiReviews: {
    params: Joi.object({ id: objectId.required() }),
    query: paginationQuery
  },
  getAiReviewById: {
    params: Joi.object({ id: objectId.required() })
  },
  createPerPushAudit: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      commitSha: Joi.string().trim().max(100).allow('', null)
    }).default({})
  },
  createTeamAggregateAudit: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      batchId: Joi.string().trim().max(100).allow('', null)
    }).default({})
  },
  getTeamAiAuditSummary: {
    params: Joi.object({ teamId: objectId.required() }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(50).default(5),
      reviewKind
    })
  }
}
