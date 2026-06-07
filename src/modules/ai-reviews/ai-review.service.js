import Joi from 'joi'

import { AI_REVIEW_REPOSITORY } from './ai-review.repository.js'
import { JOB_TYPES } from '#constants/queue.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import ApiError from '#utils/ApiError.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'

const FORBIDDEN_FIELDS = new Set([
  'suggestedScore',
  'finalScore',
  'rank',
  'winner',
  'finalistDecision',
  'passFailDecision'
])

const qualitativeLevel = Joi.string().valid('EXCELLENT', 'GOOD', 'FAIR', 'AVERAGE', 'WEAK', 'NOT_ENOUGH_EVIDENCE')
const severity = Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')

const aiReviewOutputSchema = Joi.object({
  reviewKind: Joi.string().valid('PER_PUSH_TECHNICAL_AUDIT', 'TEAM_AGGREGATE_TECHNICAL_AUDIT').required(),
  status: Joi.string().valid('DONE', 'FALLBACK').required(),
  isScoreBased: Joi.boolean().valid(false).required(),
  isFinalDecision: Joi.boolean().valid(false).required(),
  overallPicture: Joi.object({
    pushSummary: Joi.string().allow('', null),
    significantChange: Joi.boolean().allow(null),
    changeImpactLevel: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN').required(),
    mainAffectedAreas: Joi.array().items(Joi.string()).default([])
  }).required(),
  techStackDetected: Joi.object({
    frontend: Joi.array().items(Joi.string()).default([]),
    backend: Joi.array().items(Joi.string()).default([]),
    database: Joi.array().items(Joi.string()).default([]),
    ai: Joi.array().items(Joi.string()).default([]),
    retrieval: Joi.array().items(Joi.string()).default([]),
    testing: Joi.array().items(Joi.string()).default([])
  }).required(),
  technicalFindings: Joi.array().items(Joi.object({
    type: Joi.string().valid('ARCHITECTURE', 'SECURITY', 'RELIABILITY', 'PERFORMANCE', 'TESTING', 'AI_USAGE', 'RAG', 'AGENT', 'DEPENDENCY', 'MAINTAINABILITY').required(),
    severity: severity.required(),
    title: Joi.string().required(),
    evidence: Joi.array().items(Joi.string()).default([]),
    comment: Joi.string().allow('', null),
    recommendedAction: Joi.string().allow('', null)
  })).default([]),
  rubricAwareComments: Joi.array().items(Joi.object({
    criterionId: Joi.string().allow('', null),
    criterionName: Joi.string().required(),
    qualitativeLevel: qualitativeLevel.required(),
    comment: Joi.string().allow('', null),
    evidence: Joi.array().items(Joi.string()).default([]),
    risks: Joi.array().items(Joi.string()).default([])
  })).default([]),
  suggestedTestCases: Joi.array().items(Joi.object({
    title: Joi.string().required(),
    purpose: Joi.string().allow('', null),
    expectedObservation: Joi.string().allow('', null)
  })).default([]),
  suggestedJudgeQuestions: Joi.array().items(Joi.string()).default([]),
  costControlNotes: Joi.object({
    llmCallReason: Joi.string().allow('', null),
    skippedFiles: Joi.array().items(Joi.string()).default([]),
    tokenSavingStrategy: Joi.array().items(Joi.string()).default([])
  }).required(),
  needsHumanReview: Joi.boolean().required()
})

const ensureArray = (value) => Array.isArray(value) ? value : []

