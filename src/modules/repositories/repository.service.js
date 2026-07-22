import mongoose from 'mongoose'

import { REPOSITORY_REPOSITORY } from './repository.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import Competition from '#models/competition.model.js'
import Round from '#models/round.model.js'
import Team from '#models/team.model.js'
import Commit from '#models/commit.model.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { GITHUB_SERVICE } from '#modules/github/github.service.js'
import { actorHasRole } from '#utils/domainAccessUtil.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'

const ensureObjectId = (id, fieldName = 'repository id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const normalizeCompetition = (competition) => {
  if (!competition) return null
  if (typeof competition === 'string' || competition instanceof mongoose.Types.ObjectId) return { id: competition.toString() }
  return {
    id: competition._id?.toString() || competition.id,
    title: competition.title,
    semester: competition.semester,
    season: competition.season,
    year: competition.year,
    status: competition.status
  }
}

const normalizeTeam = (team) => {
  if (!team) return null
  if (typeof team === 'string' || team instanceof mongoose.Types.ObjectId) return { id: team.toString() }
  return {
    id: team._id?.toString() || team.id,
    name: team.name,
    projectName: team.projectName,
    chapterName: team.chapterName,
    status: team.status,
    boardNumber: team.boardNumber,
    placementSlot: team.placementSlot
  }
}

const normalizeRound = (round) => {
  if (!round) return null
  if (typeof round === 'string' || round instanceof mongoose.Types.ObjectId) return { id: round.toString() }
  return {
    id: round._id?.toString() || round.id,
    name: round.name,
    roundType: round.roundType,
    status: round.status
  }
}

const normalizeRepository = (repository) => {
  if (!repository) return null
  const plain = typeof repository.toObject === 'function'
    ? repository.toObject({ getters: true, virtuals: false })
    : repository

  return {
    id: plain._id?.toString() || plain.id,
    competition: normalizeCompetition(plain.competitionId),
    competitionId: plain.competitionId?._id?.toString?.() || plain.competitionId?.toString?.() || plain.competitionId,
    team: normalizeTeam(plain.teamId),
    teamId: plain.teamId?._id?.toString?.() || plain.teamId?.toString?.() || plain.teamId,
    round: normalizeRound(plain.roundId),
    roundId: plain.roundId?._id?.toString?.() || plain.roundId?.toString?.() || plain.roundId || null,
    githubOwner: plain.githubOwner || plain.githubOrg,
    githubRepo: plain.githubRepo || plain.repoName,
    repositoryFullName: plain.repositoryFullName,
    repositoryUrl: plain.repositoryUrl || plain.repoUrl,
    repositoryLocalPath: plain.repositoryLocalPath || null,
    defaultBranch: plain.defaultBranch,
    latestCommitSha: plain.latestCommitSha || null,
    lastProcessedCommitSha: plain.lastProcessedCommitSha || null,
    status: plain.status,
    accessState: plain.accessState,
    accessGrantedAt: plain.accessGrantedAt || null,
    accessRevokeRequestedAt: plain.accessRevokeRequestedAt || null,
    accessRevokedAt: plain.accessRevokedAt || null,
    lastAccessRevokeError: plain.lastAccessRevokeError || null,
    webhookRegisteredAt: plain.webhookRegisteredAt || null,
    webhookStatus: plain.webhookStatus || 'NOT_CONFIGURED',
    lastWebhookRegistrationError: plain.lastWebhookRegistrationError || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  }
}

const normalizeCommit = (commit) => {
  if (!commit) return null
  const plain = typeof commit.toObject === 'function'
    ? commit.toObject({ getters: true, virtuals: false })
    : commit

  return {
    id: plain._id?.toString() || plain.id,
    repositoryId: plain.repositoryId?._id?.toString?.() || plain.repositoryId?.toString?.() || plain.repositoryId,
    commitSha: plain.commitSha,
    branch: plain.branch || null,
    provider: plain.provider || 'GITHUB',
    repositoryFullName: plain.repositoryFullName || null,
    authorName: plain.authorName || null,
    authorEmail: plain.authorEmail || null,
    authorUsername: plain.authorUsername || null,
    timestamp: plain.timestamp || null,
    message: plain.message || null,
    commitUrl: plain.commitUrl || null,
    linesAdded: plain.linesAdded || 0,
    linesRemoved: plain.linesRemoved || 0,
    filesChanged: plain.filesChanged || 0
  }
}

