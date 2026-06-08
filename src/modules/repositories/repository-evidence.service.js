import crypto from 'node:crypto'
import path from 'node:path'

import { Octokit } from '@octokit/rest'

import { REPOSITORY_EVIDENCE_REPOSITORY } from './repository-evidence.repository.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { JOB_TYPES } from '#constants/queue.js'
import { ENCRYPTION_UTILS } from '#utils/encryption.util.js'
import ApiError from '#utils/ApiError.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'

const PATCH_LIMIT_PER_FILE = 4000
const TOTAL_CLEAN_DIFF_LIMIT = 20000
const LARGE_LOCKFILE_PATCH_LIMIT = 3000
const COMMIT_PAGE_SIZE = 10

const GENERATED_PATH_SEGMENTS = ['node_modules/', 'dist/', 'build/', '.next/', 'coverage/', 'vendor/', 'generated/', '__generated__/']
const LOCK_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'])

const LANGUAGE_BY_EXTENSION = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.py': 'Python',
  '.java': 'Java',
  '.cs': 'C#',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.html': 'HTML',
  '.vue': 'Vue',
  '.sql': 'SQL',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.xml': 'XML',
  '.sh': 'Shell',
  '.dockerfile': 'Dockerfile'
}

const buildEventConfigKey = (eventId) => `github.event.${eventId}.organization`

const ensureObjectIdString = (value, fieldName) => {
  if (!value) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`${fieldName} is required`])
  }
}

const normalizeRepository = (repository) => {
  if (!repository) return null
  const plain = typeof repository.toObject === 'function'
    ? repository.toObject({ getters: true, virtuals: false })
    : repository

  return {
    id: plain._id?.toString() || plain.id,
    repositoryFullName: plain.repositoryFullName,
    githubOwner: plain.githubOwner || plain.githubOrg,
    githubRepo: plain.githubRepo || plain.repoName,
    defaultBranch: plain.defaultBranch,
    latestCommitSha: plain.latestCommitSha || null,
    lastProcessedCommitSha: plain.lastProcessedCommitSha || null,
    eventId: plain.eventId?._id?.toString?.() || plain.eventId?.toString?.() || plain.eventId
  }
}

const normalizeCommit = (commit) => {
  const plain = typeof commit?.toObject === 'function'
    ? commit.toObject({ getters: true, virtuals: false })
    : commit

  return {
    id: plain?._id?.toString() || plain?.id,
    repositoryId: plain?.repositoryId?._id?.toString?.() || plain?.repositoryId?.toString?.() || plain?.repositoryId,
    commitSha: plain?.commitSha,
    branch: plain?.branch || null,
    provider: plain?.provider,
    repositoryFullName: plain?.repositoryFullName || plain?.repositoryId?.repositoryFullName || null,
    authorName: plain?.authorName || null,
    authorEmail: plain?.authorEmail || null,
    authorUsername: plain?.authorUsername || null,
    timestamp: plain?.timestamp || null,
    message: plain?.message || null,
    commitUrl: plain?.commitUrl || null,
    linesAdded: plain?.linesAdded || 0,
    linesRemoved: plain?.linesRemoved || 0,
    filesChanged: plain?.filesChanged || 0
  }
}