const normalizeRepository = (repository) => {
  if (!repository) return null
  const plain = typeof repository.toObject === 'function'
    ? repository.toObject({ getters: true, virtuals: false })
    : repository

  return {
    id: plain._id?.toString() || plain.id,
    eventId: plain.eventId?._id?.toString?.() || plain.eventId?.toString?.() || plain.eventId,
    teamId: plain.teamId?._id?.toString?.() || plain.teamId?.toString?.() || plain.teamId,
    roundId: plain.roundId?._id?.toString?.() || plain.roundId?.toString?.() || plain.roundId || null,
    repositoryFullName: plain.repositoryFullName,
    githubOwner: plain.githubOwner || plain.githubOrg,
    githubRepo: plain.githubRepo || plain.repoName,
    defaultBranch: plain.defaultBranch,
    latestCommitSha: plain.latestCommitSha || null,
    lastProcessedCommitSha: plain.lastProcessedCommitSha || null,
    team: plain.teamId ? {
      id: plain.teamId._id?.toString?.() || plain.teamId.id,
      name: plain.teamId.name,
      projectName: plain.teamId.projectName,
      chapterName: plain.teamId.chapterName,
      status: plain.teamId.status
    } : null,
    event: plain.eventId ? {
      id: plain.eventId._id?.toString?.() || plain.eventId.id,
      title: plain.eventId.title,
      semester: plain.eventId.semester,
      season: plain.eventId.season,
      year: plain.eventId.year,
      status: plain.eventId.status,
      competitionConfig: plain.eventId.competitionConfig || null
    } : null,
    round: plain.roundId ? {
      id: plain.roundId._id?.toString?.() || plain.roundId.id,
      name: plain.roundId.name,
      roundType: plain.roundId.roundType,
      status: plain.roundId.status,
      rubricId: plain.roundId.rubricId?._id?.toString?.() || plain.roundId.rubricId?.toString?.() || plain.roundId.rubricId || null,
      promotionRule: plain.roundId.promotionRule || null,
      tieBreakRule: plain.roundId.tieBreakRule || null
    } : null
  }
}

const normalizeAiReview = (aiReview) => {
  if (!aiReview) return null
  const plain = typeof aiReview.toObject === 'function'
    ? aiReview.toObject({ getters: true, virtuals: false })
    : aiReview

  return {
    id: plain._id?.toString() || plain.id,
    repositoryId: plain.repositoryId?._id?.toString?.() || plain.repositoryId?.toString?.() || plain.repositoryId,
    eventId: plain.eventId?._id?.toString?.() || plain.eventId?.toString?.() || plain.eventId || null,
    teamId: plain.teamId?._id?.toString?.() || plain.teamId?.toString?.() || plain.teamId || null,
    roundId: plain.roundId?._id?.toString?.() || plain.roundId?.toString?.() || plain.roundId || null,
    commitId: plain.commitId?._id?.toString?.() || plain.commitId?.toString?.() || plain.commitId || null,
    commitDiffId: plain.commitDiffId?._id?.toString?.() || plain.commitDiffId?.toString?.() || plain.commitDiffId || null,
    impactDecisionId: plain.impactDecisionId?._id?.toString?.() || plain.impactDecisionId?.toString?.() || plain.impactDecisionId || null,
    reviewKind: plain.reviewKind,
    status: plain.status,
    summary: plain.summary || plain.overallSummary || '',
    overallSummary: plain.overallSummary || '',
    needsHumanReview: Boolean(plain.needsHumanReview),
    isScoreBased: Boolean(plain.isScoreBased),
    isFinalDecision: Boolean(plain.isFinalDecision),
    commitSha: plain.commitSha || null,
    provider: plain.provider || null,
    modelName: plain.modelName || plain.model || null,
    promptVersion: plain.promptVersion || null,
    requestedAt: plain.requestedAt || null,
    completedAt: plain.completedAt || null,
    normalizedOutput: plain.normalizedOutput || null
  }
}

const forbiddenFieldSanitizer = (value) => {
  if (Array.isArray(value)) return value.map(forbiddenFieldSanitizer)
  if (!value || typeof value !== 'object') return value

  const sanitized = {}
  for (const [key, childValue] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) continue
    sanitized[key] = forbiddenFieldSanitizer(childValue)
  }
  return sanitized
}

const safeJsonParse = (text) => {
  const trimmed = String(text || '').trim()
  if (!trimmed) throw new Error('AI response was empty')

  const jsonCandidate = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    : trimmed

  return JSON.parse(jsonCandidate)
}

