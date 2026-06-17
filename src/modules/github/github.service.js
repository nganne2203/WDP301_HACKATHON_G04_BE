import { GITHUB_REPOSITORY } from './github.repository.js'
import ApiError from '#utils/ApiError.js'
import { env } from '#configs/environment.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { ENCRYPTION_UTILS } from '#utils/encryption.util.js'
import { LOGGER } from '#utils/logger.js'

const buildEventConfigKey = (eventId) => `github.event.${eventId}.organization`

const GITHUB_API_BASE_URL = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'

const normalizeString = (value) => {
  return typeof value === 'string' ? value.trim() : value
}

const normalizeConfig = (record, eventId) => {
  const value = record?.value || {}

  return {
    eventId: value.eventId || eventId,
    organizationName: value.organizationName || '',
    ownerUsername: value.ownerUsername || '',
    enabled: Boolean(value.enabled),
    hasToken: Boolean(value.tokenEncrypted)
  }
}

const getGithubErrorMessage = (data, fallback) => {
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.message) return data.message
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map(error => error.message || error.code || JSON.stringify(error)).join(', ')
  }

  return fallback
}

const createGithubClient = ({ fetchImpl = globalThis.fetch } = {}) => {
  if (!fetchImpl) {
    throw new Error('Fetch API is not available in this Node.js runtime')
  }

  return async ({ method = 'GET', path, token, body }) => {
    const response = await fetchImpl(`${GITHUB_API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const text = await response.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!response.ok) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [
        `GitHub API error (${response.status}): ${getGithubErrorMessage(data, response.statusText)}`
      ])
    }

    return {
      data,
      status: response.status,
      headers: response.headers
    }
  }
}

const sanitizeMetadata = (metadata = {}) => {
  const safeMetadata = { ...metadata }
  delete safeMetadata.githubToken
  delete safeMetadata.token
  delete safeMetadata.encryptedToken
  delete safeMetadata.tokenEncrypted
  return safeMetadata
}

const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '')

const buildWebhookCallbackUrl = () => {
  if (env.github.webhookCallbackUrl) return trimTrailingSlash(env.github.webhookCallbackUrl)
  if (!env.server.publicUrl) return null
  return `${trimTrailingSlash(env.server.publicUrl)}/api/github/webhooks`
}

export const createGithubService = ({
  repository = GITHUB_REPOSITORY,
  encryption = ENCRYPTION_UTILS,
  githubClient = createGithubClient(),
  logger = LOGGER
} = {}) => {
  const audit = async ({ actor, action, resourceType = 'GitHub', resourceId, metadata = {} }) => {
    try {
      await repository.createAuditLog({
        userId: actor?.id,
        action,
        resourceType,
        resourceId,
        metadata: sanitizeMetadata(metadata)
      })
    } catch (error) {
      logger.error('GitHub audit log creation failed', {
        action,
        error: error.message
      })
    }
  }

  const loadConfigRecord = async (eventId) => {
    if (!eventId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['eventId is required for GitHub configuration'])
    }

    return await repository.findConfigByKey(buildEventConfigKey(eventId))
  }

  const getConfig = async (eventId) => {
    return normalizeConfig(await loadConfigRecord(eventId), eventId)
  }

  const saveConfig = async (payload = {}, actor = {}) => {
    const existingRecord = await loadConfigRecord(payload.eventId)
    const existingValue = existingRecord?.value || {}
    const nextToken = normalizeString(payload.githubToken)
    let tokenEncrypted = existingValue.tokenEncrypted

    if (nextToken) {
      try {
        tokenEncrypted = encryption.encrypt(nextToken)
      } catch (error) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, [
          `Could not encrypt GitHub token: ${error.message}`
        ])
      }
    }

    const configRecord = await repository.upsertConfig({
      key: buildEventConfigKey(payload.eventId),
      value: {
        eventId: payload.eventId,
        organizationName: normalizeString(payload.organizationName),
        ownerUsername: normalizeString(payload.ownerUsername),
        tokenEncrypted,
        enabled: Boolean(payload.enabled)
      },
      isEncrypted: Boolean(tokenEncrypted),
      updatedBy: actor.id
    })

    await audit({
      actor,
      action: 'GITHUB_CONFIG_SAVE',
      resourceType: 'SystemConfiguration',
      resourceId: payload.eventId,
      metadata: {
        eventId: payload.eventId,
        organizationName: payload.organizationName,
        ownerUsername: payload.ownerUsername,
        enabled: Boolean(payload.enabled),
        tokenUpdated: Boolean(nextToken),
        hadTokenBeforeUpdate: Boolean(existingValue.tokenEncrypted)
      }
    })

    return normalizeConfig(configRecord, payload.eventId)
  }

  const loadOperationalConfig = async ({ eventId, requireEnabled = true, requireOwner = false } = {}) => {
    const record = await loadConfigRecord(eventId)
    const safeConfig = normalizeConfig(record, eventId)
    const value = record?.value || {}

    if (requireEnabled && !safeConfig.enabled) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub integration is disabled for this event'])
    }

    if (!safeConfig.organizationName) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub organization name is not configured for this event'])
    }

    if (requireOwner && !safeConfig.ownerUsername) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub owner username is not configured for this event'])
    }

    const encryptedToken = value.tokenEncrypted
    if (!encryptedToken) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub token is not configured for this event'])
    }

    let token
    try {
      token = encryption.decrypt(encryptedToken)
    } catch (error) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [
        `Could not decrypt GitHub token: ${error.message}`
      ])
    }

    return {
      ...safeConfig,
      token
    }
  }

  const requestGithub = async ({ method, path, token, body }) => {
    return await githubClient({ method, path, token, body })
  }

  const updateInternalRepository = async ({ eventId, organizationName, repoName, updates }) => {
    const linkedRepository = await repository.findRepositoryByEventAndRepoName({
      eventId,
      repoName,
      githubOwner: organizationName
    })

    if (!linkedRepository) return null
    return await repository.updateRepositoryById(linkedRepository._id, updates)
  }

  const registerRepositoryWebhook = async ({ eventId, repoName }, actor = {}) => {
    const config = await loadOperationalConfig({ eventId })
    const callbackUrl = buildWebhookCallbackUrl()

    if (!callbackUrl) {
      const errorMessage = 'Webhook callback URL is not configured'
      await updateInternalRepository({
        eventId,
        organizationName: config.organizationName,
        repoName,
        updates: {
          webhookStatus: 'FAILED',
          lastWebhookRegistrationError: errorMessage
        }
      })

      throw new ApiError(ERROR_CODES.BAD_REQUEST, [errorMessage])
    }

    if (!env.github.webhookSecret) {
      const errorMessage = 'GITHUB_WEBHOOK_SECRET is not configured'
      await updateInternalRepository({
        eventId,
        organizationName: config.organizationName,
        repoName,
        updates: {
          webhookStatus: 'FAILED',
          lastWebhookRegistrationError: errorMessage
        }
      })

      throw new ApiError(ERROR_CODES.BAD_REQUEST, [errorMessage])
    }

    const body = {
      name: 'web',
      active: true,
      events: env.github.webhookEvents,
      config: {
        url: callbackUrl,
        content_type: 'json',
        secret: env.github.webhookSecret,
        insecure_ssl: '0'
      }
    }

    const { data, status } = await requestGithub({
      method: 'POST',
      path: `/repos/${encodeURIComponent(config.organizationName)}/${encodeURIComponent(repoName)}/hooks`,
      token: config.token,
      body
    })

    await updateInternalRepository({
      eventId,
      organizationName: config.organizationName,
      repoName,
      updates: {
        webhookStatus: 'REGISTERED',
        webhookRegisteredAt: new Date(),
        lastWebhookRegistrationError: null
      }
    })

    await audit({
      actor,
      action: 'GITHUB_WEBHOOK_REGISTER',
      resourceId: eventId,
      metadata: {
        eventId,
        organizationName: config.organizationName,
        repoName,
        callbackUrl,
        events: env.github.webhookEvents,
        status,
        hookId: data?.id || null
      }
    })

    return {
      repoName,
      callbackUrl,
      events: env.github.webhookEvents,
      hookId: data?.id || null,
      active: data?.active !== false
    }
  }

  const testConnection = async ({ eventId }, actor = {}) => {
    const config = await loadOperationalConfig({ eventId, requireEnabled: false })
    const { data, status } = await requestGithub({
      method: 'GET',
      path: `/orgs/${encodeURIComponent(config.organizationName)}`,
      token: config.token
    })

    await audit({
      actor,
      action: 'GITHUB_CONFIG_TEST',
      resourceId: eventId,
      metadata: {
        eventId,
        organizationName: config.organizationName,
        status
      }
    })

    return {
      organizationName: data?.login || config.organizationName,
      ownerUsername: config.ownerUsername,
      eventId,
      enabled: config.enabled,
      accessible: true,
      htmlUrl: data?.html_url,
      id: data?.id
    }
  }

  const createRepository = async (payload = {}, actor = {}) => {
    const config = await loadOperationalConfig({ eventId: payload.eventId })
    const requestBody = {
      name: payload.repoName,
      description: payload.description || '',
      private: payload.private !== false,
      auto_init: true
    }

    const { data, status } = await requestGithub({
      method: 'POST',
      path: `/orgs/${encodeURIComponent(config.organizationName)}/repos`,
      token: config.token,
      body: requestBody
    })

    let linkedRepository = null
    if (payload.teamId) {
      linkedRepository = await repository.createRepositoryRecord({
        eventId: payload.eventId,
        teamId: payload.teamId,
        roundId: payload.roundId,
        githubOwner: config.organizationName,
        githubRepo: data?.name || payload.repoName,
        repositoryFullName: `${config.organizationName}/${data?.name || payload.repoName}`,
        repositoryUrl: data?.html_url,
        githubOrg: config.organizationName,
        repoName: data?.name || payload.repoName,
        repoUrl: data?.html_url,
        defaultBranch: data?.default_branch || 'main',
        status: 'ACTIVE',
        accessState: 'PENDING',
        webhookStatus: 'PENDING',
        accessGrantedAt: null,
        accessRevokedAt: null
      })

      if (payload.assignCollaborators !== false) {
        try {
          const githubUsernames = await repository.findTeamMembersGithubUsernames(payload.teamId)
          for (const username of githubUsernames) {
            try {
              await assignCollaborator({
                eventId: payload.eventId,
                repoName: data?.name || payload.repoName,
                username,
                permission: 'push'
              }, actor)
            } catch (collabError) {
              logger.warn('Failed to auto-assign team member as collaborator upon repo creation', {
                repoName: data?.name || payload.repoName,
                username,
                error: collabError.message
              })
            }
          }
        } catch (err) {
          logger.error('Failed to resolve team members for auto-collaborator assignment upon repo creation', {
            teamId: payload.teamId,
            error: err.message
          })
        }
      }
    }

    let webhookRegistration = null
    try {
      webhookRegistration = await registerRepositoryWebhook({
        eventId: payload.eventId,
        repoName: data?.name || payload.repoName
      }, actor)
    } catch (error) {
      logger.warn('Repository created but webhook registration failed', {
        repoName: data?.name || payload.repoName,
        error: error.message
      })
    }

    await audit({
      actor,
      action: 'GITHUB_REPOSITORY_CREATE',
      resourceId: payload.eventId,
      metadata: {
        eventId: payload.eventId,
        organizationName: config.organizationName,
        repoName: data?.name || payload.repoName,
        private: requestBody.private,
        status,
        teamId: payload.teamId,
        repositoryId: linkedRepository?._id?.toString?.() || linkedRepository?.id || null
      }
    })

    return {
      repoName: data?.name || payload.repoName,
      htmlUrl: data?.html_url,
      cloneUrl: data?.clone_url,
      visibility: data?.visibility || (data?.private ? 'private' : 'public'),
      webhookRegistration
    }
  }

  const assignCollaborator = async ({ eventId, repoName, username, permission }, actor = {}) => {
    const config = await loadOperationalConfig({ eventId })
    const { status } = await requestGithub({
      method: 'PUT',
      path: `/repos/${encodeURIComponent(config.organizationName)}/${encodeURIComponent(repoName)}/collaborators/${encodeURIComponent(username)}`,
      token: config.token,
      body: { permission }
    })

    await audit({
      actor,
      action: 'GITHUB_COLLABORATOR_ASSIGN',
      resourceId: eventId,
      metadata: {
        eventId,
        organizationName: config.organizationName,
        repoName,
        username,
        permission,
        status
      }
    })

    await updateInternalRepository({
      eventId,
      organizationName: config.organizationName,
      repoName,
      updates: {
        accessState: 'GRANTED',
        accessGrantedAt: new Date(),
        accessRevokedAt: null
      }
    })

    try {
      const userObj = await mongoose.model('User').findOne({
        githubUsername: { $regex: new RegExp('^' + username + '$', 'i') }
      })
      if (userObj) {
        await mongoose.model('Participant').findOneAndUpdate(
          { eventId, userId: userObj._id },
          { $set: { githubAccessStatus: 'GRANTED' } }
        )
      }
    } catch (err) {
      logger.warn('Failed to update participant githubAccessStatus in assignCollaborator', {
        username,
        error: err.message
      })
    }

    return {
      repoName,
      username,
      permission,
      status: status === 204 ? 'already_collaborator' : 'invited_or_added'
    }
  }

  const revokeCollaborator = async ({ eventId, repoName, username }, actor = {}) => {
    const config = await loadOperationalConfig({ eventId })
    await requestGithub({
      method: 'DELETE',
      path: `/repos/${encodeURIComponent(config.organizationName)}/${encodeURIComponent(repoName)}/collaborators/${encodeURIComponent(username)}`,
      token: config.token
    })

    await updateInternalRepository({
      eventId,
      organizationName: config.organizationName,
      repoName,
      updates: {
        accessState: 'REVOKED',
        accessRevokedAt: new Date()
      }
    })

    try {
      const userObj = await mongoose.model('User').findOne({
        githubUsername: { $regex: new RegExp('^' + username + '$', 'i') }
      })
      if (userObj) {
        await mongoose.model('Participant').findOneAndUpdate(
          { eventId, userId: userObj._id },
          { $set: { githubAccessStatus: 'REVOKED' } }
        )
      }
    } catch (err) {
      logger.warn('Failed to update participant githubAccessStatus in revokeCollaborator', {
        username,
        error: err.message
      })
    }

    await audit({
      actor,
      action: 'GITHUB_COLLABORATOR_REVOKE',
      resourceId: eventId,
      metadata: {
        eventId,
        organizationName: config.organizationName,
        repoName,
        username
      }
    })

    return {
      repoName,
      username,
      status: 'revoked'
    }
  }

  const inviteOrganizationMember = async ({ eventId, email, role }, actor = {}) => {
    const config = await loadOperationalConfig({ eventId })
    const { data, status } = await requestGithub({
      method: 'POST',
      path: `/orgs/${encodeURIComponent(config.organizationName)}/invitations`,
      token: config.token,
      body: { email, role }
    })

    await audit({
      actor,
      action: 'GITHUB_ORG_MEMBER_INVITE',
      resourceId: eventId,
      metadata: {
        eventId,
        organizationName: config.organizationName,
        email,
        role,
        status
      }
    })

    return {
      id: data?.id,
      email: data?.email || email,
      role: data?.role || role,
      invitationUrl: data?.html_url
    }
  }

  const listOrganizationMembers = async ({ organizationName, token }) => {
    const members = []
    let page = 1
    let hasNextPage = true

    while (hasNextPage) {
      const { data } = await requestGithub({
        method: 'GET',
        path: `/orgs/${encodeURIComponent(organizationName)}/members?per_page=100&page=${page}`,
        token
      })

      const pageMembers = Array.isArray(data) ? data : []
      members.push(...pageMembers)
      hasNextPage = pageMembers.length === 100
      page += 1
    }

    return members
  }

  const revokeMembers = async ({ eventId, confirmationText }, actor = {}) => {
    if (confirmationText !== 'REVOKE MEMBERS') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Confirmation text must be REVOKE MEMBERS'])
    }

    const config = await loadOperationalConfig({ eventId, requireOwner: true })
    const members = await listOrganizationMembers({
      organizationName: config.organizationName,
      token: config.token
    })
    const removed = []
    const skipped = []
    const failed = []
    const ownerUsername = String(config.ownerUsername).toLowerCase()

    for (const member of members) {
      const username = member?.login
      if (!username) continue

      if (username.toLowerCase() === ownerUsername) {
        skipped.push(username)
        continue
      }

      try {
        await requestGithub({
          method: 'DELETE',
          path: `/orgs/${encodeURIComponent(config.organizationName)}/members/${encodeURIComponent(username)}`,
          token: config.token
        })
        removed.push(username)
      } catch (error) {
        failed.push({
          username,
          reason: error.errors?.[0] || error.message
        })
      }
    }

    const result = { removed, skipped, failed }
    logger.info('GitHub organization members revoke completed', {
      organizationName: config.organizationName,
      removed,
      skipped,
      failed
    })

    await audit({
      actor,
      action: 'GITHUB_ORG_MEMBERS_REVOKE',
      resourceId: eventId,
      metadata: {
        eventId,
        organizationName: config.organizationName,
        removed,
        skipped,
        failed
      }
    })

    return result
  }

  const bulkCreateRepositories = async (payload = {}, actor = {}) => {
    const config = await loadOperationalConfig({ eventId: payload.eventId })
    const teams = await repository.findConfirmedTeamsByEvent(payload.eventId)
    const existingRepos = await repository.findRepositoriesByEvent(payload.eventId)
    const existingTeamIds = new Set(existingRepos.map((r) => r.teamId.toString()))

    const teamsToCreate = teams.filter((team) => !existingTeamIds.has(team._id.toString()))

    const success = []
    const failed = []

    for (const team of teamsToCreate) {
      let repoName = String(team.name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

      if (!repoName) {
        repoName = `team-${team._id.toString().slice(-6)}`
      }

      try {
        const repoResult = await createRepository({
          eventId: payload.eventId,
          teamId: team._id.toString(),
          roundId: payload.roundId === 'none' ? null : payload.roundId,
          repoName,
          description: `Repository for team ${team.name}`,
          private: true,
          assignCollaborators: payload.assignCollaborators
        }, actor)

        success.push({
          teamId: team._id.toString(),
          teamName: team.name,
          repoName: repoResult.repoName,
          htmlUrl: repoResult.htmlUrl
        })
      } catch (error) {
        failed.push({
          teamId: team._id.toString(),
          teamName: team.name,
          error: error.message || 'Unknown error during repository creation'
        })
      }
    }

    await audit({
      actor,
      action: 'GITHUB_REPOSITORIES_BULK_CREATE',
      resourceId: payload.eventId,
      metadata: {
        eventId: payload.eventId,
        roundId: payload.roundId,
        totalTeamsChecked: teams.length,
        totalReposCreated: success.length,
        successCount: success.length,
        failedCount: failed.length
      }
    })

    return {
      totalTeamsChecked: teams.length,
      totalReposCreated: success.length,
      success,
      failed
    }
  }

  const bulkGrantAccess = async (payload = {}, actor = {}) => {
    const config = await loadOperationalConfig({ eventId: payload.eventId })
    const repos = await repository.findRepositoriesByEvent(payload.eventId)

    const success = []
    const failed = []

    for (const repo of repos) {
      const repoName = repo.repoName || repo.githubRepo
      if (!repoName) continue

      try {
        const usernames = await repository.findTeamMembersGithubUsernames(repo.teamId)
        for (const username of usernames) {
          try {
            await assignCollaborator({
              eventId: payload.eventId,
              repoName,
              username,
              permission: 'push'
            }, actor)
            success.push({ repoName, username })
          } catch (collabError) {
            failed.push({ repoName, username, error: collabError.message })
          }
        }
      } catch (err) {
        failed.push({ repoName, error: `Failed to resolve team members: ${err.message}` })
      }
    }

    await audit({
      actor,
      action: 'GITHUB_COLLABORATORS_BULK_GRANT',
      resourceId: payload.eventId,
      metadata: {
        eventId: payload.eventId,
        successCount: success.length,
        failedCount: failed.length
      }
    })

    return { success, failed }
  }

  const bulkRevokeAccess = async (payload = {}, actor = {}) => {
    const config = await loadOperationalConfig({ eventId: payload.eventId })
    const repos = await repository.findRepositoriesByEvent(payload.eventId)

    const success = []
    const failed = []

    for (const repo of repos) {
      const repoName = repo.repoName || repo.githubRepo
      if (!repoName) continue

      try {
        const usernames = await repository.findTeamMembersGithubUsernames(repo.teamId)
        for (const username of usernames) {
          try {
            await revokeCollaborator({
              eventId: payload.eventId,
              repoName,
              username
            }, actor)
            success.push({ repoName, username })
          } catch (collabError) {
            failed.push({ repoName, username, error: collabError.message })
          }
        }
      } catch (err) {
        failed.push({ repoName, error: `Failed to resolve team members: ${err.message}` })
      }
    }

    await audit({
      actor,
      action: 'GITHUB_COLLABORATORS_BULK_REVOKE',
      resourceId: payload.eventId,
      metadata: {
        eventId: payload.eventId,
        successCount: success.length,
        failedCount: failed.length
      }
    })

    return { success, failed }
  }

  return {
    getConfig,
    saveConfig,
    testConnection,
    createRepository,
    assignCollaborator,
    registerRepositoryWebhook,
    revokeCollaborator,
    inviteOrganizationMember,
    revokeMembers,
    bulkCreateRepositories,
    bulkGrantAccess,
    bulkRevokeAccess
  }
}

export const GITHUB_SERVICE = createGithubService()