const normalizeCommitDiff = (commitDiff) => {
  const plain = typeof commitDiff?.toObject === 'function'
    ? commitDiff.toObject({ getters: true, virtuals: false })
    : commitDiff

  return {
    id: plain?._id?.toString() || plain?.id,
    repositoryId: plain?.repositoryId?._id?.toString?.() || plain?.repositoryId?.toString?.() || plain?.repositoryId,
    commitId: plain?.commitId?._id?.toString?.() || plain?.commitId?.toString?.() || plain?.commitId || null,
    baseCommitSha: plain?.baseCommitSha || null,
    headCommitSha: plain?.headCommitSha || null,
    provider: plain?.provider,
    status: plain?.status,
    totalFiles: plain?.totalFiles || 0,
    includedFiles: plain?.includedFiles || 0,
    excludedFiles: plain?.excludedFiles || 0,
    totalCleanPatchSize: plain?.totalCleanPatchSize || 0,
    fetchedAt: plain?.fetchedAt || null,
    patchSummary: `${plain?.includedFiles || 0} included / ${plain?.excludedFiles || 0} excluded files`,
    files: (plain?.files || []).map(file => ({
      filePath: file.filePath,
      previousFilePath: file.previousFilePath || null,
      fileName: file.fileName || null,
      language: file.language || null,
      status: file.status,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      cleanPatch: file.cleanPatch || '',
      patchSummary: file.patchSummary || '',
      excludedReason: file.excludedReason || null,
      isExcluded: Boolean(file.isExcluded),
      isBinary: Boolean(file.isBinary),
      isGenerated: Boolean(file.isGenerated),
      isMinified: Boolean(file.isMinified),
      isBuildArtifact: Boolean(file.isBuildArtifact),
      isLockFile: Boolean(file.isLockFile),
      isTruncated: Boolean(file.isTruncated),
      cleanPatchSize: file.cleanPatchSize || 0,
      hunkCount: file.hunkCount || 0,
      addedLineCount: file.addedLineCount || 0,
      removedLineCount: file.removedLineCount || 0
    }))
  }
}

const parsePatchStats = (patch = '') => {
  const lines = patch.split('\n')
  let hunkCount = 0
  let addedLineCount = 0
  let removedLineCount = 0

  for (const line of lines) {
    if (line.startsWith('@@')) hunkCount += 1
    if (line.startsWith('+') && !line.startsWith('+++')) addedLineCount += 1
    if (line.startsWith('-') && !line.startsWith('---')) removedLineCount += 1
  }

  return {
    hunkCount,
    addedLineCount,
    removedLineCount
  }
}

const detectLanguage = (filePath = '') => {
  const baseName = path.basename(filePath).toLowerCase()
  if (baseName === 'dockerfile') return 'Dockerfile'
  return LANGUAGE_BY_EXTENSION[path.extname(baseName)] || 'Unknown'
}

