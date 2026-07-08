import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const rankingType = Joi.string().trim().uppercase().valid('TEAM')

export const RANKING_VALIDATION = {
  listRankings: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(500).default(10),
      eventId: objectId,
      roundId: objectId,
      trackId: objectId,
      teamId: objectId,
      rankingType: rankingType.default('TEAM')
    })
  },
  generateRankings: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required(),
      rankingType: rankingType.default('TEAM')
    })
  },
  publishResults: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required(),
      repositoryAccessAction: Joi.string().trim().uppercase().valid('NONE', 'FREEZE', 'REVOKE').default('NONE')
    })
  }
}
