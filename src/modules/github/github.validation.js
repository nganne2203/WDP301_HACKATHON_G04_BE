import Joi from 'joi'

const githubName = Joi.string().trim().min(1).max(100).pattern(/^[A-Za-z0-9_.-]+$/)
const githubUsername = Joi.string().trim().min(1).max(39).pattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)
const objectId = Joi.string().hex().length(24)

const eventQuery = {
  query: Joi.object({
    eventId: objectId.required()
  })
}

const saveConfig = {
  body: Joi.object({
    eventId: objectId.required(),
    organizationName: githubName.required(),
    ownerUsername: githubUsername.required(),
    githubToken: Joi.string().trim().allow('', null),
    enabled: Joi.boolean().required()
  })
}

const testConnection = {
  body: Joi.object({
    eventId: objectId.required()
  })
}

const createRepository = {
  body: Joi.object({
    eventId: objectId.required(),
    repoName: githubName.required(),
    description: Joi.string().trim().max(500).allow('', null),
    private: Joi.boolean().default(true),
    teamId: objectId,
    roundId: objectId.allow(null)
  })
}

const assignCollaborator = {
  params: Joi.object({
    repoName: githubName.required(),
    username: githubUsername.required()
  }),
  body: Joi.object({
    eventId: objectId.required(),
    permission: Joi.string().trim().valid('pull', 'triage', 'push', 'maintain', 'admin').default('push')
  })
}

const inviteOrganizationMember = {
  body: Joi.object({
    eventId: objectId.required(),
    email: Joi.string().email().trim().lowercase().required(),
    role: Joi.string().trim().valid('direct_member').default('direct_member')
  })
}

const revokeMembers = {
  body: Joi.object({
    eventId: objectId.required(),
    confirmationText: Joi.string().valid('REVOKE MEMBERS').required()
  })
}

export const GITHUB_VALIDATION = {
  eventQuery,
  saveConfig,
  testConnection,
  createRepository,
  assignCollaborator,
  inviteOrganizationMember,
  revokeMembers
}
