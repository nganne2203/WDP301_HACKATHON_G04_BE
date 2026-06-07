import assert from 'node:assert/strict'
import test from 'node:test'

import { JOB_TYPES } from '../src/constants/queue.js'
import { createRepositoryEvidenceService } from '../src/modules/repositories/repository-evidence.service.js'

const createEvidenceRepository = () => {
  const repositories = new Map()
  const commits = new Map()
  const commitDiffs = new Map()
  const deliveryUpdates = []
  const configs = new Map()

  return {
    repositories,
    commits,
    commitDiffs,
    deliveryUpdates,
    configs,
    repository: {
      findRepositoryById: async (id) => repositories.get(id) || null,
      findRepositoriesForScan: async ({ repositoryId } = {}) => {
        const all = [...repositories.values()]
        return repositoryId ? all.filter(item => item._id === repositoryId) : all
      },
      updateRepositoryById: async (id, data) => {
        const updated = { ...repositories.get(id), ...data, _id: id }
        repositories.set(id, updated)
        return updated
      },
      upsertCommit: async ({ repositoryId, commitSha, data }) => {
        const key = `${repositoryId}:${commitSha}`
        const value = { _id: key, repositoryId, commitSha, ...data }
        commits.set(key, value)
        return value
      },
      upsertCommitDiff: async ({ repositoryId, headCommitSha, data }) => {
        const key = `${repositoryId}:${headCommitSha}`
        const value = { _id: key, repositoryId, headCommitSha, ...data }
        commitDiffs.set(key, value)
        return value
      },
      listCommitsByRepository: async ({ repositoryId }) => [...commits.values()].filter(item => item.repositoryId === repositoryId),
      countCommitsByRepository: async (repositoryId) => [...commits.values()].filter(item => item.repositoryId === repositoryId).length,
      listCommitDiffsByRepository: async ({ repositoryId }) => [...commitDiffs.values()].filter(item => item.repositoryId === repositoryId),
      countCommitDiffsByRepository: async (repositoryId) => [...commitDiffs.values()].filter(item => item.repositoryId === repositoryId).length,
      findConfigByKey: async (key) => configs.get(key) || null,
      updateWebhookDeliveryById: async (id, data) => {
        deliveryUpdates.push({ id, data })
        return { _id: id, ...data }
      }
    }
  }
}

const createOctokitFactory = (responses) => () => ({
  repos: {
    compareCommitsWithBasehead: async () => ({ data: responses.compare }),
    getCommit: async ({ ref }) => ({ data: responses.commits[ref] }),
    listCommits: async () => ({ data: responses.listCommits })
  }
})

