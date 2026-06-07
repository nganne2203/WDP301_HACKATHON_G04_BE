import assert from 'node:assert/strict'
import test from 'node:test'

import { createAiReviewService } from '../src/modules/ai-reviews/ai-review.service.js'

const createAiReviewRepository = () => {
  const repositories = new Map()
  const commits = new Map()
  const commitDiffs = new Map()
  const staticResults = new Map()
  const changedContexts = new Map()
  const impactDecisions = new Map()
  const aiReviews = new Map()
  const reviewCriteria = new Map()
  const technicalFindings = new Map()
  const suggestedTestCases = new Map()
  const suggestedJudgeQuestions = new Map()
  const teams = new Map()
  const rubrics = new Map()
  const criteriaByRubric = new Map()
  let reviewSeq = 1

  return {
    stores: {
      repositories,
      commits,
      commitDiffs,
      staticResults,
      changedContexts,
      impactDecisions,
      aiReviews,
      reviewCriteria,
      technicalFindings,
      suggestedTestCases,
      suggestedJudgeQuestions,
      teams,
      rubrics,
      criteriaByRubric
    },
    repository: {
      findRepositoryById: async (id) => repositories.get(id) || null,
      findTeamById: async (id) => teams.get(id) || null,
      findRepositoriesByTeamId: async (teamId) => [...repositories.values()].filter(repository => repository.teamId?._id === teamId || repository.teamId === teamId),
      findEventById: async () => null,
      findRoundById: async () => null,
      findRubricById: async (id) => rubrics.get(id) || null,
      findCriteriaByRubricId: async (rubricId) => criteriaByRubric.get(rubricId) || [],
      findCommitByRepositoryAndSha: async ({ repositoryId, commitSha }) => commits.get(`${repositoryId}:${commitSha}`) || null,
      findLatestCommitsByRepository: async ({ repositoryId, limit }) => [...commits.values()].filter(commit => commit.repositoryId === repositoryId).slice(0, limit),
      findCommitDiffByRepositoryAndHeadSha: async ({ repositoryId, headCommitSha }) => commitDiffs.get(`${repositoryId}:${headCommitSha}`) || null,
      findLatestCommitDiffsByRepository: async ({ repositoryId, limit }) => [...commitDiffs.values()].filter(diff => diff.repositoryId === repositoryId).slice(0, limit),
      listStaticAnalysisResultsByRepositoryAndCommit: async ({ repositoryId, commitSha }) => staticResults.get(`${repositoryId}:${commitSha}`) || [],
      listChangedCodeContextsByRepositoryAndCommit: async ({ repositoryId, commitSha }) => changedContexts.get(`${repositoryId}:${commitSha}`) || [],
      findImpactDecisionByRepositoryAndCommit: async ({ repositoryId, commitSha }) => impactDecisions.get(`${repositoryId}:${commitSha}`) || null,
      listImpactDecisionsByRepository: async ({ repositoryId, limit }) => [...impactDecisions.values()].filter(item => item.repositoryId === repositoryId).slice(0, limit),
      createAiReview: async (data) => {
        const id = String(reviewSeq).padStart(24, '0')
        reviewSeq += 1
        const created = { _id: id, ...data }
        aiReviews.set(id, created)
        return created
      },
      updateAiReviewById: async (id, data) => {
        const updated = { ...aiReviews.get(id), ...data, _id: id }
        aiReviews.set(id, updated)
        return updated
      },
      findAiReviewById: async (id) => aiReviews.get(id) || null,
      listAiReviewsByRepository: async ({ repositoryId }) => [...aiReviews.values()].filter(review => review.repositoryId === repositoryId),
      countAiReviewsByRepository: async (repositoryId) => [...aiReviews.values()].filter(review => review.repositoryId === repositoryId).length,
      listAiReviewsByTeam: async ({ teamId, limit }) => [...aiReviews.values()].filter(review => review.teamId === teamId).slice(0, limit),
      replaceAiReviewCriteria: async ({ aiReviewId, criteria }) => {
        reviewCriteria.set(aiReviewId, criteria)
        return criteria
      },
      replaceTechnicalFindings: async ({ aiReviewId, findings }) => {
        technicalFindings.set(aiReviewId, findings)
        return findings
      },
      replaceSuggestedTestCases: async ({ aiReviewId, testCases }) => {
        suggestedTestCases.set(aiReviewId, testCases)
        return testCases
      },
      replaceSuggestedJudgeQuestions: async ({ aiReviewId, questions }) => {
        suggestedJudgeQuestions.set(aiReviewId, questions)
        return questions
      },
      listAiReviewCriteria: async (aiReviewId) => reviewCriteria.get(aiReviewId) || [],
      listTechnicalFindings: async (aiReviewId) => technicalFindings.get(aiReviewId) || [],
      listSuggestedTestCases: async (aiReviewId) => suggestedTestCases.get(aiReviewId) || [],
      listSuggestedJudgeQuestions: async (aiReviewId) => suggestedJudgeQuestions.get(aiReviewId) || []
    }
  }
}