const detectTechStack = ({ repository, commitDiff }) => {
  const stack = {
    frontend: [],
    backend: [],
    database: [],
    ai: [],
    retrieval: [],
    testing: []
  }

  for (const file of ensureArray(commitDiff?.files)) {
    const filePath = file.filePath || ''
    if (/react|vue|angular|next/i.test(filePath)) stack.frontend.push(filePath)
    if (/src\/modules|src\/services|server|express/i.test(filePath)) stack.backend.push(filePath)
    if (/prisma|mongoose|sql|migration|schema/i.test(filePath)) stack.database.push(filePath)
    if (/openai|langchain|rag|embedding|vector/i.test(filePath)) stack.ai.push(filePath)
    if (/retrieve|search|vector|index/i.test(filePath)) stack.retrieval.push(filePath)
    if (/test|spec|__tests__/i.test(filePath)) stack.testing.push(filePath)
  }

  for (const key of Object.keys(stack)) {
    stack[key] = [...new Set(stack[key].map(item => item.split('/')[0] === 'src' ? item : item))]
  }

  if (repository?.githubRepo && stack.backend.length === 0) {
    stack.backend.push(repository.githubRepo)
  }

  return stack
}

const buildPerPushPromptInput = ({
  repository,
  commit,
  commitDiff,
  changedContexts,
  staticResults,
  impactDecision,
  rubric,
  criteria
}) => {
  const cleanDiffSummary = {
    totalFiles: commitDiff?.totalFiles || 0,
    includedFiles: commitDiff?.includedFiles || 0,
    excludedFiles: commitDiff?.excludedFiles || 0,
    totalCleanPatchSize: commitDiff?.totalCleanPatchSize || 0,
    files: ensureArray(commitDiff?.files).map(file => ({
      filePath: file.filePath,
      status: file.status,
      language: file.language,
      patchSummary: file.patchSummary,
      cleanPatch: file.cleanPatch,
      excludedReason: file.excludedReason || null,
      isExcluded: Boolean(file.isExcluded)
    }))
  }

  return {
    reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
    eventContext: repository?.event || null,
    roundContext: repository?.round || null,
    repositoryContext: {
      id: repository?.id,
      repositoryFullName: repository?.repositoryFullName,
      team: repository?.team || null,
      defaultBranch: repository?.defaultBranch
    },
    commitMetadata: commit ? {
      commitSha: commit.commitSha,
      branch: commit.branch,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
      authorUsername: commit.authorUsername,
      timestamp: commit.timestamp,
      message: commit.message,
      commitUrl: commit.commitUrl,
      linesAdded: commit.linesAdded,
      linesRemoved: commit.linesRemoved,
      filesChanged: commit.filesChanged
    } : null,
    diffSummary: cleanDiffSummary,
    changedCodeContext: changedContexts,
    staticAnalysisSummary: staticResults,
    impactDecision,
    rubricContext: rubric ? {
      id: rubric._id?.toString?.() || rubric.id,
      title: rubric.title,
      description: rubric.description,
      totalScore: rubric.totalScore,
      criteria: criteria.map((criterion, index) => ({
        id: criterion._id?.toString?.() || criterion.id,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        order: index
      }))
    } : null,
    requiredOutputSchema: 'PHASE_8_AI_TECHNICAL_AUDITOR_V1'
  }
}

const buildAggregatePromptInput = ({
  repository,
  commits,
  commitDiffs,
  staticResultsByCommit,
  impactDecisions,
  existingPerPushReviews,
  rubric,
  criteria
}) => {
  return {
    reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
    eventContext: repository?.event || null,
    roundContext: repository?.round || null,
    repositoryContext: {
      id: repository?.id,
      repositoryFullName: repository?.repositoryFullName,
      team: repository?.team || null,
      defaultBranch: repository?.defaultBranch
    },
    commitHistorySummary: commits.map(commit => ({
      commitSha: commit.commitSha,
      timestamp: commit.timestamp,
      message: commit.message,
      authorName: commit.authorName,
      linesAdded: commit.linesAdded,
      linesRemoved: commit.linesRemoved,
      filesChanged: commit.filesChanged
    })),
    currentRepositorySnapshotSummary: commitDiffs.map(diff => ({
      headCommitSha: diff.headCommitSha,
      totalFiles: diff.totalFiles,
      includedFiles: diff.includedFiles,
      excludedFiles: diff.excludedFiles,
      patchSummary: ensureArray(diff.files).map(file => ({
        filePath: file.filePath,
        patchSummary: file.patchSummary
      }))
    })),
    aggregateStaticAnalysis: {
      byCommit: staticResultsByCommit,
      impactDecisions
    },
    priorPushReviews: existingPerPushReviews.map(review => ({
      id: review._id?.toString?.() || review.id,
      status: review.status,
      summary: review.overallSummary || review.summary,
      needsHumanReview: Boolean(review.needsHumanReview),
      commitSha: review.commitSha
    })),
    rubricContext: rubric ? {
      id: rubric._id?.toString?.() || rubric.id,
      title: rubric.title,
      description: rubric.description,
      totalScore: rubric.totalScore,
      criteria: criteria.map((criterion, index) => ({
        id: criterion._id?.toString?.() || criterion.id,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        order: index
      }))
    } : null,
    requiredOutputSchema: 'PHASE_8_AI_TECHNICAL_AUDITOR_V1'
  }
}

