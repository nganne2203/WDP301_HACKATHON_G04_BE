import AuditLog from '#models/auditLog.model.js'
import Repository from '#models/repository.model.js'
import SystemConfiguration from '#models/systemConfiguration.model.js'

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
        accessState: data.accessState || 'GRANTED'
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

const createAuditLog = async ({ userId, action, resourceType, resourceId, metadata }) => {
  return await AuditLog.create({
    userId,
    action,
    resourceType,
    resourceId,
    metadata
  })
}

export const GITHUB_REPOSITORY = {
  findConfigByKey,
  upsertConfig,
  createRepositoryRecord,
  createAuditLog
}