const createRepositoryFixture = ({ impactDecision, commitSha = 'commit-1' }) => {
  const { repository, stores } = createAiReviewRepository()
  const repositoryId = 'repo-1'
  const teamId = 'team-1'
  const eventId = 'event-1'
  const roundId = 'round-1'
  const rubricId = 'rubric-1'

  stores.repositories.set(repositoryId, {
    _id: repositoryId,
    eventId: {
      _id: eventId,
      title: 'SEAL',
      semester: 'SP26',
      season: 'SPRING',
      year: 2026,
      status: 'ONGOING',
      competitionConfig: { boardCount: 2 }
    },
    teamId: {
      _id: teamId,
      name: 'Team Alpha',
      projectName: 'Alpha Project',
      chapterName: 'A',
      status: 'CONFIRMED'
    },
    roundId: {
      _id: roundId,
      name: 'Round 1',
      roundType: 'PRELIMINARY',
      status: 'OPEN',
      rubricId
    },
    repositoryFullName: 'seal-org/team-alpha',
    githubOwner: 'seal-org',
    githubRepo: 'team-alpha',
    defaultBranch: 'main',
    latestCommitSha: commitSha,
    lastProcessedCommitSha: commitSha
  })
  stores.teams.set(teamId, {
    _id: teamId,
    name: 'Team Alpha',
    projectName: 'Alpha Project',
    chapterName: 'A',
    status: 'CONFIRMED'
  })
  stores.commits.set(`${repositoryId}:${commitSha}`, {
    _id: `commit-${commitSha}`,
    repositoryId,
    commitSha,
    branch: 'main',
    authorName: 'Dev A',
    authorEmail: 'a@example.com',
    authorUsername: 'dev-a',
    timestamp: '2026-06-07T10:00:00.000Z',
    message: 'Update repository logic',
    commitUrl: 'https://github.com/seal-org/team-alpha/commit/commit-1',
    linesAdded: 10,
    linesRemoved: 2,
    filesChanged: 2
  })
  stores.commitDiffs.set(`${repositoryId}:${commitSha}`, {
    _id: `diff-${commitSha}`,
    repositoryId,
    headCommitSha: commitSha,
    totalFiles: 2,
    includedFiles: 2,
    excludedFiles: 0,
    totalCleanPatchSize: 150,
    diffText: 'RAW_DIFF_SHOULD_NOT_BE_USED',
    cleanDiffText: 'CLEAN_DIFF_ONLY',
    files: [{
      filePath: 'src/modules/repositories/repository-analysis.service.js',
      patch: 'RAW_PATCH_SHOULD_NOT_BE_USED',
      cleanPatch: '+async function runImpact() {}',
      patchSummary: 'Core analysis service updated',
      language: 'JavaScript',
      status: 'modified',
      isExcluded: false
    }]
  })
  stores.staticResults.set(`${repositoryId}:${commitSha}`, [{
    source: 'DEPENDENCY_SCAN',
    errorCount: 0,
    warningCount: 1,
    findings: [{
      severity: 'MEDIUM',
      title: 'New dependencies added',
      message: 'Dependency manifest changed'
    }]
  }])
  stores.changedContexts.set(`${repositoryId}:${commitSha}`, [{
    repositoryId,
    commitSha,
    filePath: 'src/modules/repositories/repository-analysis.service.js',
    symbolName: 'runImpact',
    symbolType: 'SERVICE_METHOD',
    startLine: 10,
    endLine: 20,
    contextSnippet: 'async function runImpact() {}',
    confidence: 'HIGH'
  }])
  stores.impactDecisions.set(`${repositoryId}:${commitSha}`, {
    _id: `impact-${commitSha}`,
    repositoryId,
    commitSha,
    impactScore: impactDecision.impactScore || 60,
    impactLevel: impactDecision.impactLevel,
    decision: impactDecision.decision,
    reasons: impactDecision.reasons || ['reason'],
    needsHumanReview: Boolean(impactDecision.needsHumanReview)
  })
  stores.rubrics.set(rubricId, {
    _id: rubricId,
    title: 'Technical Rubric',
    description: 'Judge rubric',
    totalScore: 100
  })
  stores.criteriaByRubric.set(rubricId, [{
    _id: 'criterion-1',
    name: 'Architecture',
    description: 'Architecture quality',
    maxScore: 25,
    weight: 1
  }])

  return { repository, stores, repositoryId, teamId, commitSha }
}

