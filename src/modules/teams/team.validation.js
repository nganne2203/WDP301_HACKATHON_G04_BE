import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const email = Joi.string().email().trim().lowercase()
const token = Joi.string().trim().min(32).max(256)
const teamStatus = Joi.string().trim().uppercase().valid('PENDING', 'WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'DISQUALIFIED')
const trackAssignmentMethod = Joi.string().trim().uppercase().valid('DRAW', 'MANUAL', 'SYSTEM')
const githubUsername = Joi.string().trim().min(1).max(39).pattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)

const invitedMember = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  email: email.required(),
  githubUsername: githubUsername.required()
})

const idParam = Joi.object({
  id: objectId.required()
})

const teamInvitationParam = Joi.object({
  teamId: objectId.required(),
  invitationId: objectId.required()
})

const tokenParam = Joi.object({
  token: token.required()
})

const listTeams = {
  query: Joi.object({
    eventId: objectId,
    trackId: objectId,
    boardNumber: Joi.number().integer().min(1),
    status: teamStatus,
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
}

const createTeam = {
  body: Joi.object({
    eventId: objectId.required(),
    name: Joi.string().trim().min(2).max(120).required(),
    trackId: objectId.allow(null),
    chapterName: Joi.string().trim().max(120).allow('', null),
    projectName: Joi.string().trim().max(200).allow('', null),
    invitedEmails: Joi.array().items(email).max(20).unique().default([]),
    invitedMembers: Joi.array().items(invitedMember).max(20).default([])
  })
}

const inviteMembers = {
  params: idParam,
  body: Joi.object({
    emails: Joi.array().items(email).max(20).unique().default([]),
    members: Joi.array().items(invitedMember).max(20).default([])
  }).custom((value, helpers) => {
    if ((value.emails?.length || 0) + (value.members?.length || 0) === 0) {
      return helpers.error('any.custom', { message: 'At least one invited member is required' })
    }

    return value
  })
}

const getMyTeam = {
  query: Joi.object({
    eventId: objectId.required()
  })
}

const checkTeamAvailability = {
  query: Joi.object({
    eventId: objectId.required(),
    name: Joi.string().trim().min(2).max(120).required()
  })
}

const replaceInvitation = {
  params: teamInvitationParam,
  body: Joi.object({
    email: email.required()
  })
}

const cancelInvitation = {
  params: teamInvitationParam
}

const getTeamById = {
  params: idParam
}

const updateTeamStatus = {
  params: idParam,
  body: Joi.object({
    status: teamStatus.required(),
    trackId: objectId.allow(null),
    rejectionReason: Joi.string().trim().max(500).allow('', null)
  })
}

const updateTeamPlacement = {
  params: idParam,
  body: Joi.object({
    trackId: objectId.allow(null),
    trackAssignmentMethod
  }).min(1)
}

const updateTeamMentors = {
  params: idParam,
  body: Joi.object({
    mentorIds: Joi.array().items(objectId).unique().required()
  })
}

const assignMentorsByBoard = {
  body: Joi.object({
    eventId: objectId.required(),
    boardNumber: Joi.number().integer().min(1).required(),
    mentorIds: Joi.array().items(objectId).unique().required()
  })
}

const getEventCapacity = {
  params: Joi.object({
    eventId: objectId.required()
  })
}

const acceptInvitation = {
  params: tokenParam
}

const declineInvitation = {
  params: tokenParam
}

export const TEAM_VALIDATION = {
  listTeams,
  createTeam,
  inviteMembers,
  getMyTeam,
  checkTeamAvailability,
  replaceInvitation,
  cancelInvitation,
  getTeamById,
  updateTeamStatus,
  updateTeamPlacement,
  updateTeamMentors,
  assignMentorsByBoard,
  getEventCapacity,
  acceptInvitation,
  declineInvitation
}
