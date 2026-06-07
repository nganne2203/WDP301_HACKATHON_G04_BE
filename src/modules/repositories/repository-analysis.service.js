import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import { env } from '#configs/environment.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { JOB_TYPES } from '#constants/queue.js'
import { REPOSITORY_EVIDENCE_REPOSITORY } from './repository-evidence.repository.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import ApiError from '#utils/ApiError.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'

const execFileAsync = promisify(execFile)
const SAFE_COMMANDS = new Set(['npm', 'npm.cmd', 'npx', 'npx.cmd', 'pnpm', 'pnpm.cmd'])
const READ_ONLY_PATH_PATTERNS = ['README', '.md', 'docs/', '.txt']
const SERVICE_PATH_PATTERNS = ['src/modules/', 'src/services/', 'src/controllers/', 'src/routes/', 'src/models/', 'src/middlewares/', 'src/configs/']

const normalizeRepository = (repository) => {
  if (!repository) return null
  const plain = typeof repository.toObject === 'function'
    ? repository.toObject({ getters: true, virtuals: false })
    : repository

  return {
    id: plain._id?.toString() || plain.id,
    repositoryFullName: plain.repositoryFullName,
    defaultBranch: plain.defaultBranch,
    latestCommitSha: plain.latestCommitSha || null,
    lastProcessedCommitSha: plain.lastProcessedCommitSha || null
  }
}

const normalizeStaticAnalysisResult = (result) => {
  if (!result) return null
  const plain = typeof result.toObject === 'function'
    ? result.toObject({ getters: true, virtuals: false })
    : result

  return {
    id: plain._id?.toString() || plain.id,
    repositoryId: plain.repositoryId?._id?.toString?.() || plain.repositoryId?.toString?.() || plain.repositoryId,
    commitSha: plain.commitSha,
    source: plain.source,
    status: plain.status,
    errorCount: plain.errorCount || 0,
    warningCount: plain.warningCount || 0,
    findings: plain.findings || [],
    rawOutput: plain.rawOutput || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  }
}

const normalizeChangedCodeContext = (context) => {
  if (!context) return null
  const plain = typeof context.toObject === 'function'
    ? context.toObject({ getters: true, virtuals: false })
    : context

  return {
    id: plain._id?.toString() || plain.id,
    repositoryId: plain.repositoryId?._id?.toString?.() || plain.repositoryId?.toString?.() || plain.repositoryId,
    commitSha: plain.commitSha,
    filePath: plain.filePath,
    symbolName: plain.symbolName,
    symbolType: plain.symbolType,
    startLine: plain.startLine || null,
    endLine: plain.endLine || null,
    contextSnippet: plain.contextSnippet || '',
    confidence: plain.confidence
  }
}

const normalizeImpactDecision = (decision) => {
  if (!decision) return null
  const plain = typeof decision.toObject === 'function'
    ? decision.toObject({ getters: true, virtuals: false })
    : decision

  return {
    id: plain._id?.toString() || plain.id,
    repositoryId: plain.repositoryId?._id?.toString?.() || plain.repositoryId?.toString?.() || plain.repositoryId,
    commitSha: plain.commitSha,
    impactScore: plain.impactScore,
    impactLevel: plain.impactLevel,
    decision: plain.decision,
    reasons: plain.reasons || [],
    needsHumanReview: Boolean(plain.needsHumanReview),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  }
}

const splitConfiguredCommand = (command) => {
  if (!command) return null
  const parts = String(command).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const executable = parts[0]
  if (!SAFE_COMMANDS.has(executable)) return null
  return {
    executable,
    args: parts.slice(1)
  }
}

const parseDependencyChanges = (patch = '') => {
  const dependencies = {
    added: [],
    removed: []
  }

  for (const line of patch.split('\n')) {
    if (!line.startsWith('+') && !line.startsWith('-')) continue
    if (line.startsWith('+++') || line.startsWith('---')) continue
    const match = line.match(/^[+-]\s*"([^"]+)"\s*:\s*"([^"]+)"/)
    if (!match) continue

    const [, name, version] = match
    if (name === 'name' || name === 'version' || name === 'private' || name === 'scripts') continue
    if (line.startsWith('+')) dependencies.added.push({ name, version })
    if (line.startsWith('-')) dependencies.removed.push({ name, version })
  }

  return dependencies
}