const validAiResponse = JSON.stringify({
  reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
  status: 'DONE',
  isScoreBased: false,
  isFinalDecision: false,
  overallPicture: {
    pushSummary: 'Core repository analysis service changed.',
    significantChange: true,
    changeImpactLevel: 'HIGH',
    mainAffectedAreas: ['Repository analysis']
  },
  techStackDetected: {
    frontend: [],
    backend: ['express'],
    database: ['mongoose'],
    ai: [],
    retrieval: [],
    testing: ['node:test']
  },
  technicalFindings: [{
    type: 'ARCHITECTURE',
    severity: 'HIGH',
    title: 'Core analysis path changed',
    evidence: ['repository-analysis.service.js'],
    comment: 'Review the impact-scoring behavior carefully.',
    recommendedAction: 'Add regression tests.'
  }],
  rubricAwareComments: [{
    criterionId: 'criterion-1',
    criterionName: 'Architecture',
    qualitativeLevel: 'GOOD',
    comment: 'Architecture changes are coherent.',
    evidence: ['Changed service method'],
    risks: ['Potential regression']
  }],
  suggestedTestCases: [{
    title: 'Regression for impact scoring',
    purpose: 'Verify high-impact routing',
    expectedObservation: 'High-impact commits trigger per-push audit.'
  }],
  suggestedJudgeQuestions: ['How do you control false positives in impact scoring?'],
  costControlNotes: {
    llmCallReason: 'High-impact change',
    skippedFiles: [],
    tokenSavingStrategy: ['Used clean diff only']
  },
  needsHumanReview: true,
  suggestedScore: 9.5
})

test('per-push audit is skipped for LOW/SKIP_LLM', async () => {
  const { repository, stores, repositoryId, commitSha } = createRepositoryFixture({
    impactDecision: { impactLevel: 'LOW', decision: 'SKIP_LLM' },
    commitSha: 'commit-low'
  })

  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async () => null,
      enqueueRunTeamAggregateAudit: async () => null
    }
  })

  const result = await service.createPerPushAudit({
    repositoryId,
    commitSha,
    requestedBy: 'user-1'
  })

  assert.equal(result.skipped, true)
  assert.equal(result.review.status, 'SKIPPED')
  assert.equal(stores.technicalFindings.size, 0)
})

