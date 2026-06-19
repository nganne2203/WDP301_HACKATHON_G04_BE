import Joi from 'joi'

import { AI_REVIEW_REPOSITORY } from './ai-review.repository.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_RESULTS } from '#constants/audit.js'
import { JOB_TYPES } from '#constants/queue.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { AUDIT_LOG_SERVICE } from '#modules/audit-logs/audit-log.service.js'
import ApiError from '#utils/ApiError.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'
import { N8N_SERVICE } from '#services/n8n.service.js'
import { env } from '#configs/environment.js'
import { LOGGER } from '#utils/logger.js'

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

const AI_REVIEW_REDISPATCHABLE_STATUSES = new Set(['FAILED', 'RETRY_PENDING', 'MANUAL_REDISPATCH_REQUIRED'])

const aiReviewOutputSchema = Joi.object({
  reviewKind: Joi.string().valid('PER_PUSH_TECHNICAL_AUDIT', 'TEAM_AGGREGATE_TECHNICAL_AUDIT').required(),
  status: Joi.string().valid('DONE').required(),
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
  historicalSynthesis: Joi.string().allow('', null),
  currentTechnicalSnapshot: Joi.string().allow('', null),
  riskSummary: Joi.array().items(Joi.object({
    severity: severity.required(),
    title: Joi.string().required(),
    summary: Joi.string().allow('', null)
  })).default([]),
  judgeDashboardSummary: Joi.object({
    headline: Joi.string().allow('', null),
    needsHumanReview: Joi.boolean().required(),
    primaryConcerns: Joi.array().items(Joi.string()).default([]),
    recommendedJudgeFocus: Joi.array().items(Joi.string()).default([])
  }),
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
    retryCount: Number(plain.retryCount || 0),
    lastError: plain.lastError || null,
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

const buildRubricContext = ({ rubric, criteria }) => {
  if (!rubric) return null

  return {
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
      judgeOnly: Boolean(criterion.judgeOnly),
      aiSupportForAudit: criterion.aiSupportForAudit !== false,
      aiInstruction: criterion.aiInstruction || null,
      order: index
    }))
  }
}

const enrichCanonicalAggregateOutput = ({ reviewKind, normalizedOutput }) => {
  if (reviewKind !== 'TEAM_AGGREGATE_TECHNICAL_AUDIT') {
    return normalizedOutput
  }

  const technicalFindings = ensureArray(normalizedOutput.technicalFindings)
  const suggestedJudgeQuestions = ensureArray(normalizedOutput.suggestedJudgeQuestions)
  const riskSummary = ensureArray(normalizedOutput.riskSummary).length > 0
    ? ensureArray(normalizedOutput.riskSummary)
    : technicalFindings.map(finding => ({
      severity: finding.severity,
      title: finding.title,
      summary: finding.comment || finding.recommendedAction || ''
    }))

  const judgeDashboardSummary = normalizedOutput.judgeDashboardSummary || {
    headline: normalizedOutput.overallPicture?.pushSummary || '',
    needsHumanReview: Boolean(normalizedOutput.needsHumanReview),
    primaryConcerns: riskSummary.slice(0, 3).map(item => item.title),
    recommendedJudgeFocus: suggestedJudgeQuestions.slice(0, 3)
  }

  const historicalSynthesis = normalizedOutput.historicalSynthesis
    || normalizedOutput.overallPicture?.pushSummary
    || 'Aggregate technical review generated from repository evidence.'

  const currentTechnicalSnapshot = normalizedOutput.currentTechnicalSnapshot
    || technicalFindings
      .slice(0, 3)
      .map(finding => `${finding.severity}: ${finding.title}`)
      .join(' ')
    || 'No strong technical findings were detected from the sampled evidence.'

  return {
    ...normalizedOutput,
    historicalSynthesis,
    currentTechnicalSnapshot,
    riskSummary,
    judgeDashboardSummary
  }
}

