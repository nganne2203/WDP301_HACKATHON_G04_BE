import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const teamRole = Joi.string().trim().uppercase().valid('MEMBER', 'LEADER')
const eligibilityStatus = Joi.string().trim().uppercase().valid('PENDING', 'ELIGIBLE', 'INELIGIBLE')
const activity = Joi.string().trim().uppercase().valid('WORKSHOP', 'OPENING', 'TEAM_MEETING', 'CODING', 'PRESENTATION', 'CLOSING')
const checkInStatus = Joi.string().trim().uppercase().valid('NOT_CHECKED_IN', 'CHECKED_IN')
const githubAccessStatus = Joi.string().trim().uppercase().valid('NOT_GRANTED', 'GRANTED', 'REVOKED')
const participantStatus = Joi.string().trim().uppercase().valid('INVITED', 'ACTIVE', 'WITHDRAWN')

const idParam = Joi.object({
  id: objectId.required()
})

const listParticipants = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    eventId: objectId,
    userId: objectId,
    teamId: objectId,
    status: participantStatus,
    checkInStatus,
    githubAccessStatus,
    chapterName: Joi.string().trim().max(120),
    search: Joi.string().trim().max(100)
  })
}

const getMyParticipant = {
  query: Joi.object({
    eventId: objectId.required()
  })
}

const createParticipant = {
  body: Joi.object({
    eventId: objectId.required(),
    userId: objectId,
    teamId: objectId.allow(null),
    chapterName: Joi.string().trim().max(120).allow('', null),
    teamRole: teamRole.default('MEMBER'),
    isGraduated: Joi.boolean().default(false),
    consentMediaUse: Joi.boolean().default(false),
    eligibilityStatus: eligibilityStatus.default('PENDING'),
    attendedActivities: Joi.array().items(activity).unique().default([]),
    checkInStatus: checkInStatus.default('NOT_CHECKED_IN'),
    githubAccessStatus: githubAccessStatus.default('NOT_GRANTED'),
    status: participantStatus.default('INVITED'),
    joinedAt: Joi.date().iso()
  })
}

const updateParticipant = {
  params: idParam,
  body: Joi.object({
    userId: objectId,
    teamId: objectId.allow(null),
    chapterName: Joi.string().trim().max(120).allow('', null),
    teamRole,
    isGraduated: Joi.boolean(),
    consentMediaUse: Joi.boolean(),
    eligibilityStatus,
    attendedActivities: Joi.array().items(activity).unique(),
    checkInStatus,
    githubAccessStatus,
    status: participantStatus,
    joinedAt: Joi.date().iso().allow(null)
  }).min(1)
}

const updateCheckIn = {
  params: idParam,
  body: Joi.object({
    checkInStatus: checkInStatus.required()
  })
}

const generateCheckInQr = {
  body: Joi.object({
    eventId: objectId.required()
  })
}

const scanCheckInQr = {
  body: Joi.object({
    token: Joi.string().trim().min(32).max(512).required()
  })
}

const updateAttendance = {
  params: idParam,
  body: Joi.object({
    attendedActivities: Joi.array().items(activity).unique().required()
  })
}

const updateGithubAccess = {
  params: idParam,
  body: Joi.object({
    githubAccessStatus: githubAccessStatus.required()
  })
}

const getParticipantById = {
  params: idParam
}

export const PARTICIPANT_VALIDATION = {
  listParticipants,
  getMyParticipant,
  createParticipant,
  updateParticipant,
  updateCheckIn,
  generateCheckInQr,
  scanCheckInQr,
  updateAttendance,
  updateGithubAccess,
  getParticipantById
}