test('processFetchCommitDiffJob fetches and persists commit metadata and normalized diff evidence', async () => {
  const { repository, repositories, commits, commitDiffs, configs } = createEvidenceRepository()
  repositories.set('repo-1', {
    _id: 'repo-1',
    eventId: 'event-1',
    githubOwner: 'seal-org',
    githubRepo: 'team-alpha',
    repositoryFullName: 'seal-org/team-alpha',
    defaultBranch: 'main',
    lastProcessedCommitSha: 'base123'
  })
  configs.set('github.event.event-1.organization', {
    value: {
      enabled: true,
      tokenEncrypted: 'encrypted-token'
    }
  })

  const service = createRepositoryEvidenceService({
    repository,
    encryption: {
      decrypt: () => 'plain-token'
    },
    octokitFactory: createOctokitFactory({
      compare: {
        commits: [{ sha: 'mid456' }, { sha: 'head789' }],
        files: [
          {
            filename: 'src/index.js',
            status: 'modified',
            additions: 2,
            deletions: 1,
            patch: '@@ -1 +1 @@\n-const password = \"abc\";\n+const password = \"supersecret\";\n+const token = \"ghp_secretsecretsecret\";'
          }
        ]
      },
      commits: {
        mid456: {
          sha: 'mid456',
          parents: [{ sha: 'base123' }],
          commit: {
            author: { name: 'Dev A', email: 'a@example.com', date: '2026-06-07T08:00:00.000Z' },
            message: 'Refactor auth'
          },
          author: { login: 'dev-a' },
          html_url: 'https://github.com/seal-org/team-alpha/commit/mid456',
          stats: { additions: 5, deletions: 2 },
          files: [{ filename: 'src/index.js' }]
        },
        head789: {
          sha: 'head789',
          parents: [{ sha: 'mid456' }],
          commit: {
            author: { name: 'Dev B', email: 'b@example.com', date: '2026-06-07T09:00:00.000Z' },
            message: 'Add secret redaction case'
          },
          author: { login: 'dev-b' },
          html_url: 'https://github.com/seal-org/team-alpha/commit/head789',
          stats: { additions: 3, deletions: 1 },
          files: [{ filename: 'src/index.js' }]
        }
      },
      listCommits: []
    }),
    queueService: {
      enqueueHourlyRepositoryScan: async () => null,
      enqueueFetchCommitDiff: async () => null,
      enqueueRunStaticAnalysis: async () => null
    }
  })

  const result = await service.processFetchCommitDiffJob({
    repositoryId: 'repo-1',
    beforeCommitSha: 'base123',
    afterCommitSha: 'head789',
    branch: 'main',
    deliveryEventId: 'delivery-1'
  })

  assert.equal(commits.size, 2)
  assert.equal(commitDiffs.size, 1)
  assert.equal(result.repository.lastProcessedCommitSha, 'head789')

  const persistedDiff = [...commitDiffs.values()][0]
  assert.equal(persistedDiff.status, 'READY')
  assert.equal(persistedDiff.files[0].cleanPatch.includes('[REDACTED]'), true)
  assert.equal(persistedDiff.cleanDiffText.includes('supersecret'), false)
  assert.equal(persistedDiff.cleanDiffText.includes('ghp_secretsecretsecret'), false)
})

test('preprocessFiles filters generated binary and large lock files', async () => {
  const service = createRepositoryEvidenceService({
    repository: createEvidenceRepository().repository,
    encryption: { decrypt: () => 'plain-token' },
    octokitFactory: createOctokitFactory({ compare: { commits: [], files: [] }, commits: {}, listCommits: [] }),
    queueService: {
      enqueueHourlyRepositoryScan: async () => null,
      enqueueFetchCommitDiff: async () => null,
      enqueueRunStaticAnalysis: async () => null
    }
  })

  const result = service.preprocessFiles([
    { filename: 'node_modules/pkg/index.js', patch: '@@ -1 +1 @@\n-console.log(1)\n+console.log(2)', additions: 1, deletions: 1 },
    { filename: 'dist/app.min.js', patch: '@@ -1 +1 @@\n-var a=1;\n+var a=2;', additions: 1, deletions: 1 },
    { filename: 'package-lock.json', patch: `${'a'.repeat(3500)}`, additions: 1000, deletions: 0 },
    { filename: 'assets/logo.png', patch: null, additions: 0, deletions: 0 }
  ])

  assert.equal(result.excludedFiles, 4)
  assert.equal(result.includedFiles, 0)
  assert.deepEqual(result.files.map(file => file.excludedReason), [
    'NODE_MODULES',
    'BUILD_ARTIFACT',
    'LARGE_LOCK_FILE',
    'BINARY_OR_NO_PATCH'
  ])
})

test('preprocessFiles truncates oversized patches under file and total budget limits', async () => {
  const service = createRepositoryEvidenceService({
    repository: createEvidenceRepository().repository,
    encryption: { decrypt: () => 'plain-token' },
    octokitFactory: createOctokitFactory({ compare: { commits: [], files: [] }, commits: {}, listCommits: [] }),
    queueService: {
      enqueueHourlyRepositoryScan: async () => null,
      enqueueFetchCommitDiff: async () => null,
      enqueueRunStaticAnalysis: async () => null
    }
  })

  const largePatch = `@@ -1 +1 @@\n+${'x'.repeat(5000)}`
  const result = service.preprocessFiles([
    { filename: 'src/a.js', patch: largePatch, additions: 1, deletions: 0 },
    { filename: 'src/b.js', patch: largePatch, additions: 1, deletions: 0 },
    { filename: 'src/c.js', patch: largePatch, additions: 1, deletions: 0 },
    { filename: 'src/d.js', patch: largePatch, additions: 1, deletions: 0 },
    { filename: 'src/e.js', patch: largePatch, additions: 1, deletions: 0 },
    { filename: 'src/f.js', patch: largePatch, additions: 1, deletions: 0 }
  ])

  assert.equal(result.files.some(file => file.isTruncated), true)
  assert.equal(result.totalCleanPatchSize <= 20000, true)
})