const redactSecrets = (text = '') => {
  return String(text)
    .replace(/(gh[pousr]_[A-Za-z0-9_]+)/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[REDACTED_OPENAI_KEY]')
    .replace(/(AIza[0-9A-Za-z\-_]{20,})/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/((?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?)([^'"\r\n;]+)/gi, '$1[REDACTED]')
}

const isMinifiedFile = (filePath = '') => /\.min\.(js|css)$/i.test(filePath)
const isGeneratedFile = (filePath = '') => /\.(generated|min)\./i.test(filePath) || filePath.includes('__generated__') || filePath.includes('/generated/')
const isBuildArtifact = (filePath = '') => GENERATED_PATH_SEGMENTS.some(segment => filePath.includes(segment))
const isLockFile = (filePath = '') => LOCK_FILES.has(path.basename(filePath))

const getExcludedReason = ({ filePath, patch, additions = 0, deletions = 0, isBinary }) => {
  if (isBinary || !patch) return 'BINARY_OR_NO_PATCH'
  if (filePath.includes('node_modules/')) return 'NODE_MODULES'
  if (isBuildArtifact(filePath)) return 'BUILD_ARTIFACT'
  if (isMinifiedFile(filePath)) return 'MINIFIED_FILE'
  if (isGeneratedFile(filePath)) return 'GENERATED_FILE'
  if (isLockFile(filePath) && patch.length > LARGE_LOCKFILE_PATCH_LIMIT) return 'LARGE_LOCK_FILE'
  if ((additions + deletions) > 2000) return 'FILE_TOO_LARGE'
  return null
}

const preprocessFiles = (files = []) => {
  const truncateWithMarker = (value, limit, marker) => {
    if (value.length <= limit) return { text: value, truncated: false }
    if (limit <= marker.length) {
      return { text: marker.slice(0, limit), truncated: true }
    }

    return {
      text: `${value.slice(0, limit - marker.length)}${marker}`,
      truncated: true
    }
  }

  let remainingBudget = TOTAL_CLEAN_DIFF_LIMIT
  let includedFiles = 0
  let excludedFiles = 0
  let totalRawPatchSize = 0
  let totalCleanPatchSize = 0

  const normalizedFiles = files.map((file) => {
    const patch = file.patch || ''
    const rawPatchSize = patch.length
    totalRawPatchSize += rawPatchSize

    const language = detectLanguage(file.filename || file.filePath || '')
    const binary = !file.patch
    const excludedReason = getExcludedReason({
      filePath: file.filename || file.filePath || '',
      patch,
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      isBinary: binary
    })

    const stats = parsePatchStats(patch)
    let cleanPatch = excludedReason ? '' : redactSecrets(patch)
    let isTruncated = false

    const perFileTruncation = truncateWithMarker(cleanPatch, PATCH_LIMIT_PER_FILE, '\n... [TRUNCATED_PER_FILE]')
    cleanPatch = perFileTruncation.text
    isTruncated = perFileTruncation.truncated

    const totalBudgetTruncation = truncateWithMarker(cleanPatch, remainingBudget, '\n... [TRUNCATED_TOTAL_BUDGET]')
    cleanPatch = totalBudgetTruncation.text
    if (totalBudgetTruncation.truncated) {
      isTruncated = true
    }

    const cleanPatchSize = cleanPatch.length
    remainingBudget = Math.max(0, remainingBudget - cleanPatchSize)
    totalCleanPatchSize += cleanPatchSize

    const isExcluded = Boolean(excludedReason)
    if (isExcluded) excludedFiles += 1
    else includedFiles += 1

    return {
      filePath: file.filename || file.filePath || '',
      previousFilePath: file.previous_filename || null,
      fileName: path.basename(file.filename || file.filePath || ''),
      language,
      status: file.status || 'modified',
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || ((file.additions || 0) + (file.deletions || 0)),
      patch,
      cleanPatch,
      patchSummary: isExcluded
        ? `Excluded ${path.basename(file.filename || file.filePath || '')}: ${excludedReason}`
        : `${language} file with ${stats.hunkCount} hunks, +${stats.addedLineCount}/-${stats.removedLineCount}`,
      excludedReason,
      isBinary: binary,
      isGenerated: isGeneratedFile(file.filename || ''),
      isMinified: isMinifiedFile(file.filename || ''),
      isBuildArtifact: isBuildArtifact(file.filename || ''),
      isLockFile: isLockFile(file.filename || ''),
      isExcluded,
      isTruncated,
      rawPatchSize,
      cleanPatchSize,
      hunkCount: stats.hunkCount,
      addedLineCount: stats.addedLineCount,
      removedLineCount: stats.removedLineCount
    }
  })

  const cleanDiffText = normalizedFiles
    .filter(file => !file.isExcluded && file.cleanPatch)
    .map(file => `### ${file.filePath}\n${file.cleanPatch}`)
    .join('\n\n')

  return {
    files: normalizedFiles,
    cleanDiffText,
    totalRawPatchSize,
    totalCleanPatchSize,
    totalFiles: normalizedFiles.length,
    includedFiles,
    excludedFiles
  }
}

const createOctokitFactory = () => ({ token }) => new Octokit({ auth: token })

export const createRepositoryEvidenceService = ({
  repository = REPOSITORY_EVIDENCE_REPOSITORY,
  queueService = QUEUE_SERVICE,
  encryption = ENCRYPTION_UTILS,
  octokitFactory = createOctokitFactory(),
  staticAnalysisService = null,
  llmService = null
} = {}) => {
  void staticAnalysisService
  void llmService

  const getGithubAccess = async (eventId) => {
    ensureObjectIdString(eventId, 'eventId')
    const record = await repository.findConfigByKey(buildEventConfigKey(eventId))
    const value = record?.value || {}

    if (!value.enabled) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub integration is disabled for this event'])
    }

    if (!value.tokenEncrypted) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub token is not configured for this event'])
    }

    return {
      token: encryption.decrypt(value.tokenEncrypted)
    }
  }

  const listCommits = async ({ repositoryId, query = {} }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

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

  const listCommitDiffs = async ({ repositoryId, query = {} }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const [commitDiffs, totalItems] = await Promise.all([
      repository.listCommitDiffsByRepository({ repositoryId, skip, limit }),
      repository.countCommitDiffsByRepository(repositoryId)
    ])

    return {
      repository: normalizeRepository(existingRepository),
      commitDiffs: commitDiffs.map(normalizeCommitDiff),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const syncRepositoryCommits = async ({ repositoryId }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    await queueService.enqueueHourlyRepositoryScan({ repositoryId })

    return {
      repository: normalizeRepository(existingRepository),
      queuedJobType: JOB_TYPES.HOURLY_REPOSITORY_SCAN
    }
  }

  const fetchCommitMetadata = async ({
    octokit,
    owner,
    repo,
    sha,
    branch,
    repositoryId,
    repositoryFullName
  }) => {
    const { data } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha
    })

    return await repository.upsertCommit({
      repositoryId,
      commitSha: data.sha,
      data: {
        repositoryId,
        commitSha: data.sha,
        branch: branch || null,
        provider: 'GITHUB',
        repositoryFullName,
        parentCommitShas: (data.parents || []).map(parent => parent.sha),
        authorName: data.commit?.author?.name || data.author?.login || null,
        authorEmail: data.commit?.author?.email || null,
        authorUsername: data.author?.login || null,
        timestamp: data.commit?.author?.date || null,
        message: data.commit?.message || null,
        commitUrl: data.html_url || null,
        linesAdded: data.stats?.additions || 0,
        linesRemoved: data.stats?.deletions || 0,
        filesChanged: data.files?.length || data.stats?.total || 0,
        rawStats: data.stats || null
      }
    })
  }

  const buildDiffPayloadFromCompare = ({ compareData, repositoryId, headCommitSha, baseCommitSha, commitId }) => {
    const normalized = preprocessFiles(compareData.files || [])

    return {
      repositoryId,
      commitId,
      baseCommitSha,
      headCommitSha,
      provider: 'GITHUB',
      status: 'READY',
      diffHash: crypto.createHash('sha256').update(normalized.cleanDiffText || '').digest('hex'),
      diffText: JSON.stringify((compareData.files || []).map(file => ({
        filePath: file.filename,
        patch: file.patch || null
      }))),
      cleanDiffText: normalized.cleanDiffText,
      totalRawPatchSize: normalized.totalRawPatchSize,
      totalCleanPatchSize: normalized.totalCleanPatchSize,
      totalFiles: normalized.totalFiles,
      includedFiles: normalized.includedFiles,
      excludedFiles: normalized.excludedFiles,
      files: normalized.files,
      fetchedAt: new Date(),
      lastError: null
    }
  }

  const processFetchCommitDiffJob = async ({
    repositoryId,
    beforeCommitSha,
    afterCommitSha,
    branch,
    deliveryEventId = null
  }) => {
    if (deliveryEventId) {
      await repository.updateWebhookDeliveryById(deliveryEventId, {
        status: 'PROCESSING',
        errorMessage: null
      })
    }

    try {
      const existingRepository = await repository.findRepositoryById(repositoryId)
      if (!existingRepository) {
        throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])
      }

      const eventId = existingRepository.eventId?._id?.toString?.() || existingRepository.eventId?.toString?.() || existingRepository.eventId
      const { token } = await getGithubAccess(eventId)
      const octokit = octokitFactory({ token })
      const owner = existingRepository.githubOwner || existingRepository.githubOrg
      const repoName = existingRepository.githubRepo || existingRepository.repoName
      const repositoryFullName = existingRepository.repositoryFullName || `${owner}/${repoName}`
      const headCommitSha = afterCommitSha || existingRepository.latestCommitSha

      if (!headCommitSha) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['afterCommitSha is required to fetch commit evidence'])
      }

      let compareData
      let commitRecord

      if (beforeCommitSha && beforeCommitSha !== headCommitSha && !/^0+$/.test(beforeCommitSha)) {
        const { data } = await octokit.repos.compareCommitsWithBasehead({
          owner,
          repo: repoName,
          basehead: `${beforeCommitSha}...${headCommitSha}`
        })
        compareData = data

        const compareCommitShas = new Set((data.commits || []).map(commit => commit.sha))
        compareCommitShas.add(headCommitSha)
        for (const commitSha of compareCommitShas) {
          commitRecord = await fetchCommitMetadata({
            octokit,
            owner,
            repo: repoName,
            sha: commitSha,
            branch,
            repositoryId,
            repositoryFullName
          })
        }
      } else {
        commitRecord = await fetchCommitMetadata({
          octokit,
          owner,
          repo: repoName,
          sha: headCommitSha,
          branch,
          repositoryId,
          repositoryFullName
        })

        const { data } = await octokit.repos.getCommit({
          owner,
          repo: repoName,
          ref: headCommitSha
        })
        compareData = {
          files: data.files || []
        }
      }

      const diffPayload = buildDiffPayloadFromCompare({
        compareData,
        repositoryId,
        headCommitSha,
        baseCommitSha: beforeCommitSha || null,
        commitId: commitRecord?._id
      })

      const commitDiff = await repository.upsertCommitDiff({
        repositoryId,
        headCommitSha,
        data: diffPayload
      })

      await repository.updateRepositoryById(repositoryId, {
        latestCommitSha: headCommitSha,
        lastProcessedCommitSha: headCommitSha,
        lastSyncAt: new Date()
      })

      if (deliveryEventId) {
        await repository.updateWebhookDeliveryById(deliveryEventId, {
          status: 'PROCESSED',
          processedAt: new Date(),
          errorMessage: null
        })
      }

      await queueService.enqueueRunStaticAnalysis({
        repositoryId,
        commitSha: headCommitSha
      })

      return {
        repository: normalizeRepository(await repository.findRepositoryById(repositoryId)),
        commitDiff: normalizeCommitDiff(commitDiff),
        queuedJobType: JOB_TYPES.RUN_STATIC_ANALYSIS
      }
    } catch (error) {
      if (deliveryEventId) {
        await repository.updateWebhookDeliveryById(deliveryEventId, {
          status: 'FAILED',
          processedAt: new Date(),
          errorMessage: error.message
        })
      }

      throw error
    }
  }

  const processHourlyRepositoryScanJob = async ({ repositoryId } = {}) => {
    const repositories = await repository.findRepositoriesForScan({ repositoryId })
    const detected = []

    for (const currentRepository of repositories) {
      const eventId = currentRepository.eventId?._id?.toString?.() || currentRepository.eventId?.toString?.() || currentRepository.eventId
      const { token } = await getGithubAccess(eventId)
      const octokit = octokitFactory({ token })
      const owner = currentRepository.githubOwner || currentRepository.githubOrg
      const repoName = currentRepository.githubRepo || currentRepository.repoName

      const { data } = await octokit.repos.listCommits({
        owner,
        repo: repoName,
        sha: currentRepository.defaultBranch || 'main',
        per_page: COMMIT_PAGE_SIZE
      })

      const latestCommitSha = data[0]?.sha
      if (!latestCommitSha) continue

      await repository.updateRepositoryById(currentRepository._id, {
        latestCommitSha
      })

      if (latestCommitSha !== currentRepository.lastProcessedCommitSha) {
        await queueService.enqueueFetchCommitDiff({
          repositoryId: currentRepository._id.toString(),
          beforeCommitSha: currentRepository.lastProcessedCommitSha || null,
          afterCommitSha: latestCommitSha,
          branch: currentRepository.defaultBranch || 'main'
        })

        detected.push({
          repositoryId: currentRepository._id.toString(),
          repositoryFullName: currentRepository.repositoryFullName,
          latestCommitSha
        })
      }
    }

    return {
      scannedRepositories: repositories.length,
      enqueuedFetchJobs: detected.length,
      detected
    }
  }

  return {
    listCommits,
    listCommitDiffs,
    syncRepositoryCommits,
    processFetchCommitDiffJob,
    processHourlyRepositoryScanJob,
    preprocessFiles
  }
}

export const REPOSITORY_EVIDENCE_SERVICE = createRepositoryEvidenceService({
  staticAnalysisService: null,
  llmService: null
})