export const createAiReviewService = ({
  repository = AI_REVIEW_REPOSITORY,
  queueService = QUEUE_SERVICE,
  scoreSheetRepository = {
    async touch() {}
  },
  rankingRepository = {
    async touch() {}
  },
  auditLogService = AUDIT_LOG_SERVICE
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

  const validateAndNormalizeAiOutput = async ({ rawResponse, reviewKind }) => {
    const parsed = safeJsonParse(rawResponse)
    const sanitized = forbiddenFieldSanitizer(parsed)
    const { error, value } = aiReviewOutputSchema.validate(sanitized, {
      abortEarly: false,
      stripUnknown: true
    })
    if (error) {
      throw new Error(error.details.map(detail => detail.message).join('; '))
    }

    return {
      rawResponse,
      normalizedOutput: enrichCanonicalAggregateOutput({
        reviewKind,
        normalizedOutput: value
      }),
      usedFallback: false
    }
  }

  const getMaxDispatchRetries = () => {
    const configured = Number(env.n8n?.dispatchMaxRetries ?? 2)
    if (Number.isNaN(configured)) return 2
    return Math.max(0, configured)
  }

  const buildAiReviewCallbackUrl = (aiReviewId) => {
    return `${String(env.server.publicUrl || '').replace(/\/$/, '')}/api/ai-reviews/${aiReviewId}/callback`
  }

  const enqueueAiReviewRedispatch = async ({ aiReview, requestedBy, manualRedispatch = false }) => {
    const payload = {
      repositoryId: aiReview.repositoryId?._id?.toString?.() || aiReview.repositoryId?.toString?.() || aiReview.repositoryId,
      requestedBy,
      aiReviewId: aiReview._id?.toString?.() || aiReview.id,
      retryCount: Number(aiReview.retryCount || 0),
      manualRedispatch
    }

    if (aiReview.reviewKind === 'PER_PUSH_TECHNICAL_AUDIT') {
      payload.commitSha = aiReview.commitSha || null
      await queueService.enqueueRunPerPushAudit(payload)
      return JOB_TYPES.RUN_PER_PUSH_AUDIT
    }

    payload.batchId = aiReview.batchId || null
    await queueService.enqueueRunTeamAggregateAudit(payload)
    return JOB_TYPES.RUN_TEAM_AGGREGATE_AUDIT
  }

  const dispatchAiReviewToN8n = async ({ aiReview, promptInput }) => {
    if (!env.n8n?.enabled) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['n8n integration must be enabled for AI reviews'])
    }

    const callbackUrl = buildAiReviewCallbackUrl(aiReview._id?.toString?.() || aiReview.id)
    const aiReviewId = aiReview._id?.toString?.() || aiReview.id

    if (aiReview.reviewKind === 'PER_PUSH_TECHNICAL_AUDIT') {
      await N8N_SERVICE.triggerPerPushAudit({
        reviewContext: promptInput,
        aiReviewId,
        callbackUrl
      })
      return
    }

    await N8N_SERVICE.triggerTeamAggregateAudit({
      reviewContext: promptInput,
      aiReviewId,
      callbackUrl
    })
  }

  const handleDispatchFailure = async ({
    aiReview,
    requestedBy,
    errorMessage,
    failureStage,
    repositoryId,
    manualRedispatch = false
  }) => {
    const nextRetryCount = Number(aiReview.retryCount || 0) + 1
    const shouldAutoRetry = !manualRedispatch && nextRetryCount <= getMaxDispatchRetries()
    const nextStatus = shouldAutoRetry ? 'RETRY_PENDING' : 'MANUAL_REDISPATCH_REQUIRED'

    const updatedAiReview = await repository.updateAiReviewById(aiReview._id || aiReview.id, {
      status: nextStatus,
      retryCount: nextRetryCount,
      lastError: errorMessage,
      completedAt: shouldAutoRetry ? null : new Date()
    })

    let queuedJobType = null
    if (shouldAutoRetry) {
      queuedJobType = await enqueueAiReviewRedispatch({
        aiReview: updatedAiReview,
        requestedBy,
        manualRedispatch: false
      })
    }

    writeAiAudit({
      userId: requestedBy,
      action: AUDIT_ACTIONS.AI_REVIEW_FAILED,
      review: normalizeAiReview(updatedAiReview),
      repositoryId,
      result: AUDIT_RESULTS.FAILURE,
      errorMessage,
      metadata: {
        failureStage,
        queuedJobType,
        autoRetryScheduled: shouldAutoRetry,
        manualRedispatchRequired: !shouldAutoRetry
      }
    })

    return {
      review: normalizeAiReview(updatedAiReview),
      failed: !shouldAutoRetry,
      retryScheduled: shouldAutoRetry,
      queuedJobType
    }
  }

  const redispatchAiReview = async ({ aiReviewId, requestedBy, manualRedispatch = false }) => {
    const existingAiReview = await repository.findAiReviewById(aiReviewId)
    if (!existingAiReview) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['AI review not found'])
    }

    if (!AI_REVIEW_REDISPATCHABLE_STATUSES.has(existingAiReview.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['AI review is not eligible for redispatch'])
    }

    const repositoryId = existingAiReview.repositoryId?._id?.toString?.() || existingAiReview.repositoryId?.toString?.() || existingAiReview.repositoryId
    const updatedAiReview = await repository.updateAiReviewById(existingAiReview._id || existingAiReview.id, {
      status: 'PENDING',
      completedAt: null,
      lastError: null
    })

    try {
      await dispatchAiReviewToN8n({
        aiReview: updatedAiReview,
        promptInput: updatedAiReview.promptInput
      })

      writeAiAudit({
        userId: requestedBy,
        action: AUDIT_ACTIONS.AI_REVIEW_REQUESTED,
        review: normalizeAiReview(updatedAiReview),
        repositoryId,
        metadata: {
          redispatched: true,
          manualRedispatch
        }
      })

      return {
        review: normalizeAiReview(updatedAiReview),
        pending: true,
        redispatched: true
      }
    } catch (error) {
      return await handleDispatchFailure({
        aiReview: updatedAiReview,
        requestedBy,
        errorMessage: error.message,
        failureStage: manualRedispatch ? 'MANUAL_REDISPATCH' : 'AUTO_RETRY_DISPATCH',
        repositoryId,
        manualRedispatch
      })
    }
  }

  const writeAiAudit = ({ userId, action, review, repositoryId, result = AUDIT_RESULTS.SUCCESS, errorMessage = null, metadata = {} }) => {
    auditLogService.createAuditLog({
      userId,
      action,
      entityType: AUDIT_ENTITY_TYPES.AI_REVIEW,
      entityId: review?.id || review?._id || null,
      resourceType: AUDIT_ENTITY_TYPES.AI_REVIEW,
      resourceId: review?.id || review?._id || null,
      result,
      errorMessage,
      sourceModule: 'ai-reviews',
      description: `${action} for repository ${repositoryId}`,
      metadata: {
        repositoryId,
        reviewKind: review?.reviewKind,
        status: review?.status,
        commitSha: review?.commitSha,
        ...metadata
      }
    }).catch(() => {})
  }

  const loadRepositoryAuditContext = async ({ repositoryId }) => {
    const existingRepository = await repository.findRepositoryById(repositoryId)
    if (!existingRepository) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Repository not found'])
    const normalizedRepository = normalizeRepository(existingRepository)

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
      rubric,
      criteria
    }
  }

  const resolvePerPushCommitSha = ({ repository: normalizedRepository, commitSha }) => {
    const targetCommitSha = commitSha || normalizedRepository.lastProcessedCommitSha || normalizedRepository.latestCommitSha
    if (!targetCommitSha) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['commitSha is required when repository has no tracked commit'])
    }
    return targetCommitSha
  }

  const buildPerPushDispatchPayload = ({
    normalizedRepository,
    rubric,
    criteria,
    commitSha,
    branch = null,
    beforeCommitSha = null,
    deliveryId = null,
    deliveryEventId = null,
    triggerSource = 'manual'
  }) => {
    return {
      reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
      eventContext: normalizedRepository.event || null,
      roundContext: normalizedRepository.round || null,
      repositoryContext: {
        id: normalizedRepository.id,
        repositoryFullName: normalizedRepository.repositoryFullName,
        githubOwner: normalizedRepository.githubOwner,
        githubRepo: normalizedRepository.githubRepo,
        defaultBranch: normalizedRepository.defaultBranch,
        latestCommitSha: normalizedRepository.latestCommitSha,
        lastProcessedCommitSha: normalizedRepository.lastProcessedCommitSha,
        team: normalizedRepository.team || null
      },
      triggerContext: {
        source: triggerSource,
        deliveryId,
        deliveryEventId,
        branch: branch || normalizedRepository.defaultBranch || null,
        beforeCommitSha,
        afterCommitSha: commitSha,
        commitSha
      },
      rubricContext: buildRubricContext({ rubric, criteria }),
      requiredOutputSchema: 'PHASE_8_AI_TECHNICAL_AUDITOR_V1',
      callbackContract: {
        acceptedStatuses: ['success', 'error'],
        requiredCallbackFields: ['aiReviewId', 'status'],
        optionalCallbackFields: ['rawResponse', 'modelName', 'provider', 'tokenUsage', 'errorMessage', 'commits']
      }
    }
  }

  const buildAggregateDispatchPayload = ({
    normalizedRepository,
    rubric,
    criteria,
    batchId = null,
    triggerSource = 'manual'
  }) => {
    return {
      reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
      eventContext: normalizedRepository.event || null,
      roundContext: normalizedRepository.round || null,
      repositoryContext: {
        id: normalizedRepository.id,
        repositoryFullName: normalizedRepository.repositoryFullName,
        githubOwner: normalizedRepository.githubOwner,
        githubRepo: normalizedRepository.githubRepo,
        defaultBranch: normalizedRepository.defaultBranch,
        latestCommitSha: normalizedRepository.latestCommitSha,
        lastProcessedCommitSha: normalizedRepository.lastProcessedCommitSha,
        team: normalizedRepository.team || null
      },
      aggregateContext: {
        source: triggerSource,
        batchId
      },
      rubricContext: buildRubricContext({ rubric, criteria }),
      aggregateReportContract: {
        historicalSynthesis: 'Summarize technical evolution across the commit history.',
        currentTechnicalSnapshot: 'Describe the current architecture and code health snapshot.',
        riskSummary: 'List the most important technical risks with severity and short summary.',
        judgeDashboardSummary: 'Provide a short judge-facing headline, top concerns, and follow-up focus areas.'
      },
      requiredOutputSchema: 'PHASE_8_AI_TECHNICAL_AUDITOR_V1',
      callbackContract: {
        acceptedStatuses: ['success', 'error'],
        requiredCallbackFields: ['aiReviewId', 'status'],
        optionalCallbackFields: ['rawResponse', 'modelName', 'provider', 'tokenUsage', 'errorMessage', 'commits']
      }
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

  const createPerPushAudit = async ({
    repositoryId,
    commitSha,
    requestedBy,
    aiReviewId = null,
    manualRedispatch = false,
    branch = null,
    beforeCommitSha = null,
    deliveryId = null,
    deliveryEventId = null,
    source = 'manual'
  }) => {
    if (aiReviewId) {
      return await redispatchAiReview({ aiReviewId, requestedBy, manualRedispatch })
    }

    const context = await loadRepositoryAuditContext({ repositoryId })
    const targetCommitSha = resolvePerPushCommitSha({
      repository: context.repository,
      commitSha
    })
    const promptInput = buildPerPushDispatchPayload({
      normalizedRepository: context.repository,
      rubric: context.rubric,
      criteria: context.criteria,
      commitSha: targetCommitSha,
      branch,
      beforeCommitSha,
      deliveryId,
      deliveryEventId,
      triggerSource: source
    })

    const aiReview = await repository.createAiReview({
      eventId: context.repository.eventId,
      teamId: context.repository.teamId,
      roundId: context.repository.roundId || undefined,
      repositoryId,
      reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
      status: 'PENDING',
      isScoreBased: false,
      isFinalDecision: false,
      needsHumanReview: false,
      commitSha: targetCommitSha,
      promptInput,
      requestedBy,
      requestedAt: new Date()
    })

    try {
      await dispatchAiReviewToN8n({
        aiReview,
        promptInput
      })

      return {
        review: normalizeAiReview(aiReview),
        skipped: false,
        pending: true
      }
    } catch (error) {
      return await handleDispatchFailure({
        aiReview,
        requestedBy,
        errorMessage: error.message,
        failureStage: 'N8N_TRIGGER',
        repositoryId
      })
    }
  }

  const createTeamAggregateAudit = async ({ repositoryId, batchId, requestedBy, aiReviewId = null, manualRedispatch = false }) => {
    if (aiReviewId) {
      return await redispatchAiReview({ aiReviewId, requestedBy, manualRedispatch })
    }

    const context = await loadRepositoryAuditContext({ repositoryId })
    const promptInput = buildAggregateDispatchPayload({
      normalizedRepository: context.repository,
      rubric: context.rubric,
      criteria: context.criteria,
      batchId
    })

    const aiReview = await repository.createAiReview({
      eventId: context.repository.eventId,
      teamId: context.repository.teamId,
      roundId: context.repository.roundId || undefined,
      repositoryId,
      reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
      status: 'PENDING',
      isScoreBased: false,
      isFinalDecision: false,
      needsHumanReview: false,
      batchId: batchId || undefined,
      promptInput,
      requestedBy,
      requestedAt: new Date()
    })

    try {
      await dispatchAiReviewToN8n({
        aiReview,
        promptInput
      })
      return {
        review: normalizeAiReview(aiReview),
        pending: true
      }
    } catch (error) {
      return await handleDispatchFailure({
        aiReview,
        requestedBy,
        errorMessage: error.message,
        failureStage: 'N8N_TRIGGER',
        repositoryId
      })
    }
  }

  const handleAuditCallback = async ({
    aiReviewId,
    status,
    rawResponse,
    modelName,
    provider,
    tokenUsage,
    errorMessage,
    commits
  }) => {
    LOGGER.info('Handling AI review audit callback from n8n', { aiReviewId, status })

    const aiReview = await repository.findAiReviewById(aiReviewId)
    if (!aiReview) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['AI review record not found'])
    }

    if (aiReview.status !== 'PENDING') {
      LOGGER.warn('AI review record is not in PENDING status, ignoring callback', {
        aiReviewId,
        currentStatus: aiReview.status
      })
      return normalizeAiReview(aiReview)
    }

    const requestedBy = aiReview.requestedBy
    const repositoryId = aiReview.repositoryId

    const existingRepository = await repository.findRepositoryById(repositoryId)
    let criteria = []
    const rubricId = existingRepository?.roundId?.rubricId || existingRepository?.round?.rubricId
    if (rubricId) {
      const rubric = await repository.findRubricById(rubricId)
      if (rubric) {
        criteria = await repository.findCriteriaByRubricId(rubric._id || rubric.id)
      }
    }

    if (status === 'success' && rawResponse) {
      if (Array.isArray(commits)) {
        for (const commitData of commits) {
          await repository.upsertCommit({
            repositoryId,
            commitSha: commitData.commitSha,
            data: {
              branch: commitData.branch || 'main',
              authorName: commitData.authorName || 'unknown',
              authorEmail: commitData.authorEmail || '',
              authorUsername: commitData.authorUsername || '',
              timestamp: commitData.timestamp || new Date().toISOString(),
              message: commitData.message || '',
              linesAdded: commitData.linesAdded || 0,
              linesRemoved: commitData.linesRemoved || 0,
              filesChanged: commitData.filesChanged || 0
            }
          })
        }
      }

      try {
        const normalized = await validateAndNormalizeAiOutput({
          rawResponse,
          reviewKind: aiReview.reviewKind
        })

        await persistStructuredArtifacts({
          aiReviewId: aiReview._id,
          normalizedOutput: normalized.normalizedOutput,
          criteria
        })

        const updatedAiReview = await repository.updateAiReviewById(aiReview._id, {
          provider: provider || 'google',
          model: modelName || null,
          modelName: modelName || null,
          status: 'COMPLETED',
          summary: normalized.normalizedOutput.overallPicture?.pushSummary || '',
          overallSummary: normalized.normalizedOutput.overallPicture?.pushSummary || '',
          techStackDetected: normalized.normalizedOutput.techStackDetected || null,
          riskSummary: ensureArray(normalized.normalizedOutput.technicalFindings).map(finding => ({
            severity: finding.severity,
            title: finding.title
          })),
          promptVersion: 'v1',
          rawResponse: normalized.rawResponse,
          normalizedOutput: normalized.normalizedOutput,
          tokenUsage: tokenUsage || null,
          needsHumanReview: Boolean(normalized.normalizedOutput.needsHumanReview || aiReview.needsHumanReview),
          completedAt: new Date(),
          lastError: null
        })

        writeAiAudit({
          userId: requestedBy,
          action: AUDIT_ACTIONS.AI_REVIEW_COMPLETED,
          review: normalizeAiReview(updatedAiReview),
          repositoryId,
          result: AUDIT_RESULTS.SUCCESS
        })

        return normalizeAiReview(updatedAiReview)
      } catch (error) {
        const updatedAiReview = await repository.updateAiReviewById(aiReview._id, {
          provider: provider || 'google',
          model: modelName || null,
          modelName: modelName || null,
          rawResponse: rawResponse || ''
        })

        return (await handleDispatchFailure({
          aiReview: updatedAiReview,
          requestedBy,
          errorMessage: error.message,
          failureStage: 'CALLBACK_NORMALIZATION',
          repositoryId
        })).review
      }
    }

    LOGGER.warn('n8n callback reported an error, scheduling retry or manual redispatch', {
      aiReviewId,
      errorMessage
    })

    return (await handleDispatchFailure({
      aiReview,
      requestedBy,
      errorMessage: errorMessage || 'n8n callback reported failure',
      failureStage: 'N8N_CALLBACK',
      repositoryId
    })).review
  }

  const requestPerPushAudit = async ({ repositoryId, commitSha, requestedBy }) => {
    const context = await loadRepositoryAuditContext({ repositoryId })
    const targetCommitSha = resolvePerPushCommitSha({
      repository: context.repository,
      commitSha
    })

    await queueService.enqueueRunPerPushAudit({
      repositoryId,
      commitSha: targetCommitSha,
      requestedBy
    })

    writeAiAudit({
      userId: requestedBy,
      action: AUDIT_ACTIONS.AI_REVIEW_REQUESTED,
      repositoryId,
      review: {
        reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
        commitSha: targetCommitSha,
        status: 'QUEUED'
      },
      metadata: { queuedJobType: JOB_TYPES.RUN_PER_PUSH_AUDIT }
    })

    return {
      repositoryId,
      commitSha: targetCommitSha,
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

    writeAiAudit({
      userId: requestedBy,
      action: AUDIT_ACTIONS.AI_REVIEW_REQUESTED,
      repositoryId,
      review: {
        reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
        status: 'QUEUED'
      },
      metadata: { queuedJobType: JOB_TYPES.RUN_TEAM_AGGREGATE_AUDIT, batchId }
    })

    return {
      repositoryId,
      batchId: batchId || null,
      queuedJobType: JOB_TYPES.RUN_TEAM_AGGREGATE_AUDIT
    }
  }

  const requestAiReviewRedispatch = async ({ aiReviewId, requestedBy }) => {
    const aiReview = await repository.findAiReviewById(aiReviewId)
    if (!aiReview) throw new ApiError(ERROR_CODES.NOT_FOUND, ['AI review not found'])
    if (!AI_REVIEW_REDISPATCHABLE_STATUSES.has(aiReview.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['AI review is not eligible for redispatch'])
    }

    const updatedAiReview = await repository.updateAiReviewById(aiReview._id || aiReview.id, {
      status: 'RETRY_PENDING',
      completedAt: null,
      lastError: null
    })

    const queuedJobType = await enqueueAiReviewRedispatch({
      aiReview: updatedAiReview,
      requestedBy,
      manualRedispatch: true
    })

    writeAiAudit({
      userId: requestedBy,
      action: AUDIT_ACTIONS.AI_REVIEW_REQUESTED,
      review: normalizeAiReview(updatedAiReview),
      repositoryId: updatedAiReview.repositoryId?._id?.toString?.() || updatedAiReview.repositoryId?.toString?.() || updatedAiReview.repositoryId,
      metadata: {
        queuedJobType,
        manualRedispatch: true
      }
    })

    return {
      aiReviewId: updatedAiReview._id?.toString?.() || updatedAiReview.id,
      queuedJobType,
      review: normalizeAiReview(updatedAiReview)
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
    requestAiReviewRedispatch,
    createPerPushAudit,
    createTeamAggregateAudit,
    redispatchAiReview,
    handleAuditCallback,
    getTeamAiAuditSummary,
    queuePerPushAudit,
    queueTeamAggregateAudit,
    processPerPushAuditJob: createPerPushAudit,
    processTeamAggregateAuditJob: createTeamAggregateAudit,
    validateAndNormalizeAiOutput
  }
}

export const AI_REVIEW_SERVICE = createAiReviewService()
