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
  resolveTieBreak: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required(),
      decisions: Joi.array().items(Joi.object({
        teamId: objectId.required(),
        tieBreakMethod: Joi.string().trim().uppercase().valid('PENALTY_EVALUATION', 'MINI_TEST').required(),
        tieBreakScore: Joi.number().min(0),
        penaltyScore: Joi.number().min(0),
        miniTestScore: Joi.number().min(0),
        tieBreakReason: Joi.string().trim().min(1).max(1000).required()
      })).unique('teamId').min(2).max(200).required()
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
