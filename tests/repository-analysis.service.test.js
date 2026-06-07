import assert from 'node:assert/strict'
import test from 'node:test'

import { JOB_TYPES } from '../src/constants/queue.js'
import { createRepositoryAnalysisService } from '../src/modules/repositories/repository-analysis.service.js'

const createAnalysisRepository = () => {
  const repositories = new Map()
  const commitDiffs = new Map()
  const staticResults = new Map()
  const changedContexts = new Map()
  const impactDecisions = new Map()

  return {
    repositories,
    commitDiffs,
    staticResults,
    changedContexts,
    impactDecisions,
    repository: {
      findRepositoryById: async (id) => repositories.get(id) || null,
      findCommitDiffByRepositoryAndHeadSha: async ({ repositoryId, headCommitSha }) => {
        return commitDiffs.get(`${repositoryId}:${headCommitSha}`) || null
      },
      upsertStaticAnalysisResult: async ({ repositoryId, commitSha, source, data }) => {
        const key = `${repositoryId}:${commitSha}:${source}`
        const value = { _id: key, repositoryId, commitSha, source, ...data }
        staticResults.set(key, value)
        return value
      },
      listStaticAnalysisResultsByRepository: async ({ repositoryId }) => {
        return [...staticResults.values()].filter(item => item.repositoryId === repositoryId)
      },
      countStaticAnalysisResultsByRepository: async (repositoryId) => {
        return [...staticResults.values()].filter(item => item.repositoryId === repositoryId).length
      },
      replaceChangedCodeContexts: async ({ repositoryId, commitSha, contexts }) => {
        changedContexts.set(`${repositoryId}:${commitSha}`, contexts)
        return contexts
      },
      listChangedCodeContexts: async ({ repositoryId, commitSha }) => {
        return changedContexts.get(`${repositoryId}:${commitSha}`) || []
      },
      upsertImpactDecision: async ({ repositoryId, commitSha, data }) => {
        const key = `${repositoryId}:${commitSha}`
        const value = { _id: key, repositoryId, commitSha, ...data }
        impactDecisions.set(key, value)
        return value
      },
      listImpactDecisionsByRepository: async ({ repositoryId }) => {
        return [...impactDecisions.values()].filter(item => item.repositoryId === repositoryId)
      },
      countImpactDecisionsByRepository: async (repositoryId) => {
        return [...impactDecisions.values()].filter(item => item.repositoryId === repositoryId).length
      }
    }
  }
}

const createCommitDiff = (files) => ({
  repositoryId: 'repo-1',
  headCommitSha: 'commit-1',
  files,
  totalFiles: files.length,
  includedFiles: files.filter(file => !file.isExcluded).length,
  excludedFiles: files.filter(file => file.isExcluded).length,
  totalCleanPatchSize: files.reduce((sum, file) => sum + (file.cleanPatchSize || 0), 0)
})

test('secret finding creates static analysis result and no LLM service is called', async () => {
  const { repository, repositories, commitDiffs, staticResults } = createAnalysisRepository()
  repositories.set('repo-1', { _id: 'repo-1', repositoryFullName: 'seal/repo', latestCommitSha: 'commit-1' })
  commitDiffs.set('repo-1:commit-1', createCommitDiff([
    {
      filePath: 'src/modules/auth.service.js',
      cleanPatch: '+const token = "[REDACTED_GITHUB_TOKEN]";',
      cleanPatchSize: 40,
      isExcluded: false,
      patchSummary: 'Auth service updated'
    }
  ]))

  let llmCalls = 0
  const queuedJobs = []
  const service = createRepositoryAnalysisService({
    repository,
    queueService: {
      enqueueComputeImpactScore: async (payload) => {
        queuedJobs.push(payload)
        return { name: JOB_TYPES.COMPUTE_IMPACT_SCORE }
      }
    },
    llmService: {
      generate: () => { llmCalls += 1 }
    }
  })

  const result = await service.processRunStaticAnalysisJob({
    repositoryId: 'repo-1',
    commitSha: 'commit-1'
  })

  assert.equal(result.results.some(item => item.source === 'SECRET_SCAN' && item.findings.length === 1), true)
  assert.equal(staticResults.size >= 2, true)
  assert.equal(queuedJobs.length, 1)
  assert.equal(llmCalls, 0)
})

test('dependency change is detected from package.json patch', async () => {
  const { repository, repositories, commitDiffs, staticResults } = createAnalysisRepository()
  repositories.set('repo-1', { _id: 'repo-1', repositoryFullName: 'seal/repo', latestCommitSha: 'commit-1' })
  commitDiffs.set('repo-1:commit-1', createCommitDiff([{
    filePath: 'package.json',
    cleanPatch: '@@ -1,5 +1,6 @@\n {\n   "dependencies": {\n+    "express-rate-limit": "^7.0.0"\n   }\n }',
    cleanPatchSize: 90,
    isExcluded: false,
    patchSummary: 'Dependencies updated'
  }]))

  const service = createRepositoryAnalysisService({
    repository,
    queueService: {
      enqueueComputeImpactScore: async () => null
    }
  })

  await service.processRunStaticAnalysisJob({
    repositoryId: 'repo-1',
    commitSha: 'commit-1'
  })

  const dependencyResult = [...staticResults.values()].find(result => result.source === 'DEPENDENCY_SCAN')
  assert.equal(Boolean(dependencyResult), true)
  assert.equal(dependencyResult.findings.length, 1)
  assert.equal(dependencyResult.findings[0].evidence.includes('express-rate-limit@^7.0.0'), true)
})