test('per-push audit runs for HIGH/CALL_PER_PUSH_AUDIT and persists findings and questions', async () => {
  const { repository, stores, repositoryId, commitSha } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })
  let scoreSheetTouches = 0
  let rankingTouches = 0
  let capturedPrompt

  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async () => null,
      enqueueRunTeamAggregateAudit: async () => null
    },
    llmService: {
      async generateAudit({ promptInput }) {
        capturedPrompt = promptInput
        return {
          rawResponse: validAiResponse,
          modelName: 'mock-model',
          provider: 'mock',
          tokenUsage: { totalTokens: 100 }
        }
      },
      async repairJson() {
        throw new Error('should not repair')
      }
    },
    scoreSheetRepository: {
      async touch() { scoreSheetTouches += 1 }
    },
    rankingRepository: {
      async touch() { rankingTouches += 1 }
    }
  })

  const result = await service.createPerPushAudit({
    repositoryId,
    commitSha,
    requestedBy: 'user-1'
  })

  assert.equal(result.skipped, false)
  assert.equal(result.review.status, 'COMPLETED')
  assert.equal(stores.technicalFindings.size, 1)
  assert.equal(stores.suggestedJudgeQuestions.size, 1)
  assert.equal(scoreSheetTouches, 0)
  assert.equal(rankingTouches, 0)
  assert.equal(JSON.stringify(capturedPrompt).includes('RAW_DIFF_SHOULD_NOT_BE_USED'), false)
  assert.equal(JSON.stringify(capturedPrompt).includes('RAW_PATCH_SHOULD_NOT_BE_USED'), false)
  assert.equal(JSON.stringify(capturedPrompt).includes('CLEAN_DIFF_ONLY'), false)
  assert.equal(capturedPrompt.diffSummary.files[0].cleanPatch.includes('runImpact'), true)
})

test('urgent audit runs for CRITICAL impact', async () => {
  const { repository, repositoryId, commitSha } = createRepositoryFixture({
    impactDecision: { impactLevel: 'CRITICAL', decision: 'URGENT_AUDIT_AND_HUMAN_REVIEW', needsHumanReview: true }
  })

  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async () => null,
      enqueueRunTeamAggregateAudit: async () => null
    },
    llmService: {
      async generateAudit() {
        return {
          rawResponse: validAiResponse.replace('"HIGH"', '"CRITICAL"'),
          modelName: 'mock-model',
          provider: 'mock',
          tokenUsage: { totalTokens: 100 }
        }
      },
      async repairJson() {
        throw new Error('should not repair')
      }
    }
  })

  const result = await service.createPerPushAudit({
    repositoryId,
    commitSha,
    requestedBy: 'user-1'
  })

  assert.equal(result.review.status, 'COMPLETED')
  assert.equal(result.review.needsHumanReview, true)
})

test('forbidden scoring fields are removed from AI output', async () => {
  const { repository, stores, repositoryId, commitSha } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async () => null,
      enqueueRunTeamAggregateAudit: async () => null
    },
    llmService: {
      async generateAudit() {
        return {
          rawResponse: validAiResponse,
          modelName: 'mock-model',
          provider: 'mock'
        }
      },
      async repairJson() {
        throw new Error('should not repair')
      }
    }
  })

  await service.createPerPushAudit({
    repositoryId,
    commitSha,
    requestedBy: 'user-1'
  })

  const persistedReview = [...stores.aiReviews.values()].find(review => review.repositoryId === repositoryId && review.status === 'COMPLETED')
  assert.equal(Object.hasOwn(persistedReview.normalizedOutput, 'suggestedScore'), false)
})

test('malformed JSON triggers repair and fallback when repair fails', async () => {
  const { repository, stores, repositoryId, commitSha } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async () => null,
      enqueueRunTeamAggregateAudit: async () => null
    },
    llmService: {
      async generateAudit() {
        return {
          rawResponse: '{bad json',
          modelName: 'mock-model',
          provider: 'mock'
        }
      },
      async repairJson() {
        throw new Error('repair failed')
      }
    }
  })

  const result = await service.createPerPushAudit({
    repositoryId,
    commitSha,
    requestedBy: 'user-1'
  })

  assert.equal(result.review.status, 'FALLBACK')
  assert.equal(result.review.normalizedOutput.status, 'FALLBACK')
})

test('malformed JSON triggers repair successfully when repair returns valid JSON', async () => {
  const { repository, repositoryId, commitSha } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async () => null,
      enqueueRunTeamAggregateAudit: async () => null
    },
    llmService: {
      async generateAudit() {
        return {
          rawResponse: '{bad json',
          modelName: 'mock-model',
          provider: 'mock'
        }
      },
      async repairJson() {
        return validAiResponse
      }
    }
  })

  const result = await service.createPerPushAudit({
    repositoryId,
    commitSha,
    requestedBy: 'user-1'
  })

  assert.equal(result.review.status, 'COMPLETED')
})