const buildFilter = (query = {}) => {
  const filter = {}

  if (query.competitionId) {
    ensureObjectId(query.competitionId, 'competition id')
    filter.competitionId = query.competitionId
  }
  if (query.teamId) {
    ensureObjectId(query.teamId, 'team id')
    filter.teamId = query.teamId
  }
  if (query.roundId) {
    ensureObjectId(query.roundId, 'round id')
    filter.roundId = query.roundId
  }
  if (query.status) filter.status = query.status
  if (query.accessState) filter.accessState = query.accessState
  if (query.search) {
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) {
      filter.$or = [
        { repositoryFullName: pattern },
        { githubOwner: pattern },
        { githubRepo: pattern },
        { repoName: pattern }
      ]
    }
  }

  return filter
}

const ensureCompetitionExists = async (competitionId) => {
  ensureObjectId(competitionId, 'competition id')
  const competition = await Competition.findById(competitionId)
  if (!competition) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
  return competition
}

const ensureTeamBelongsToCompetition = async ({ competitionId, teamId }) => {
  ensureObjectId(teamId, 'team id')
  const team = await Team.findById(teamId)
  if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])
  if (team.competitionId?.toString() !== competitionId.toString()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team does not belong to the specified competition'])
  }
  return team
}

const ensureRepositoryEligibleTeam = ({ team, overrideReason, actor = {} }) => {
  if (!team.status || team.status === 'CONFIRMED') return
  if (actorHasRole(actor, 'ADMIN') && overrideReason?.trim()) return

  throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Repository linking is only allowed for CONFIRMED teams unless an admin override reason is provided'])
}

const ensureRoundBelongsToCompetition = async ({ competitionId, roundId }) => {
  if (!roundId) return null
  ensureObjectId(roundId, 'round id')
  const round = await Round.findById(roundId)
  if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
  if (round.competitionId?.toString() !== competitionId.toString()) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified competition'])
  }
  return round
}

