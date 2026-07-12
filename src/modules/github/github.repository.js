import AuditLog from '#models/auditLog.model.js'
import Repository from '#models/repository.model.js'
import SystemConfiguration from '#models/systemConfiguration.model.js'
import Team from '#models/team.model.js'
import Participant from '#models/participant.model.js'

const findConfigByKey = async (key) => {
  return await SystemConfiguration.findOne({ key })
}

const upsertConfig = async ({ key, value, isEncrypted, updatedBy }) => {
  return await SystemConfiguration.findOneAndUpdate(
    { key },
    {
      $set: {
        value,
        isEncrypted,
        updatedBy
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

const createRepositoryRecord = async (data) => {
  return await Repository.findOneAndUpdate(
    { teamId: data.teamId },
    {
      $set: {
        ...data,
        githubOwner: data.githubOwner || data.githubOrg,
        githubRepo: data.githubRepo || data.repoName,
        repositoryFullName: data.repositoryFullName || `${data.githubOwner || data.githubOrg}/${data.githubRepo || data.repoName}`,
        repositoryUrl: data.repositoryUrl || data.repoUrl,
        status: data.status || 'ACTIVE',
        accessState: data.accessState || 'PENDING',
        accessGrantedAt: data.accessGrantedAt,
        accessRevokedAt: data.accessRevokedAt,
        webhookRegisteredAt: data.webhookRegisteredAt,
        webhookStatus: data.webhookStatus || 'NOT_CONFIGURED',
        lastWebhookRegistrationError: data.lastWebhookRegistrationError || null
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

const findRepositoryByEventAndRepoName = async ({ eventId, repoName, githubOwner }) => {
  const ownerFilter = githubOwner
    ? [{ githubOwner }, { githubOrg: githubOwner }]
    : [{}]

  return await Repository.findOne({
    eventId,
    $or: ownerFilter.flatMap((ownerClause) => ([
      { ...ownerClause, repoName },
      { ...ownerClause, githubRepo: repoName }
    ]))
  })
}

const updateRepositoryById = async (id, data) => {
  return await Repository.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  })
}

const createAuditLog = async ({ userId, action, resourceType, resourceId, metadata }) => {
  return await AuditLog.create({
    userId,
    action,
    resourceType,
    resourceId,
    metadata
  })
}

const findConfirmedTeamsByEvent = async (eventId) => {
  return await Team.find({
    eventId,
    status: 'CONFIRMED'
  })
}

const findTeamById = async (teamId) => {
  return await Team.findById(teamId)
}

const findRepositoriesByEvent = async (eventId) => {
  return await Repository.find({ eventId }).populate({ path: 'teamId', select: 'status name eventId' })
}

const findTeamMembersGithubUsernames = async (teamId) => {
  const participants = await Participant.find({
    teamId,
    status: { $in: ['JOINED'] }
  }).populate('userId')

  return participants
    .map((p) => p.userId?.githubUsername)
    .filter(Boolean)
}

export const GITHUB_REPOSITORY = {
  findConfigByKey,
  upsertConfig,
  createRepositoryRecord,
  findRepositoryByEventAndRepoName,
  updateRepositoryById,
  createAuditLog,
  findConfirmedTeamsByEvent,
  findTeamById,
  findRepositoriesByEvent,
  findTeamMembersGithubUsernames
}
