import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const repositoryStatus = Joi.string().trim().uppercase().valid('PENDING', 'ACTIVE', 'ARCHIVED', 'DISCONNECTED')
const accessState = Joi.string().trim().uppercase().valid('UNKNOWN', 'PENDING', 'GRANTED', 'REVOKED')

const idParam = Joi.object({
  id: objectId.required()
})

const listRepositories = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    eventId: objectId,
    teamId: objectId,
    roundId: objectId,
    status: repositoryStatus,
    accessState,
    search: Joi.string().trim().max(100)
  })
}

const createRepository = {
  body: Joi.object({
    eventId: objectId.required(),
    teamId: objectId.required(),
    roundId: objectId.allow(null),
    githubOwner: Joi.string().trim().min(1).max(100).required(),
    githubRepo: Joi.string().trim().min(1).max(100).required(),
    repositoryUrl: Joi.string().uri().required(),
    defaultBranch: Joi.string().trim().min(1).max(100).default('main'),
    latestCommitSha: Joi.string().trim().max(100).allow('', null),
    lastProcessedCommitSha: Joi.string().trim().max(100).allow('', null),
    status: repositoryStatus.default('ACTIVE'),
    accessState: accessState.default('UNKNOWN')
  })
}

const updateRepository = {
  params: idParam,
  body: Joi.object({
    roundId: objectId.allow(null),
    defaultBranch: Joi.string().trim().min(1).max(100),
    latestCommitSha: Joi.string().trim().max(100).allow('', null),
    lastProcessedCommitSha: Joi.string().trim().max(100).allow('', null),
    status: repositoryStatus,
    accessState,
    repositoryUrl: Joi.string().uri(),
    githubOwner: Joi.string().trim().min(1).max(100),
    githubRepo: Joi.string().trim().min(1).max(100)
  }).min(1)
}

const getRepositoryById = {
  params: idParam
}

export const REPOSITORY_VALIDATION = {
  listRepositories,
  createRepository,
  updateRepository,
  getRepositoryById
}
