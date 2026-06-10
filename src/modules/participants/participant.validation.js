import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

const idParam = Joi.object({ id: objectId.required() })

const listParticipants = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    eventId: objectId,
    teamId: objectId,
    checkInStatus: Joi.string().valid('NOT_CHECKED_IN', 'CHECKED_IN'),
    status: Joi.string().valid('INVITED', 'REGISTERED', 'ACTIVE', 'WITHDRAWN'),
    eligibilityStatus: Joi.string().valid('PENDING', 'ELIGIBLE', 'INELIGIBLE'),
    githubAccessStatus: Joi.string().valid('NOT_GRANTED', 'GRANTED', 'REVOKED')
  })
}

const createParticipant = {
  body: Joi.object({
    eventId: objectId.required(),
    userId: objectId,
    teamId: objectId.allow(null),
    chapterName: Joi.string().trim().max(120).allow('', null),
    teamRole: Joi.string().valid('MEMBER', 'LEADER').default('MEMBER'),
    isGraduated: Joi.boolean().default(false),
    consentMediaUse: Joi.boolean().default(false),
    status: Joi.string().valid('INVITED', 'REGISTERED', 'ACTIVE', 'WITHDRAWN').default('REGISTERED')
  })
}

const updateParticipant = {
  params: idParam,
  body: Joi.object({
    status: Joi.string().valid('INVITED', 'REGISTERED', 'ACTIVE', 'WITHDRAWN'),
    eligibilityStatus: Joi.string().valid('PENDING', 'ELIGIBLE', 'INELIGIBLE'),
    teamId: objectId.allow(null),
    teamRole: Joi.string().valid('MEMBER', 'LEADER'),
    chapterName: Joi.string().trim().max(120).allow('', null),
    isGraduated: Joi.boolean(),
    consentMediaUse: Joi.boolean(),
    githubAccessStatus: Joi.string().valid('NOT_GRANTED', 'GRANTED', 'REVOKED'),
    attendedActivities: Joi.array().items(
      Joi.string().valid('WORKSHOP', 'OPENING', 'TEAM_MEETING', 'CODING', 'PRESENTATION', 'CLOSING')
    )
  }).min(1)
}

const getById = { params: idParam }

export const PARTICIPANT_VALIDATION = {
  listParticipants,
  createParticipant,
  updateParticipant,
  getById
}
