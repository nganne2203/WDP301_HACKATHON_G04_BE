import assert from 'node:assert/strict'
import test from 'node:test'

import { env } from '../src/configs/environment.js'
import { createAiReviewService } from '../src/modules/ai-reviews/ai-review.service.js'
import { createN8nService } from '../src/services/n8n.service.js'
import { ENCRYPTION_UTILS } from '../src/utils/encryption.util.js'

const TEST_GITHUB_TOKEN_AES_KEY = Buffer.alloc(32, 7).toString('base64')

const createTestN8nService = () => createN8nService({
  githubTokenProvider: async () => 'github_pat_test_secret'
})

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
      listSuggestedJudgeQuestions: async (aiReviewId) => suggestedJudgeQuestions.get(aiReviewId) || [],
      upsertCommit: async ({ repositoryId, commitSha, data }) => {
        const key = `${repositoryId}:${commitSha}`
        const current = commits.get(key) || { repositoryId, commitSha }
        const updated = { ...current, ...data, repositoryId, commitSha }
        commits.set(key, updated)
        return updated
      }
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
    files: [{
      filePath: 'src/modules/ai-reviews/ai-review.service.js',
      cleanPatch: '+async function runImpact() {}',
      patchSummary: 'Core AI review flow updated',
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
    filePath: 'src/modules/ai-reviews/ai-review.service.js',
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
    title: 'Core AI dispatch path changed',
    evidence: ['ai-review.service.js'],
    comment: 'Review the n8n dispatch behavior carefully.',
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
    title: 'Regression for n8n dispatch',
    purpose: 'Verify webhook-driven AI dispatch',
    expectedObservation: 'A new push triggers a per-push audit.'
  }],
  suggestedJudgeQuestions: ['How do you control reliability when n8n dispatch fails?'],
  costControlNotes: {
    llmCallReason: 'High-impact change',
    skippedFiles: [],
    tokenSavingStrategy: ['Used clean diff only']
  },
  needsHumanReview: true,
  suggestedScore: 9.5
})

const validAggregateAiResponse = JSON.stringify({
  reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
  status: 'DONE',
  isScoreBased: false,
  isFinalDecision: false,
  overallPicture: {
    pushSummary: 'The team improved core backend modules over multiple commits.',
    significantChange: true,
    changeImpactLevel: 'HIGH',
    mainAffectedAreas: ['AI review runtime', 'Webhook dispatch']
  },
  techStackDetected: {
    frontend: [],
    backend: ['express'],
    database: ['mongoose'],
    ai: ['openai'],
    retrieval: [],
    testing: ['node:test']
  },
  technicalFindings: [{
    type: 'MAINTAINABILITY',
    severity: 'HIGH',
    title: 'Core runtime path changed repeatedly',
    evidence: ['github-push.worker.js', 'ai-review.service.js'],
    comment: 'Review regression coverage before go-live.',
    recommendedAction: 'Run integrated runtime verification.'
  }],
  rubricAwareComments: [{
    criterionId: 'criterion-1',
    criterionName: 'Architecture',
    qualitativeLevel: 'GOOD',
    comment: 'The architecture is converging toward a workable production flow.',
    evidence: ['Queue and worker separation'],
    risks: ['Operational regression if env is incomplete']
  }],
  suggestedTestCases: [{
    title: 'End-to-end runtime verification',
    purpose: 'Verify webhook to worker flow',
    expectedObservation: 'A real push creates evidence and a completed AI review.'
  }],
  suggestedJudgeQuestions: ['What failure recovery exists if the AI provider is temporarily unavailable?'],
  costControlNotes: {
    llmCallReason: 'Aggregate technical summary required',
    skippedFiles: [],
    tokenSavingStrategy: ['Use summarized diff evidence only']
  },
  needsHumanReview: true
})

const withN8nEnv = async (fn, { dispatchMaxRetries = 1 } = {}) => {
  const originalN8n = env.n8n
  const originalPublicUrl = env.server.publicUrl
  const originalGithubToken = env.github.token
  const originalGithubTokenAesKey = env.security.githubTokenAesKey
  env.n8n = {
    enabled: true,
    perPushWebhookUrl: 'https://n8n.test/per-push',
    aggregateWebhookUrl: 'https://n8n.test/aggregate',
    teamAggregateWebhookUrl: 'https://n8n.test/aggregate',
    callbackSecret: 'secret-key',
    dispatchMaxRetries,
    dispatchTimeoutMs: 1000
  }
  env.server.publicUrl = 'https://seal.example.com'
  env.github.token = 'github_pat_test_secret'
  env.security.githubTokenAesKey = TEST_GITHUB_TOKEN_AES_KEY

  try {
    await fn()
  } finally {
    env.n8n = originalN8n
    env.server.publicUrl = originalPublicUrl
    env.github.token = originalGithubToken
    env.security.githubTokenAesKey = originalGithubTokenAesKey
  }
}