test('processHourlyRepositoryScanJob detects new commits and enqueues fetch jobs', async () => {
  const { repository, repositories, configs } = createEvidenceRepository()
  repositories.set('repo-1', {
    _id: 'repo-1',
    eventId: 'event-1',
    githubOwner: 'seal-org',
    githubRepo: 'team-alpha',
    repositoryFullName: 'seal-org/team-alpha',
    defaultBranch: 'main',
    lastProcessedCommitSha: 'old123',
    latestCommitSha: 'old123'
  })
  configs.set('github.event.event-1.organization', {
    value: {
      enabled: true,
      tokenEncrypted: 'encrypted-token'
    }
  })

  const queuedJobs = []
  const service = createRepositoryEvidenceService({
    repository,
    encryption: { decrypt: () => 'plain-token' },
    octokitFactory: createOctokitFactory({
      compare: { commits: [], files: [] },
      commits: {},
      listCommits: [{ sha: 'new456' }]
    }),
    queueService: {
      enqueueHourlyRepositoryScan: async () => null,
      enqueueFetchCommitDiff: async (payload) => {
        queuedJobs.push(payload)
        return { name: JOB_TYPES.FETCH_COMMIT_DIFF }
      },
      enqueueRunStaticAnalysis: async () => null
    }
  })

  const result = await service.processHourlyRepositoryScanJob({})

  assert.equal(result.enqueuedFetchJobs, 1)
  assert.equal(queuedJobs[0].afterCommitSha, 'new456')
})

test('processFetchCommitDiffJob does not call static analysis or LLM services in phase 6', async () => {
  const { repository, repositories, configs } = createEvidenceRepository()
  repositories.set('repo-1', {
    _id: 'repo-1',
    eventId: 'event-1',
    githubOwner: 'seal-org',
    githubRepo: 'team-alpha',
    repositoryFullName: 'seal-org/team-alpha',
    defaultBranch: 'main',
    lastProcessedCommitSha: null
  })
  configs.set('github.event.event-1.organization', {
    value: {
      enabled: true,
      tokenEncrypted: 'encrypted-token'
    }
  })

  let staticCalls = 0
  let llmCalls = 0
  const service = createRepositoryEvidenceService({
    repository,
    encryption: { decrypt: () => 'plain-token' },
    octokitFactory: createOctokitFactory({
      compare: { commits: [], files: [] },
      commits: {
        head789: {
          sha: 'head789',
          parents: [],
          commit: {
            author: { name: 'Dev', email: 'dev@example.com', date: '2026-06-07T10:00:00.000Z' },
            message: 'Single commit'
          },
          author: { login: 'dev' },
          html_url: 'https://github.com/seal-org/team-alpha/commit/head789',
          stats: { additions: 1, deletions: 0 },
          files: [{ filename: 'src/index.js', patch: '@@ -0,0 +1 @@\n+const value = 1;' }]
        }
      },
      listCommits: []
    }),
    queueService: {
      enqueueHourlyRepositoryScan: async () => null,
      enqueueFetchCommitDiff: async () => null,
      enqueueRunStaticAnalysis: async () => null
    },
    staticAnalysisService: {
      run: () => { staticCalls += 1 }
    },
    llmService: {
      generate: () => { llmCalls += 1 }
    }
  })

  await service.processFetchCommitDiffJob({
    repositoryId: 'repo-1',
    beforeCommitSha: null,
    afterCommitSha: 'head789',
    branch: 'main'
  })

  assert.equal(staticCalls, 0)
  assert.equal(llmCalls, 0)
})