const parseHunks = (patch = '') => {
  const lines = patch.split('\n')
  const hunks = []
  let current = null

  for (const line of lines) {
    const hunkHeader = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (hunkHeader) {
      if (current) hunks.push(current)
      current = {
        header: line,
        oldStart: Number(hunkHeader[1]),
        oldCount: Number(hunkHeader[2] || 1),
        newStart: Number(hunkHeader[3]),
        newCount: Number(hunkHeader[4] || 1),
        lines: []
      }
      continue
    }

    if (current) current.lines.push(line)
  }

  if (current) hunks.push(current)
  return hunks
}

const buildContextSnippet = (lines, index, radius = 2) => {
  const start = Math.max(0, index - radius)
  const end = Math.min(lines.length, index + radius + 1)
  return lines.slice(start, end).join('\n')
}

const detectSymbolsInLine = ({ line, filePath }) => {
  const detectors = [
    { regex: /\bclass\s+([A-Za-z0-9_]+)/, type: 'CLASS', confidence: 'HIGH' },
    { regex: /\bfunction\s+([A-Za-z0-9_]+)\s*\(/, type: filePath.includes('/services/') ? 'SERVICE_METHOD' : 'FUNCTION', confidence: 'HIGH' },
    { regex: /\b(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, type: filePath.includes('/services/') ? 'SERVICE_METHOD' : 'FUNCTION', confidence: 'MEDIUM' },
    { regex: /\b(?:async\s+)?([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/, type: filePath.includes('/controllers/') ? 'CONTROLLER_METHOD' : (filePath.includes('/services/') ? 'SERVICE_METHOD' : 'FUNCTION'), confidence: 'MEDIUM' },
    { regex: /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/, type: 'ROUTE', confidence: 'HIGH', mapper: match => `${match[1].toUpperCase()} ${match[2]}` }
  ]

  for (const detector of detectors) {
    const match = line.match(detector.regex)
    if (!match) continue

    return {
      symbolName: detector.mapper ? detector.mapper(match) : match[1],
      symbolType: detector.type,
      confidence: detector.confidence
    }
  }

  return null
}

const extractChangedCodeContexts = ({ repositoryId, commitSha, commitDiff }) => {
  const contexts = []

  for (const file of commitDiff.files || []) {
    if (file.isExcluded || !file.cleanPatch) continue
    const hunks = parseHunks(file.cleanPatch)
    for (const hunk of hunks) {
      let lineNumber = hunk.newStart
      hunk.lines.forEach((line, index) => {
        const shouldInspect = line.startsWith('+') || line.startsWith(' ') || (!line.startsWith('-') && !line.startsWith('\\'))
        if (!shouldInspect) {
          if (!line.startsWith('-')) lineNumber += 1
          return
        }

        const symbol = detectSymbolsInLine({
          line,
          filePath: file.filePath
        })

        if (symbol) {
          contexts.push({
            repositoryId,
            commitSha,
            filePath: file.filePath,
            symbolName: symbol.symbolName,
            symbolType: symbol.symbolType,
            startLine: lineNumber,
            endLine: lineNumber + Math.max(1, hunk.newCount || 1) - 1,
            contextSnippet: buildContextSnippet(hunk.lines, index),
            confidence: symbol.confidence
          })
        }

        if (!line.startsWith('-')) lineNumber += 1
      })
    }

    if (!contexts.some(context => context.filePath === file.filePath) && SERVICE_PATH_PATTERNS.some(pattern => file.filePath.includes(pattern))) {
      contexts.push({
        repositoryId,
        commitSha,
        filePath: file.filePath,
        symbolName: path.basename(file.filePath),
        symbolType: 'MODULE_SYMBOL',
        startLine: 1,
        endLine: Math.max(1, file.hunkCount || 1),
        contextSnippet: file.cleanPatch.slice(0, 500),
        confidence: 'LOW'
      })
    }
  }

  return contexts
}

const calculateImpactDecision = ({ commitDiff, staticResults = [], changedContexts = [] }) => {
  const reasons = []
  let score = 0
  let needsHumanReview = false
  const files = commitDiff.files || []

  const nonExcludedFiles = files.filter(file => !file.isExcluded)
  const docsOnly = nonExcludedFiles.length > 0 && nonExcludedFiles.every(file => READ_ONLY_PATH_PATTERNS.some(pattern => file.filePath.includes(pattern)))

  if (docsOnly) {
    reasons.push('Documentation-only change detected')
    return {
      impactScore: 5,
      impactLevel: 'LOW',
      decision: 'SKIP_LLM',
      reasons,
      needsHumanReview: false
    }
  }

  score += Math.min(20, nonExcludedFiles.length * 4)
  if (commitDiff.totalCleanPatchSize > 8000) {
    score += 15
    reasons.push('Large clean diff size')
  }

  for (const file of nonExcludedFiles) {
    if (SERVICE_PATH_PATTERNS.some(pattern => file.filePath.includes(pattern))) {
      score += 25
      reasons.push(`Core path changed: ${file.filePath}`)
    } else if (file.filePath === 'package.json') {
      score += 12
      reasons.push('Dependency manifest changed')
    }
  }

  if (changedContexts.some(context => ['SERVICE_METHOD', 'ROUTE', 'CONTROLLER_METHOD', 'CLASS'].includes(context.symbolType))) {
    score += 30
    reasons.push('Core symbols/routes/classes changed')
  }

  for (const result of staticResults) {
    score += (result.errorCount || 0) * 10
    score += (result.warningCount || 0) * 3

    for (const finding of result.findings || []) {
      if (finding.severity === 'CRITICAL') {
        score += 60
        needsHumanReview = true
        reasons.push(`Critical finding: ${finding.title || finding.message}`)
      } else if (finding.severity === 'HIGH') {
        score += 30
        reasons.push(`High-risk finding: ${finding.title || finding.message}`)
      } else if (finding.severity === 'MEDIUM') {
        score += 12
        reasons.push(`Medium finding: ${finding.title || finding.message}`)
      } else if (finding.severity === 'LOW') {
        score += 4
      }
    }
  }

  if (score >= 90 || needsHumanReview) {
    return {
      impactScore: score,
      impactLevel: 'CRITICAL',
      decision: 'URGENT_AUDIT_AND_HUMAN_REVIEW',
      reasons: [...new Set(reasons)],
      needsHumanReview: true
    }
  }

  if (score >= 55) {
    return {
      impactScore: score,
      impactLevel: 'HIGH',
      decision: 'CALL_PER_PUSH_AUDIT',
      reasons: [...new Set(reasons)],
      needsHumanReview: false
    }
  }

  if (score >= 20) {
    return {
      impactScore: score,
      impactLevel: 'MEDIUM',
      decision: 'BATCH_HOURLY_AUDIT',
      reasons: [...new Set(reasons)],
      needsHumanReview: false
    }
  }

  return {
    impactScore: score,
    impactLevel: 'LOW',
    decision: 'SKIP_LLM',
    reasons: [...new Set(reasons.length ? reasons : ['Low-risk change'])],
    needsHumanReview: false
  }
}

export const createRepositoryAnalysisService = ({
  repository = REPOSITORY_EVIDENCE_REPOSITORY,
  queueService = QUEUE_SERVICE,
  commandRunner = async ({ executable, args }) => {
    return await execFileAsync(executable, args, { cwd: process.cwd(), timeout: 20000 })
  },
  llmService = null
} = {}) => {
  void llmService

  const buildCommandHookConfigs = () => {
    return [
      { source: 'COMMAND_HOOK_ESLINT', command: env.analysis.eslintCommand },
      { source: 'COMMAND_HOOK_TSC', command: env.analysis.tscCommand }
    ]
      .map(config => ({
        ...config,
        parsed: splitConfiguredCommand(config.command)
      }))
  }

  const ensureRepositoryAndCommitDiff = async ({ repositoryId, commitSha }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    const commitDiff = await repository.findCommitDiffByRepositoryAndHeadSha({
      repositoryId,
      headCommitSha: commitSha
    })
    if (!commitDiff) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Commit diff not found'])
    }

    return {
      existingRepository,
      commitDiff
    }
  }

  const listStaticAnalysisResults = async ({ repositoryId, query = {} }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const [results, totalItems] = await Promise.all([
      repository.listStaticAnalysisResultsByRepository({ repositoryId, skip, limit }),
      repository.countStaticAnalysisResultsByRepository(repositoryId)
    ])

    return {
      repository: normalizeRepository(existingRepository),
      results: results.map(normalizeStaticAnalysisResult),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const listImpactDecisions = async ({ repositoryId, query = {} }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const [decisions, totalItems] = await Promise.all([
      repository.listImpactDecisionsByRepository({ repositoryId, skip, limit }),
      repository.countImpactDecisionsByRepository(repositoryId)
    ])

    return {
      repository: normalizeRepository(existingRepository),
      decisions: decisions.map(normalizeImpactDecision),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const analyzeCommit = async ({ repositoryId, commitSha }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    const targetCommitSha = commitSha || existingRepository.lastProcessedCommitSha || existingRepository.latestCommitSha
    if (!targetCommitSha) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['commitSha is required when repository has no processed commit'])
    }

    await queueService.enqueueRunStaticAnalysis({
      repositoryId,
      commitSha: targetCommitSha
    })

    return {
      repository: normalizeRepository(existingRepository),
      commitSha: targetCommitSha,
      queuedJobType: JOB_TYPES.RUN_STATIC_ANALYSIS
    }
  }

  const runSecretScan = ({ repositoryId, commitSha, commitDiff }) => {
    const findings = []

    for (const file of commitDiff.files || []) {
      if ((file.cleanPatch || '').includes('[REDACTED')) {
        findings.push({
          type: 'SECRET_EXPOSURE',
          severity: 'CRITICAL',
          filePath: file.filePath,
          title: 'Potential secret exposure detected in patch',
          message: 'Secret-like material was redacted from the patch and requires human review.',
          evidence: [file.patchSummary || file.filePath]
        })
      }
    }

    return {
      repositoryId,
      commitSha,
      source: 'SECRET_SCAN',
      status: 'COMPLETED',
      errorCount: findings.filter(finding => ['HIGH', 'CRITICAL'].includes(finding.severity)).length,
      warningCount: findings.filter(finding => ['LOW', 'MEDIUM'].includes(finding.severity)).length,
      findings,
      rawOutput: {
        scannedFiles: commitDiff.totalFiles || (commitDiff.files || []).length,
        cleanDiffSize: commitDiff.totalCleanPatchSize || 0
      }
    }
  }

  const runDependencyScan = ({ repositoryId, commitSha, commitDiff }) => {
    const findings = []
    const summary = {
      addedDependencies: [],
      removedDependencies: []
    }

    for (const file of commitDiff.files || []) {
      if (path.basename(file.filePath) !== 'package.json' || file.isExcluded) continue
      const parsed = parseDependencyChanges(file.cleanPatch || '')
      summary.addedDependencies.push(...parsed.added)
      summary.removedDependencies.push(...parsed.removed)
    }

    if (summary.addedDependencies.length > 0) {
      findings.push({
        type: 'DEPENDENCY_CHANGE',
        severity: 'MEDIUM',
        filePath: 'package.json',
        title: 'New dependencies added',
        message: `Detected ${summary.addedDependencies.length} added dependency changes.`,
        evidence: summary.addedDependencies.map(dep => `${dep.name}@${dep.version}`)
      })
    }

    return {
      repositoryId,
      commitSha,
      source: 'DEPENDENCY_SCAN',
      status: 'COMPLETED',
      errorCount: 0,
      warningCount: findings.length,
      findings,
      rawOutput: summary
    }
  }

  const runCommandHooks = async ({ repositoryId, commitSha }) => {
    const results = []
    for (const hook of buildCommandHookConfigs()) {
      if (!hook.command) {
        results.push({
          repositoryId,
          commitSha,
          source: hook.source,
          status: 'SKIPPED',
          errorCount: 0,
          warningCount: 0,
          findings: [],
          rawOutput: {
            reason: 'Not configured'
          }
        })
        continue
      }

      if (!hook.parsed) {
        results.push({
          repositoryId,
          commitSha,
          source: hook.source,
          status: 'SKIPPED',
          errorCount: 0,
          warningCount: 0,
          findings: [],
          rawOutput: {
            reason: 'Command is not allow-listed'
          }
        })
        continue
      }

      try {
        const output = await commandRunner(hook.parsed)
        results.push({
          repositoryId,
          commitSha,
          source: hook.source,
          status: 'COMPLETED',
          errorCount: 0,
          warningCount: 0,
          findings: [],
          rawOutput: {
            stdout: output.stdout,
            stderr: output.stderr
          }
        })
      } catch (error) {
        results.push({
          repositoryId,
          commitSha,
          source: hook.source,
          status: 'FAILED',
          errorCount: 1,
          warningCount: 0,
          findings: [{
            type: 'COMMAND_HOOK_FAILURE',
            severity: 'HIGH',
            filePath: null,
            title: `${hook.source} failed`,
            message: error.message,
            evidence: []
          }],
          rawOutput: {
            stdout: error.stdout,
            stderr: error.stderr
          }
        })
      }
    }

    return results
  }

  const processRunStaticAnalysisJob = async ({ repositoryId, commitSha }) => {
    const { commitDiff } = await ensureRepositoryAndCommitDiff({ repositoryId, commitSha })
    const secretScanResult = runSecretScan({ repositoryId, commitSha, commitDiff })
    const dependencyScanResult = runDependencyScan({ repositoryId, commitSha, commitDiff })
    const commandHookResults = await runCommandHooks({ repositoryId, commitSha })
    const contexts = extractChangedCodeContexts({ repositoryId, commitSha, commitDiff })

    const persistedResults = await Promise.all([
      repository.upsertStaticAnalysisResult({
        repositoryId,
        commitSha,
        source: secretScanResult.source,
        data: secretScanResult
      }),
      repository.upsertStaticAnalysisResult({
        repositoryId,
        commitSha,
        source: dependencyScanResult.source,
        data: dependencyScanResult
      }),
      ...commandHookResults.map(result => repository.upsertStaticAnalysisResult({
        repositoryId,
        commitSha,
        source: result.source,
        data: result
      }))
    ])

    const persistedContexts = await repository.replaceChangedCodeContexts({
      repositoryId,
      commitSha,
      contexts
    })

    await queueService.enqueueComputeImpactScore({
      repositoryId,
      commitSha
    })

    return {
      results: persistedResults.map(normalizeStaticAnalysisResult),
      changedCodeContexts: persistedContexts.map(normalizeChangedCodeContext),
      queuedJobType: JOB_TYPES.COMPUTE_IMPACT_SCORE
    }
  }

  const processComputeImpactScoreJob = async ({ repositoryId, commitSha }) => {
    const { commitDiff } = await ensureRepositoryAndCommitDiff({ repositoryId, commitSha })
    const staticResults = await repository.listStaticAnalysisResultsByRepository({ repositoryId, skip: 0, limit: 100 })
    const changedContexts = await repository.listChangedCodeContexts({ repositoryId, commitSha })
    const commitSpecificResults = staticResults.filter(result => result.commitSha === commitSha)
    const decisionPayload = calculateImpactDecision({
      commitDiff,
      staticResults: commitSpecificResults,
      changedContexts
    })

    const persistedDecision = await repository.upsertImpactDecision({
      repositoryId,
      commitSha,
      data: {
        repositoryId,
        commitSha,
        ...decisionPayload
      }
    })

    if (
      queueService.enqueueRunPerPushAudit &&
      ['CALL_PER_PUSH_AUDIT', 'URGENT_AUDIT_AND_HUMAN_REVIEW'].includes(decisionPayload.decision)
    ) {
      await queueService.enqueueRunPerPushAudit({
        repositoryId,
        commitSha
      })
    }

    return normalizeImpactDecision(persistedDecision)
  }

  return {
    listStaticAnalysisResults,
    listImpactDecisions,
    analyzeCommit,
    processRunStaticAnalysisJob,
    processComputeImpactScoreJob,
    extractChangedCodeContexts,
    calculateImpactDecision
  }
}

export const REPOSITORY_ANALYSIS_SERVICE = createRepositoryAnalysisService({
  llmService: null
})