const buildFallbackOutput = ({ reviewKind, impactDecision, reason }) => ({
  reviewKind,
  status: 'FALLBACK',
  isScoreBased: false,
  isFinalDecision: false,
  overallPicture: {
    pushSummary: reason || 'AI audit unavailable or malformed. Human review required.',
    significantChange: impactDecision ? impactDecision.impactLevel !== 'LOW' : null,
    changeImpactLevel: impactDecision?.impactLevel || 'UNKNOWN',
    mainAffectedAreas: []
  },
  techStackDetected: {
    frontend: [],
    backend: [],
    database: [],
    ai: [],
    retrieval: [],
    testing: []
  },
  technicalFindings: [],
  rubricAwareComments: [],
  suggestedTestCases: [],
  suggestedJudgeQuestions: [],
  costControlNotes: {
    llmCallReason: reason || 'AI provider unavailable',
    skippedFiles: [],
    tokenSavingStrategy: ['Fallback output used']
  },
  needsHumanReview: true
})

export const createAiReviewService = ({
  repository = AI_REVIEW_REPOSITORY,
  queueService = QUEUE_SERVICE,
  llmService = {
    async generateAudit() {
      throw new Error('AI runtime provider is not configured')
    },
    async repairJson() {
      throw new Error('AI runtime provider is not configured')
    }
  },
  scoreSheetRepository = {
    async touch() {}
  },
  rankingRepository = {
    async touch() {}
  }
} = {}) => {
  void scoreSheetRepository
  void rankingRepository

  const persistStructuredArtifacts = async ({ aiReviewId, normalizedOutput, criteria }) => {
    const criterionIndex = new Map(criteria.map(criterion => [criterion._id?.toString?.() || criterion.id, criterion]))

    const reviewCriteriaPayload = ensureArray(normalizedOutput.rubricAwareComments).map((comment, index) => {
      const criterion = criterionIndex.get(comment.criterionId) || null
      return {
        aiReviewId,
        name: comment.criterionName,
        code: criterion?.name?.replace(/\s+/g, '_').toUpperCase() || `QUALITATIVE_${index + 1}`,
        description: criterion?.description || null,
        maxScore: criterion?.maxScore || 0,
        score: null,
        weight: criterion?.weight || 1,
        feedback: comment.comment || null,
        qualitativeLevel: comment.qualitativeLevel,
        strengths: [],
        weaknesses: [],
        suggestions: [],
        evidence: ensureArray(comment.evidence),
        risks: ensureArray(comment.risks),
        order: index,
        criterionId: criterion?._id || criterion?.id || undefined
      }
    })

    const technicalFindingsPayload = ensureArray(normalizedOutput.technicalFindings).map(finding => ({
      aiReviewId,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      evidence: ensureArray(finding.evidence),
      comment: finding.comment || null,
      recommendedAction: finding.recommendedAction || null
    }))

    const testCasesPayload = ensureArray(normalizedOutput.suggestedTestCases).map(testCase => ({
      aiReviewId,
      title: testCase.title,
      purpose: testCase.purpose || null,
      expectedObservation: testCase.expectedObservation || null
    }))

    const judgeQuestionsPayload = ensureArray(normalizedOutput.suggestedJudgeQuestions).map(question => ({
      aiReviewId,
      question,
      priority: 'MEDIUM'
    }))

    const [reviewCriteria, technicalFindings, suggestedTestCases, suggestedJudgeQuestions] = await Promise.all([
      repository.replaceAiReviewCriteria({ aiReviewId, criteria: reviewCriteriaPayload }),
      repository.replaceTechnicalFindings({ aiReviewId, findings: technicalFindingsPayload }),
      repository.replaceSuggestedTestCases({ aiReviewId, testCases: testCasesPayload }),
      repository.replaceSuggestedJudgeQuestions({ aiReviewId, questions: judgeQuestionsPayload })
    ])

    return {
      reviewCriteria,
      technicalFindings,
      suggestedTestCases,
      suggestedJudgeQuestions
    }
  }

  const validateAndNormalizeAiOutput = async ({ rawResponse, reviewKind, impactDecision }) => {
    const tryNormalize = async (candidate) => {
      const parsed = safeJsonParse(candidate)
      const sanitized = forbiddenFieldSanitizer(parsed)
      const { error, value } = aiReviewOutputSchema.validate(sanitized, {
        abortEarly: false,
        stripUnknown: true
      })
      if (error) {
        throw new Error(error.details.map(detail => detail.message).join('; '))
      }

      return {
        rawResponse: candidate,
        normalizedOutput: value,
        usedFallback: false
      }
    }

    try {
      return await tryNormalize(rawResponse)
    } catch (firstError) {
      try {
        const repaired = await llmService.repairJson({
          rawResponse,
          schemaName: 'PHASE_8_AI_TECHNICAL_AUDITOR_V1',
          reviewKind
        })
        return await tryNormalize(repaired)
      } catch {
        return {
          rawResponse,
          normalizedOutput: buildFallbackOutput({
            reviewKind,
            impactDecision,
            reason: `Fallback used because AI output was invalid: ${firstError.message}`
          }),
          usedFallback: true
        }
      }
    }
  }

  const buildPerPushEvidence = async ({ repositoryId, commitSha }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])
    const normalizedRepository = normalizeRepository(existingRepository)
    const targetCommitSha = commitSha || normalizedRepository.lastProcessedCommitSha || normalizedRepository.latestCommitSha
    if (!targetCommitSha) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['commitSha is required when repository has no processed commit'])
    }

    const [commit, commitDiff, staticResults, changedContexts, impactDecision] = await Promise.all([
      repository.findCommitByRepositoryAndSha({ repositoryId, commitSha: targetCommitSha }),
      repository.findCommitDiffByRepositoryAndHeadSha({ repositoryId, headCommitSha: targetCommitSha }),
      repository.listStaticAnalysisResultsByRepositoryAndCommit({ repositoryId, commitSha: targetCommitSha }),
      repository.listChangedCodeContextsByRepositoryAndCommit({ repositoryId, commitSha: targetCommitSha }),
      repository.findImpactDecisionByRepositoryAndCommit({ repositoryId, commitSha: targetCommitSha })
    ])

    if (!commitDiff) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Commit diff not found'])
    if (!impactDecision) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Impact decision not found'])

    let rubric = null
    let criteria = []
    const rubricId = normalizedRepository.round?.rubricId || existingRepository.roundId?.rubricId
    if (rubricId) {
      rubric = await repository.findRubricById(rubricId)
      if (rubric) {
        criteria = await repository.findCriteriaByRubricId(rubric._id || rubric.id)
      }
    }

    return {
      repository: normalizedRepository,
      commit,
      commitDiff,
      staticResults,
      changedContexts,
      impactDecision,
      rubric,
      criteria,
      promptInput: buildPerPushPromptInput({
        repository: normalizedRepository,
        commit,
        commitDiff,
        changedContexts,
        staticResults,
        impactDecision,
        rubric,
        criteria
      })
    }
  }

  const buildAggregateEvidence = async ({ repositoryId }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])
    const normalizedRepository = normalizeRepository(existingRepository)

    const [commits, commitDiffs, impactDecisions, existingPerPushReviews] = await Promise.all([
      repository.findLatestCommitsByRepository({ repositoryId, limit: 10 }),
      repository.findLatestCommitDiffsByRepository({ repositoryId, limit: 10 }),
      repository.listImpactDecisionsByRepository({ repositoryId, limit: 20 }),
      repository.listAiReviewsByRepository({ repositoryId, skip: 0, limit: 20 })
    ])

    const staticResultsByCommit = []
    for (const commit of commits) {
      staticResultsByCommit.push({
        commitSha: commit.commitSha,
        results: await repository.listStaticAnalysisResultsByRepositoryAndCommit({
          repositoryId,
          commitSha: commit.commitSha
        })
      })
    }

    let rubric = null
    let criteria = []
    const rubricId = normalizedRepository.round?.rubricId || existingRepository.roundId?.rubricId
    if (rubricId) {
      rubric = await repository.findRubricById(rubricId)
      if (rubric) criteria = await repository.findCriteriaByRubricId(rubric._id || rubric.id)
    }

    return {
      repository: normalizedRepository,
      commits,
      commitDiffs,
      staticResultsByCommit,
      impactDecisions,
      rubric,
      criteria,
      existingPerPushReviews: existingPerPushReviews.filter(review => review.reviewKind === 'PER_PUSH_TECHNICAL_AUDIT'),
      promptInput: buildAggregatePromptInput({
        repository: normalizedRepository,
        commits,
        commitDiffs,
        staticResultsByCommit,
        impactDecisions,
        existingPerPushReviews: existingPerPushReviews.filter(review => review.reviewKind === 'PER_PUSH_TECHNICAL_AUDIT'),
        rubric,
        criteria
      })
    }
  }

  const listRepositoryAiReviews = async ({ repositoryId, query = {} }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const [aiReviews, totalItems] = await Promise.all([
      repository.listAiReviewsByRepository({ repositoryId, skip, limit }),
      repository.countAiReviewsByRepository(repositoryId)
    ])

    return {
      repository: normalizeRepository(existingRepository),
      aiReviews: aiReviews.map(normalizeAiReview),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getAiReviewById = async (id) => {
    const aiReview = await repository.findAiReviewById(id)
    if (!aiReview) throw new ApiError(ERROR_CODES.NOT_FOUND, ['AI review not found'])

    const [criteria, technicalFindings, suggestedTestCases, suggestedJudgeQuestions] = await Promise.all([
      repository.listAiReviewCriteria(aiReview._id || aiReview.id),
      repository.listTechnicalFindings(aiReview._id || aiReview.id),
      repository.listSuggestedTestCases(aiReview._id || aiReview.id),
      repository.listSuggestedJudgeQuestions(aiReview._id || aiReview.id)
    ])

    return {
      ...normalizeAiReview(aiReview),
      reviewCriteria: criteria,
      technicalFindings,
      suggestedTestCases,
      suggestedJudgeQuestions
    }
  }

  const createPerPushAudit = async ({ repositoryId, commitSha, requestedBy }) => {
    const evidence = await buildPerPushEvidence({ repositoryId, commitSha })
    const reviewStatus = evidence.impactDecision.decision

    if (reviewStatus === 'SKIP_LLM' || reviewStatus === 'BATCH_HOURLY_AUDIT') {
      const aiReview = await repository.createAiReview({
        eventId: evidence.repository.eventId,
        teamId: evidence.repository.teamId,
        roundId: evidence.repository.roundId || undefined,
        repositoryId,
        commitId: evidence.commit?._id || undefined,
        commitDiffId: evidence.commitDiff?._id || undefined,
        impactDecisionId: evidence.impactDecision?._id || evidence.impactDecision?.id || undefined,
        reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
        status: 'SKIPPED',
        isScoreBased: false,
        isFinalDecision: false,
        needsHumanReview: false,
        summary: `Per-push AI audit skipped because impact decision is ${reviewStatus}`,
        overallSummary: `Per-push AI audit skipped because impact decision is ${reviewStatus}`,
        commitSha: evidence.commit?.commitSha || evidence.commitDiff?.headCommitSha,
        promptInput: evidence.promptInput,
        normalizedOutput: buildFallbackOutput({
          reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
          impactDecision: evidence.impactDecision,
          reason: `AI audit skipped because impact decision is ${reviewStatus}`
        }),
        requestedBy,
        requestedAt: new Date(),
        completedAt: new Date()
      })

      return {
        review: normalizeAiReview(await repository.findAiReviewById(aiReview._id)),
        skipped: true
      }
    }

    const aiReview = await repository.createAiReview({
      eventId: evidence.repository.eventId,
      teamId: evidence.repository.teamId,
      roundId: evidence.repository.roundId || undefined,
      repositoryId,
      commitId: evidence.commit?._id || undefined,
      commitDiffId: evidence.commitDiff?._id || undefined,
      impactDecisionId: evidence.impactDecision?._id || evidence.impactDecision?.id || undefined,
      reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
      status: 'PENDING',
      isScoreBased: false,
      isFinalDecision: false,
      needsHumanReview: Boolean(evidence.impactDecision.needsHumanReview),
      commitSha: evidence.commit?.commitSha || evidence.commitDiff?.headCommitSha,
      promptInput: evidence.promptInput,
      requestedBy,
      requestedAt: new Date()
    })

    let generated
    try {
      generated = await llmService.generateAudit({
        reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
        promptInput: evidence.promptInput
      })
    } catch (error) {
      generated = {
        rawResponse: '',
        modelName: null,
        tokenUsage: null,
        provider: null,
        errorMessage: error.message
      }
    }

    const rawResponse = generated.rawResponse || ''
    const normalized = await validateAndNormalizeAiOutput({
      rawResponse,
      reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
      impactDecision: evidence.impactDecision
    })

    await persistStructuredArtifacts({
      aiReviewId: aiReview._id,
      normalizedOutput: normalized.normalizedOutput,
      criteria: evidence.criteria
    })

    const updatedAiReview = await repository.updateAiReviewById(aiReview._id, {
      provider: generated.provider || null,
      model: generated.modelName || null,
      modelName: generated.modelName || null,
      status: normalized.usedFallback ? 'FALLBACK' : 'COMPLETED',
      summary: normalized.normalizedOutput.overallPicture?.pushSummary || '',
      overallSummary: normalized.normalizedOutput.overallPicture?.pushSummary || '',
      techStackDetected: detectTechStack({
        repository: evidence.repository,
        commitDiff: evidence.commitDiff
      }),
      riskSummary: ensureArray(normalized.normalizedOutput.technicalFindings).map(finding => ({
        severity: finding.severity,
        title: finding.title
      })),
      promptVersion: 'v1',
      promptInput: evidence.promptInput,
      rawResponse: normalized.rawResponse,
      normalizedOutput: normalized.normalizedOutput,
      tokenUsage: generated.tokenUsage || null,
      needsHumanReview: Boolean(normalized.normalizedOutput.needsHumanReview || evidence.impactDecision.needsHumanReview),
      completedAt: new Date(),
      lastError: generated.errorMessage || null
    })

    return {
      review: normalizeAiReview(updatedAiReview),
      skipped: false
    }
  }

  const createTeamAggregateAudit = async ({ repositoryId, batchId, requestedBy }) => {
    const evidence = await buildAggregateEvidence({ repositoryId })

    const aiReview = await repository.createAiReview({
      eventId: evidence.repository.eventId,
      teamId: evidence.repository.teamId,
      roundId: evidence.repository.roundId || undefined,
      repositoryId,
      reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
      status: 'PENDING',
      isScoreBased: false,
      isFinalDecision: false,
      needsHumanReview: false,
      batchId: batchId || undefined,
      promptInput: evidence.promptInput,
      requestedBy,
      requestedAt: new Date()
    })

    let generated
    try {
      generated = await llmService.generateAudit({
        reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
        promptInput: evidence.promptInput
      })
    } catch (error) {
      generated = {
        rawResponse: '',
        modelName: null,
        tokenUsage: null,
        provider: null,
        errorMessage: error.message
      }
    }

    const normalized = await validateAndNormalizeAiOutput({
      rawResponse: generated.rawResponse || '',
      reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
      impactDecision: evidence.impactDecisions[0] || null
    })

    await persistStructuredArtifacts({
      aiReviewId: aiReview._id,
      normalizedOutput: normalized.normalizedOutput,
      criteria: evidence.criteria
    })

    const updatedAiReview = await repository.updateAiReviewById(aiReview._id, {
      provider: generated.provider || null,
      model: generated.modelName || null,
      modelName: generated.modelName || null,
      status: normalized.usedFallback ? 'FALLBACK' : 'COMPLETED',
      summary: normalized.normalizedOutput.overallPicture?.pushSummary || '',
      overallSummary: normalized.normalizedOutput.overallPicture?.pushSummary || '',
      techStackDetected: detectTechStack({
        repository: evidence.repository,
        commitDiff: evidence.commitDiffs[0] || null
      }),
      riskSummary: ensureArray(normalized.normalizedOutput.technicalFindings).map(finding => ({
        severity: finding.severity,
        title: finding.title
      })),
      promptVersion: 'v1',
      promptInput: evidence.promptInput,
      rawResponse: normalized.rawResponse,
      normalizedOutput: normalized.normalizedOutput,
      tokenUsage: generated.tokenUsage || null,
      needsHumanReview: Boolean(normalized.normalizedOutput.needsHumanReview),
      completedAt: new Date(),
      lastError: generated.errorMessage || null
    })

    return {
      review: normalizeAiReview(updatedAiReview)
    }
  }

  const requestPerPushAudit = async ({ repositoryId, commitSha, requestedBy }) => {
    const evidence = await buildPerPushEvidence({ repositoryId, commitSha })
    await queueService.enqueueRunPerPushAudit({
      repositoryId,
      commitSha: evidence.commit?.commitSha || evidence.commitDiff?.headCommitSha,
      requestedBy
    })

    return {
      repositoryId,
      commitSha: evidence.commit?.commitSha || evidence.commitDiff?.headCommitSha,
      queuedJobType: JOB_TYPES.RUN_PER_PUSH_AUDIT
    }
  }

  const requestTeamAggregateAudit = async ({ repositoryId, batchId, requestedBy }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])

    await queueService.enqueueRunTeamAggregateAudit({
      repositoryId,
      batchId,
      requestedBy
    })

    return {
      repositoryId,
      batchId: batchId || null,
      queuedJobType: JOB_TYPES.RUN_TEAM_AGGREGATE_AUDIT
    }
  }

  const getTeamAiAuditSummary = async ({ teamId, limit = 5, reviewKind }) => {
    const team = await repository.findTeamById(teamId)
    if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

    const reviews = (await repository.listAiReviewsByTeam({ teamId, limit: Math.max(limit, 20) }))
      .filter(review => !reviewKind || review.reviewKind === reviewKind)
      .slice(0, limit)

    return {
      team: {
        id: team._id?.toString?.() || team.id,
        name: team.name,
        chapterName: team.chapterName,
        projectName: team.projectName,
        status: team.status
      },
      reviews: reviews.map(normalizeAiReview),
      latestAggregateReview: reviews.find(review => review.reviewKind === 'TEAM_AGGREGATE_TECHNICAL_AUDIT')
        ? normalizeAiReview(reviews.find(review => review.reviewKind === 'TEAM_AGGREGATE_TECHNICAL_AUDIT'))
        : null
    }
  }

  const queuePerPushAudit = async ({ repositoryId, commitSha, requestedBy }) => {
    await queueService.enqueueRunPerPushAudit({ repositoryId, commitSha, requestedBy })
    return { queuedJobType: JOB_TYPES.RUN_PER_PUSH_AUDIT }
  }

  const queueTeamAggregateAudit = async ({ repositoryId, batchId, requestedBy }) => {
    await queueService.enqueueRunTeamAggregateAudit({ repositoryId, batchId, requestedBy })
    return { queuedJobType: JOB_TYPES.RUN_TEAM_AGGREGATE_AUDIT }
  }

  return {
    listRepositoryAiReviews,
    getAiReviewById,
    requestPerPushAudit,
    requestTeamAggregateAudit,
    createPerPushAudit,
    createTeamAggregateAudit,
    getTeamAiAuditSummary,
    queuePerPushAudit,
    queueTeamAggregateAudit,
    processPerPushAuditJob: createPerPushAudit,
    processTeamAggregateAuditJob: createTeamAggregateAudit,
    buildPerPushEvidence,
    validateAndNormalizeAiOutput
  }
}

export const AI_REVIEW_SERVICE = createAiReviewService()