test('changed function/class/route context is extracted from patch', async () => {
  const service = createRepositoryAnalysisService({
    repository: createAnalysisRepository().repository,
    queueService: {
      enqueueComputeImpactScore: async () => null
    }
  })

  const contexts = service.extractChangedCodeContexts({
    repositoryId: 'repo-1',
    commitSha: 'commit-1',
    commitDiff: createCommitDiff([
      {
        filePath: 'src/modules/events/event.route.js',
        cleanPatch: '@@ -10,2 +10,6 @@\n+router.get(\'/status\', controller.status)\n+class EventStatusPresenter {\n+  render() {}\n+}\n+async function syncEvents() {\n+}\n',
        cleanPatchSize: 150,
        isExcluded: false,
        hunkCount: 1
      }
    ])
  })

  assert.equal(contexts.some(context => context.symbolType === 'ROUTE' && context.symbolName === 'GET /status'), true)
  assert.equal(contexts.some(context => context.symbolType === 'CLASS' && context.symbolName === 'EventStatusPresenter'), true)
  assert.equal(contexts.some(context => ['FUNCTION', 'SERVICE_METHOD', 'CONTROLLER_METHOD'].includes(context.symbolType) && context.symbolName === 'syncEvents'), true)
})

test('README-only change results in LOW impact and SKIP_LLM', async () => {
  const service = createRepositoryAnalysisService({
    repository: createAnalysisRepository().repository,
    queueService: {
      enqueueComputeImpactScore: async () => null
    }
  })

  const decision = service.calculateImpactDecision({
    commitDiff: createCommitDiff([{
      filePath: 'README.md',
      cleanPatch: '+Update docs',
      cleanPatchSize: 12,
      isExcluded: false
    }]),
    staticResults: [],
    changedContexts: []
  })

  assert.equal(decision.impactLevel, 'LOW')
  assert.equal(decision.decision, 'SKIP_LLM')
})

test('core service change results in HIGH impact and CALL_PER_PUSH_AUDIT', async () => {
  const service = createRepositoryAnalysisService({
    repository: createAnalysisRepository().repository,
    queueService: {
      enqueueComputeImpactScore: async () => null
    }
  })

  const decision = service.calculateImpactDecision({
    commitDiff: createCommitDiff([{
      filePath: 'src/modules/repositories/repository-evidence.service.js',
      cleanPatch: '@@ -1,2 +1,8 @@\n+async function processFetchCommitDiffJob() {\n+}\n',
      cleanPatchSize: 70,
      isExcluded: false
    }]),
    staticResults: [],
    changedContexts: [{
      filePath: 'src/modules/repositories/repository-evidence.service.js',
      symbolName: 'processFetchCommitDiffJob',
      symbolType: 'SERVICE_METHOD'
    }]
  })

  assert.equal(decision.impactLevel, 'HIGH')
  assert.equal(decision.decision, 'CALL_PER_PUSH_AUDIT')
})

test('security or secret finding results in CRITICAL impact', async () => {
  const service = createRepositoryAnalysisService({
    repository: createAnalysisRepository().repository,
    queueService: {
      enqueueComputeImpactScore: async () => null
    }
  })

  const decision = service.calculateImpactDecision({
    commitDiff: createCommitDiff([{
      filePath: 'src/modules/auth/service.js',
      cleanPatch: '+auth',
      cleanPatchSize: 5,
      isExcluded: false
    }]),
    staticResults: [{
      source: 'SECRET_SCAN',
      errorCount: 1,
      warningCount: 0,
      findings: [{
        severity: 'CRITICAL',
        title: 'Potential secret exposure detected in patch'
      }]
    }],
    changedContexts: []
  })

  assert.equal(decision.impactLevel, 'CRITICAL')
  assert.equal(decision.decision, 'URGENT_AUDIT_AND_HUMAN_REVIEW')
  assert.equal(decision.needsHumanReview, true)
})

test('processComputeImpactScoreJob persists impact decisions', async () => {
  const { repository, repositories, commitDiffs, staticResults, changedContexts, impactDecisions } = createAnalysisRepository()
  repositories.set('repo-1', { _id: 'repo-1', repositoryFullName: 'seal/repo' })
  commitDiffs.set('repo-1:commit-1', createCommitDiff([{
    filePath: 'src/modules/repositories/repository-evidence.service.js',
    cleanPatch: '+change',
    cleanPatchSize: 20,
    isExcluded: false
  }]))
  staticResults.set('repo-1:commit-1:DEPENDENCY_SCAN', {
    repositoryId: 'repo-1',
    commitSha: 'commit-1',
    source: 'DEPENDENCY_SCAN',
    errorCount: 0,
    warningCount: 1,
    findings: [{ severity: 'MEDIUM', title: 'New dependencies added' }]
  })
  changedContexts.set('repo-1:commit-1', [{
    repositoryId: 'repo-1',
    commitSha: 'commit-1',
    filePath: 'src/modules/repositories/repository-evidence.service.js',
    symbolName: 'processFetchCommitDiffJob',
    symbolType: 'SERVICE_METHOD'
  }])

  const service = createRepositoryAnalysisService({
    repository,
    queueService: {
      enqueueComputeImpactScore: async () => null
    }
  })

  const decision = await service.processComputeImpactScoreJob({
    repositoryId: 'repo-1',
    commitSha: 'commit-1'
  })

  assert.equal(impactDecisions.size, 1)
  assert.equal(['MEDIUM', 'HIGH', 'CRITICAL'].includes(decision.impactLevel), true)
})