export const createRepositoryService = ({
  repository = REPOSITORY_REPOSITORY,
  githubService = GITHUB_SERVICE
} = {}) => {
  const ensureRepositoryExists = async (id) => {
    ensureObjectId(id)
    const existingRepository = await repository.findById(id)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])
    return existingRepository
  }

  const listRepositories = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildFilter(query)
    const skip = (page - 1) * limit

    const [repositories, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
    ])

    return {
      repositories: repositories.map(normalizeRepository),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getRepositoryById = async (id) => normalizeRepository(await ensureRepositoryExists(id))

  const listConfirmedTeamsMissingRepositories = async ({ competitionId }) => {
    const competition = await ensureCompetitionExists(competitionId)
    const [confirmedTeams, repositories] = await Promise.all([
      Team.find({ competitionId: competition._id, status: 'CONFIRMED' }).sort({ name: 1, createdAt: 1 }),
      repository.findAll({ filter: { competitionId: competition._id }, skip: 0, limit: 10000 })
    ])
    const teamIdsWithRepositories = new Set(repositories
      .map(item => item.teamId?._id?.toString?.() || item.teamId?.toString?.())
      .filter(Boolean))
    const teams = confirmedTeams
      .filter(team => !teamIdsWithRepositories.has(team._id.toString()))
      .map(normalizeTeam)

    return {
      competition: normalizeCompetition(competition),
      teams,
      summary: {
        confirmedTeamCount: confirmedTeams.length,
        repositoryLinkedTeamCount: teamIdsWithRepositories.size,
        missingRepositoryCount: teams.length,
        provisioningMode: 'BULK_OR_MANUAL_REQUIRED'
      }
    }
  }

  const listRepositoryCommits = async ({ repositoryId, query = {} }) => {
    const existingRepository = await ensureRepositoryExists(repositoryId)
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit

    const [commits, totalItems] = await Promise.all([
      repository.listCommitsByRepository({ repositoryId, skip, limit }),
      repository.countCommitsByRepository(repositoryId)
    ])

    return {
      repository: normalizeRepository(existingRepository),
      commits: commits.map(normalizeCommit),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const listStaticAnalysis = async ({ repositoryId, query = {} }) => {
    const existingRepository = await ensureRepositoryExists(repositoryId)
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit

    const [analysisResults, totalItems] = await Promise.all([
      repository.listStaticAnalysisByRepository({ repositoryId, skip, limit }),
      repository.countStaticAnalysisByRepository(repositoryId)
    ])

    const normalizedAnalysis = analysisResults.map(plain => {
      const obj = typeof plain.toObject === 'function' ? plain.toObject({ getters: true, virtuals: false }) : plain
      return {
        id: obj._id?.toString() || obj.id,
        repositoryId: obj.repositoryId?.toString(),
        commitSha: obj.commitSha,
        source: obj.source,
        status: obj.status,
        errorCount: obj.errorCount || 0,
        warningCount: obj.warningCount || 0,
        findings: obj.findings || [],
        rawOutput: typeof obj.rawOutput === 'string' ? obj.rawOutput : JSON.stringify(obj.rawOutput),
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
      }
    })

    return {
      repository: normalizeRepository(existingRepository),
      analysisResults: normalizedAnalysis,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const listCommitDiffs = async ({ repositoryId, query = {} }) => {
    await ensureRepositoryExists(repositoryId)
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit

    const [commitDiffs, totalItems] = await Promise.all([
      repository.listCommitDiffsByRepository({ repositoryId, skip, limit }),
      repository.countCommitDiffsByRepository(repositoryId)
    ])

    const normalized = commitDiffs.map(doc => {
      const obj = typeof doc.toObject === 'function' ? doc.toObject({ getters: true, virtuals: false }) : doc
      return {
        id: obj._id?.toString() || obj.id,
        repositoryId: obj.repositoryId?.toString(),
        commitId: obj.commitId?.toString() || null,
        baseCommitSha: obj.baseCommitSha || null,
        headCommitSha: obj.headCommitSha,
        provider: obj.provider || 'GITHUB',
        status: obj.status,
        diffHash: obj.diffHash || null,
        totalFiles: obj.totalFiles || 0,
        includedFiles: obj.includedFiles || 0,
        excludedFiles: obj.excludedFiles || 0,
        totalRawPatchSize: obj.totalRawPatchSize || 0,
        totalCleanPatchSize: obj.totalCleanPatchSize || 0,
        files: (obj.files || []).map(f => ({
          filePath: f.filePath,
          fileName: f.fileName,
          language: f.language || null,
          status: f.status,
          additions: f.additions || 0,
          deletions: f.deletions || 0,
          changes: f.changes || 0,
          isExcluded: f.isExcluded || false,
          excludedReason: f.excludedReason || null,
          isBinary: f.isBinary || false,
          isGenerated: f.isGenerated || false,
          isLockFile: f.isLockFile || false
        })),
        fetchedAt: obj.fetchedAt || null,
        lastError: obj.lastError || null,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
      }
    })

    return {
      commitDiffs: normalized,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const listImpactDecisions = async ({ repositoryId, query = {} }) => {
    await ensureRepositoryExists(repositoryId)
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit

    const [decisions, totalItems] = await Promise.all([
      repository.listImpactDecisionsByRepository({ repositoryId, skip, limit }),
      repository.countImpactDecisionsByRepository(repositoryId)
    ])

    const normalized = decisions.map(doc => {
      const obj = typeof doc.toObject === 'function' ? doc.toObject({ getters: true, virtuals: false }) : doc
      return {
        id: obj._id?.toString() || obj.id,
        repositoryId: obj.repositoryId?.toString(),
        commitSha: obj.commitSha,
        impactScore: obj.impactScore,
        impactLevel: obj.impactLevel,
        decision: obj.decision,
        reasons: obj.reasons || [],
        needsHumanReview: obj.needsHumanReview || false,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
      }
    })

    return {
      impactDecisions: normalized,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const createRepository = async (payload = {}, actor = {}) => {
    const competition = await ensureCompetitionExists(payload.competitionId)
    const team = await ensureTeamBelongsToCompetition({ competitionId: competition._id, teamId: payload.teamId })
    ensureRepositoryEligibleTeam({
      team,
      overrideReason: payload.overrideReason,
      actor
    })
    await ensureRoundBelongsToCompetition({ competitionId: competition._id, roundId: payload.roundId })

    const existingRepository = await repository.findByTeamId(payload.teamId)
    if (existingRepository) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['A repository is already linked to this team'])
    }

    const createdRepository = await repository.create({
      competitionId: payload.competitionId,
      teamId: payload.teamId,
      roundId: payload.roundId || undefined,
      githubOwner: payload.githubOwner,
      githubRepo: payload.githubRepo,
      repositoryFullName: `${payload.githubOwner}/${payload.githubRepo}`,
      repositoryUrl: payload.repositoryUrl,
      repositoryLocalPath: payload.repositoryLocalPath || undefined,
      repoUrl: payload.repositoryUrl,
      githubOrg: payload.githubOwner,
      repoName: payload.githubRepo,
      defaultBranch: payload.defaultBranch,
      latestCommitSha: payload.latestCommitSha || undefined,
      lastProcessedCommitSha: payload.lastProcessedCommitSha || undefined,
      status: payload.status,
      accessState: payload.accessState
    })

    return normalizeRepository(await repository.findById(createdRepository._id))
  }

  const updateRepository = async (id, payload = {}) => {
    const existingRepository = await ensureRepositoryExists(id)
    const competitionId = existingRepository.competitionId?._id || existingRepository.competitionId

    if (payload.roundId !== undefined) {
      await ensureRoundBelongsToCompetition({ competitionId, roundId: payload.roundId })
    }

    const githubOwner = payload.githubOwner || existingRepository.githubOwner || existingRepository.githubOrg
    const githubRepo = payload.githubRepo || existingRepository.githubRepo || existingRepository.repoName
    const repositoryUrl = payload.repositoryUrl || existingRepository.repositoryUrl || existingRepository.repoUrl

    const updatedRepository = await repository.updateById(id, {
      ...payload,
      repositoryUrl,
      repoUrl: repositoryUrl,
      githubOwner,
      githubOrg: githubOwner,
      githubRepo,
      repoName: githubRepo,
      repositoryFullName: `${githubOwner}/${githubRepo}`
    })

    return normalizeRepository(updatedRepository)
  }

  const syncRepositoryCommits = async ({ repositoryId, requestedBy = null }) => {
    const existingRepository = await ensureRepositoryExists(repositoryId)
    const competitionId = existingRepository.competitionId?._id?.toString?.() || existingRepository.competitionId?.toString?.() || existingRepository.competitionId
    const githubOwner = existingRepository.githubOwner || existingRepository.githubOrg
    const githubRepo = existingRepository.githubRepo || existingRepository.repoName
    const branch = existingRepository.defaultBranch || 'main'

    if (!githubOwner || !githubRepo) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Repository is missing GitHub owner or repo name'])
    }

    const githubToken = await githubService.getTokenForN8nDispatch({ competitionId })
    const { data } = await githubService.requestGithub({
      method: 'GET',
      path: `/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/commits?sha=${encodeURIComponent(branch)}&per_page=20`,
      token: githubToken
    })

    const commits = Array.isArray(data) ? data : []
    for (const commit of commits) {
      await Commit.findOneAndUpdate(
        {
          repositoryId,
          commitSha: commit.sha
        },
        {
          $set: {
            repositoryId,
            commitSha: commit.sha,
            branch,
            provider: 'GITHUB',
            repositoryFullName: `${githubOwner}/${githubRepo}`,
            parentCommitShas: Array.isArray(commit.parents) ? commit.parents.map(parent => parent.sha).filter(Boolean) : [],
            authorName: commit.commit?.author?.name || commit.author?.login || null,
            authorEmail: commit.commit?.author?.email || null,
            authorUsername: commit.author?.login || null,
            timestamp: commit.commit?.author?.date || null,
            message: commit.commit?.message || null,
            commitUrl: commit.html_url || null,
            linesAdded: 0,
            linesRemoved: 0,
            filesChanged: 0,
            rawStats: null
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      )
    }

    const latestCommitSha = commits[0]?.sha || existingRepository.latestCommitSha || null
    await repository.updateById(repositoryId, {
      latestCommitSha,
      lastSyncAt: new Date()
    })

    return {
      repositoryId,
      syncedCount: commits.length,
      latestCommitSha,
      requestedBy
    }
  }

  return {
    listRepositories,
    getRepositoryById,
    listConfirmedTeamsMissingRepositories,
    listRepositoryCommits,
    listStaticAnalysis,
    listCommitDiffs,
    listImpactDecisions,
    createRepository,
    updateRepository,
    syncRepositoryCommits
  }
}

export const REPOSITORY_SERVICE = createRepositoryService()
