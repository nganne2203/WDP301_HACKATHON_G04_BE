import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const roundType = Joi.string().trim().uppercase().valid('PRELIMINARY', 'FINAL')
const roundStatus = Joi.string().trim().uppercase().valid('DRAFT', 'OPEN', 'CLOSED', 'SCORING', 'COMPLETED')

const idParam = Joi.object({
  id: objectId.required()
})

const listRounds = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    eventId: objectId,
    trackId: objectId,
    roundType,
    status: roundStatus,
    search: Joi.string().trim().max(100)
  })
}

const createRound = {
  body: Joi.object({
    eventId: objectId.required(),
    trackId: objectId.allow(null),
    name: Joi.string().trim().min(2).max(200).required(),
    roundType: roundType.default('PRELIMINARY'),
    assignedTeamIds: Joi.array().items(objectId).unique().default([]),
    promotedTeamIds: Joi.array().items(objectId).unique().default([]),
    maxPromotedTeams: Joi.number().integer().min(1).allow(null),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso().min(Joi.ref('startTime')),
    submissionDeadline: Joi.date().iso(),
    publishTime: Joi.date().iso(),
    assignedJudgeIds: Joi.array().items(objectId).unique().default([]),
    rubricId: objectId.allow(null),
    promotionRule: Joi.string().trim().max(500).allow('', null),
    tieBreakRule: Joi.string().trim().max(500).allow('', null),
    tieBreakDurationMinutes: Joi.number().integer().min(1).allow(null),
    status: roundStatus.default('DRAFT')
  })
}

const updateRound = {
  params: idParam,
  body: Joi.object({
    eventId: objectId,
    trackId: objectId.allow(null),
    name: Joi.string().trim().min(2).max(200),
    roundType,
    assignedTeamIds: Joi.array().items(objectId).unique(),
    promotedTeamIds: Joi.array().items(objectId).unique(),
    maxPromotedTeams: Joi.number().integer().min(1).allow(null),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso(),
    submissionDeadline: Joi.date().iso().allow(null),
    publishTime: Joi.date().iso().allow(null),
    assignedJudgeIds: Joi.array().items(objectId).unique(),
    rubricId: objectId.allow(null),
    promotionRule: Joi.string().trim().max(500).allow('', null),
    tieBreakRule: Joi.string().trim().max(500).allow('', null),
    tieBreakDurationMinutes: Joi.number().integer().min(1).allow(null),
    status: roundStatus
  }).min(1)
}

const getRoundById = {
  params: idParam
}

export const ROUND_VALIDATION = {
  listRounds,
  createRound,
  updateRound,
  getRoundById
}