test('requestPerPushAudit resolves latest tracked commit and queues n8n-bound review job', async () => {
  const { repository, repositoryId, commitSha } = createRepositoryFixture({
    impactDecision: { impactLevel: 'LOW', decision: 'SKIP_LLM' },
    commitSha: 'commit-low'
  })
  const queuedJobs = []

  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async (payload) => {
        queuedJobs.push(payload)
        return null
      },
      enqueueRunTeamAggregateAudit: async () => null
    }
  })

  const result = await service.requestPerPushAudit({
    repositoryId,
    requestedBy: 'user-1'
  })

  assert.equal(result.commitSha, commitSha)
  assert.equal(result.queuedJobType, 'RUN_PER_PUSH_AUDIT')
  assert.equal(queuedJobs.length, 1)
  assert.equal(queuedJobs[0].commitSha, commitSha)
})

test('createPerPushAudit triggers n8n webhook and returns PENDING when enabled', async () => {
  await withN8nEnv(async () => {
    const { repository, repositoryId, commitSha } = createRepositoryFixture({
      impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
    })

    let triggeredPayload = null
    const originalFetch = globalThis.fetch
    let triggeredUrl = null
    globalThis.fetch = async (url, options) => {
      triggeredUrl = url
      triggeredPayload = JSON.parse(options.body)
      return {
        ok: true,
        status: 202,
        async text() { return 'Accepted' }
      }
    }

    try {
      const service = createAiReviewService({ repository, n8nService: createTestN8nService() })
      const result = await service.createPerPushAudit({
        repositoryId,
        commitSha,
        requestedBy: 'user-1'
      })

      assert.equal(result.pending, true)
      assert.equal(result.review.status, 'PENDING')
      assert.equal(triggeredUrl, 'https://n8n.test/per-push')
      assert.equal(triggeredPayload.aiReviewId, result.review.id)
      assert.equal(triggeredPayload.reviewKind, 'PER_PUSH_TECHNICAL_AUDIT')
      assert.equal(triggeredPayload.callbackUrl, `https://seal.example.com/api/ai-reviews/${result.review.id}/callback`)
      assert.equal(typeof triggeredPayload.encryptedGithubToken, 'string')
      assert.equal(ENCRYPTION_UTILS.decryptGithubTokenFromN8nPayload(triggeredPayload.encryptedGithubToken), 'github_pat_test_secret')
      assert.equal(Object.hasOwn(triggeredPayload, 'githubToken'), false)
      assert.equal(JSON.stringify(triggeredPayload).includes('github_pat_test_secret'), false)
      assert.equal(triggeredPayload.context.triggerContext.commitSha, commitSha)
      assert.equal(triggeredPayload.context.repositoryContext.repositoryFullName, 'seal-org/team-alpha')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('createPerPushAudit marks review RETRY_PENDING and queues retry if n8n trigger errors', async () => {
  await withN8nEnv(async () => {
    const { repository, repositoryId, commitSha } = createRepositoryFixture({
      impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
    })
    const queuedJobs = []

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('Network timeout triggering n8n')
    }

    try {
      const service = createAiReviewService({
        repository,
        n8nService: createTestN8nService(),
        queueService: {
          enqueueRunPerPushAudit: async (payload) => {
            queuedJobs.push(payload)
            return null
          },
          enqueueRunTeamAggregateAudit: async () => null
        }
      })
      const result = await service.createPerPushAudit({
        repositoryId,
        commitSha,
        requestedBy: 'user-1'
      })

      assert.equal(result.retryScheduled, true)
      assert.equal(result.review.status, 'RETRY_PENDING')
      assert.equal(result.review.retryCount, 1)
      assert.equal(result.review.normalizedOutput, null)
      assert.equal(queuedJobs.length, 1)
      assert.equal(queuedJobs[0].aiReviewId, result.review.id)
      assert.equal(queuedJobs[0].manualRedispatch, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('handleAuditCallback success path updates PENDING to COMPLETED and strips forbidden scoring fields', async () => {
  const { repository, stores, repositoryId } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const pendingReview = await repository.createAiReview({
    repositoryId,
    reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
    status: 'PENDING',
    commitSha: 'commit-1',
    requestedBy: 'user-1',
    requestedAt: new Date()
  })

  const service = createAiReviewService({ repository })
  const result = await service.handleAuditCallback({
    aiReviewId: pendingReview._id,
    status: 'success',
    rawResponse: validAiResponse,
    modelName: 'gemini-1.5-pro',
    provider: 'google'
  })

  assert.equal(result.status, 'COMPLETED')
  assert.equal(result.modelName, 'gemini-1.5-pro')
  assert.equal(stores.technicalFindings.size, 1)
  assert.equal(stores.suggestedJudgeQuestions.size, 1)
  const reviewInDb = await repository.findAiReviewById(pendingReview._id)
  assert.equal(reviewInDb.status, 'COMPLETED')
  assert.equal(Object.hasOwn(reviewInDb.normalizedOutput, 'suggestedScore'), false)
})

test('handleAuditCallback marks review RETRY_PENDING and queues retry when callback reports an error', async () => {
  const { repository, repositoryId } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const pendingReview = await repository.createAiReview({
    repositoryId,
    reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
    status: 'PENDING',
    commitSha: 'commit-1',
    requestedBy: 'user-1',
    promptInput: {},
    requestedAt: new Date()
  })

  await withN8nEnv(async () => {
    const queuedJobs = []
    const service = createAiReviewService({
      repository,
      queueService: {
        enqueueRunPerPushAudit: async (payload) => {
          queuedJobs.push(payload)
          return null
        },
        enqueueRunTeamAggregateAudit: async () => null
      }
    })
    const result = await service.handleAuditCallback({
      aiReviewId: pendingReview._id,
      status: 'error',
      errorMessage: 'Vertex AI quota exceeded'
    })

    assert.equal(result.status, 'RETRY_PENDING')
    assert.equal(result.modelName, null)
    const reviewInDb = await repository.findAiReviewById(pendingReview._id)
    assert.equal(reviewInDb.status, 'RETRY_PENDING')
    assert.equal(reviewInDb.lastError, 'Vertex AI quota exceeded')
    assert.equal(reviewInDb.retryCount, 1)
    assert.equal(queuedJobs.length, 1)
  })
})

test('handleAuditCallback marks review RETRY_PENDING when rawResponse is invalid JSON', async () => {
  const { repository, repositoryId } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const pendingReview = await repository.createAiReview({
    repositoryId,
    reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
    status: 'PENDING',
    commitSha: 'commit-1',
    requestedBy: 'user-1',
    requestedAt: new Date()
  })

  await withN8nEnv(async () => {
    const queuedJobs = []
    const service = createAiReviewService({
      repository,
      queueService: {
        enqueueRunPerPushAudit: async (payload) => {
          queuedJobs.push(payload)
          return null
        },
        enqueueRunTeamAggregateAudit: async () => null
      }
    })
    const result = await service.handleAuditCallback({
      aiReviewId: pendingReview._id,
      status: 'success',
      rawResponse: '{bad json',
      modelName: 'gemini-1.5-pro',
      provider: 'google'
    })

    assert.equal(result.status, 'RETRY_PENDING')
    const reviewInDb = await repository.findAiReviewById(pendingReview._id)
    assert.equal(reviewInDb.status, 'RETRY_PENDING')
    assert.match(reviewInDb.lastError, /Unexpected token|AI response was empty|JSON/i)
    assert.equal(queuedJobs.length, 1)
  })
})

test('redispatchAiReview queues manual redispatch for review requiring manual action', async () => {
  const { repository, repositoryId } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const failedReview = await repository.createAiReview({
    repositoryId,
    reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
    status: 'MANUAL_REDISPATCH_REQUIRED',
    commitSha: 'commit-1',
    promptInput: { sample: true },
    requestedBy: 'user-1',
    retryCount: 2,
    requestedAt: new Date()
  })

  const queuedJobs = []
  const service = createAiReviewService({
    repository,
    queueService: {
      enqueueRunPerPushAudit: async (payload) => {
        queuedJobs.push(payload)
        return null
      },
      enqueueRunTeamAggregateAudit: async () => null
    }
  })

  const result = await service.requestAiReviewRedispatch({
    aiReviewId: failedReview._id,
    requestedBy: 'coordinator-1'
  })

  assert.equal(result.review.status, 'RETRY_PENDING')
  assert.equal(queuedJobs.length, 1)
  assert.equal(queuedJobs[0].manualRedispatch, true)
  assert.equal(queuedJobs[0].aiReviewId, failedReview._id)
})

test('manual redispatch failure returns review to MANUAL_REDISPATCH_REQUIRED without auto retry', async () => {
  await withN8nEnv(async () => {
    const { repository, repositoryId } = createRepositoryFixture({
      impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
    })

    const review = await repository.createAiReview({
      repositoryId,
      reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
      status: 'MANUAL_REDISPATCH_REQUIRED',
      commitSha: 'commit-1',
      promptInput: { sample: true },
      requestedBy: 'user-1',
      retryCount: 2,
      requestedAt: new Date()
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('n8n still unavailable')
    }

    try {
      const service = createAiReviewService({
        repository,
        n8nService: createTestN8nService(),
        queueService: {
          enqueueRunPerPushAudit: async () => {
            throw new Error('should not auto retry manual redispatch')
          },
          enqueueRunTeamAggregateAudit: async () => null
        }
      })

      const result = await service.redispatchAiReview({
        aiReviewId: review._id,
        requestedBy: 'coordinator-1',
        manualRedispatch: true
      })

      assert.equal(result.review.status, 'MANUAL_REDISPATCH_REQUIRED')
      assert.equal(result.failed, true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('createTeamAggregateAudit triggers n8n webhook and handleAuditCallback completes aggregate review', async () => {
  await withN8nEnv(async () => {
    const { repository, repositoryId } = createRepositoryFixture({
      impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
    })

    let triggeredUrl = null
    let triggeredPayload = null
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url, options) => {
      triggeredUrl = url
      triggeredPayload = JSON.parse(options.body)
      return {
      ok: true,
      status: 202,
      async text() { return 'Accepted' }
      }
    }

    try {
      const service = createAiReviewService({ repository, n8nService: createTestN8nService() })
      const created = await service.createTeamAggregateAudit({
        repositoryId,
        requestedBy: 'user-1'
      })

      assert.equal(created.pending, true)
      assert.equal(created.review.status, 'PENDING')
      assert.equal(triggeredUrl, 'https://n8n.test/aggregate')
      assert.equal(triggeredPayload.reviewKind, 'TEAM_AGGREGATE_TECHNICAL_AUDIT')
      assert.equal(typeof triggeredPayload.encryptedGithubToken, 'string')
      assert.equal(ENCRYPTION_UTILS.decryptGithubTokenFromN8nPayload(triggeredPayload.encryptedGithubToken), 'github_pat_test_secret')
      assert.equal(Object.hasOwn(triggeredPayload, 'githubToken'), false)
      assert.equal(JSON.stringify(triggeredPayload).includes('github_pat_test_secret'), false)

      const completed = await service.handleAuditCallback({
        aiReviewId: created.review.id,
        status: 'success',
        rawResponse: validAggregateAiResponse,
        modelName: 'gemini-1.5-pro',
        provider: 'google'
      })

      assert.equal(completed.status, 'COMPLETED')
      assert.equal(Boolean(completed.normalizedOutput.historicalSynthesis), true)
      assert.equal(Boolean(completed.normalizedOutput.currentTechnicalSnapshot), true)
      assert.equal(Array.isArray(completed.normalizedOutput.riskSummary), true)
      assert.equal(Boolean(completed.normalizedOutput.judgeDashboardSummary?.headline), true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('handleAuditCallback success path parses object rawResponse and stringifies it for DB', async () => {
  const { repository, stores, repositoryId } = createRepositoryFixture({
    impactDecision: { impactLevel: 'HIGH', decision: 'CALL_PER_PUSH_AUDIT' }
  })

  const pendingReview = await repository.createAiReview({
    repositoryId,
    reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
    status: 'PENDING',
    commitSha: 'commit-1',
    requestedBy: 'user-1',
    requestedAt: new Date()
  })

  const rawResponseObject = JSON.parse(validAiResponse)
  const service = createAiReviewService({ repository })
  const result = await service.handleAuditCallback({
    aiReviewId: pendingReview._id,
    status: 'success',
    rawResponse: rawResponseObject,
    modelName: 'gemini-1.5-pro',
    provider: 'google'
  })

  assert.equal(result.status, 'COMPLETED')
  const reviewInDb = await repository.findAiReviewById(pendingReview._id)
  assert.equal(typeof reviewInDb.rawResponse, 'string')
  assert.equal(JSON.parse(reviewInDb.rawResponse).reviewKind, 'PER_PUSH_TECHNICAL_AUDIT')
})
