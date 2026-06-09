import Commit from '#models/commit.model.js'
import CommitDiff from '#models/commitDiff.model.js'
import ChangedCodeContext from '#models/changedCodeContext.model.js'
import GitHubWebhookEvent from '#models/githubWebhookEvent.model.js'
import ImpactDecision from '#models/impactDecision.model.js'
import Repository from '#models/repository.model.js'
import StaticAnalysisResult from '#models/staticAnalysisResult.model.js'
import SystemConfiguration from '#models/systemConfiguration.model.js'

const commitPopulate = [
  { path: 'repositoryId', select: 'repositoryFullName githubOwner githubRepo eventId teamId roundId defaultBranch latestCommitSha lastProcessedCommitSha' }
]

const commitDiffPopulate = [
  { path: 'repositoryId', select: 'repositoryFullName githubOwner githubRepo eventId teamId roundId defaultBranch latestCommitSha lastProcessedCommitSha' },
  { path: 'commitId', select: 'commitSha branch authorName authorEmail authorUsername timestamp message commitUrl linesAdded linesRemoved filesChanged' }
]

const findRepositoryById = async (id) => {
  return await Repository.findById(id)
}

const findRepositoriesForScan = async ({ repositoryId } = {}) => {
  const filter = repositoryId
    ? { _id: repositoryId }
    : { status: 'ACTIVE', accessState: { $in: ['GRANTED', 'UNKNOWN', 'PENDING'] } }

  return await Repository.find(filter).sort({ updatedAt: -1 })
}

const updateRepositoryById = async (id, data) => {
  return await Repository.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  })
}

const upsertCommit = async ({ repositoryId, commitSha, data }) => {
  return await Commit.findOneAndUpdate(
    { repositoryId, commitSha },
    { $set: data },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

const upsertCommitDiff = async ({ repositoryId, headCommitSha, data }) => {
  return await CommitDiff.findOneAndUpdate(
    { repositoryId, headCommitSha },
    { $set: data },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

const listCommitsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await Commit.find({ repositoryId })
    .populate(commitPopulate)
    .sort({ timestamp: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countCommitsByRepository = async (repositoryId) => {
  return await Commit.countDocuments({ repositoryId })
}

const listCommitDiffsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await CommitDiff.find({ repositoryId })
    .populate(commitDiffPopulate)
    .sort({ fetchedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countCommitDiffsByRepository = async (repositoryId) => {
  return await CommitDiff.countDocuments({ repositoryId })
}

const findCommitDiffByRepositoryAndHeadSha = async ({ repositoryId, headCommitSha }) => {
  return await CommitDiff.findOne({ repositoryId, headCommitSha }).populate(commitDiffPopulate)
}

const findCommitByRepositoryAndSha = async ({ repositoryId, commitSha }) => {
  return await Commit.findOne({ repositoryId, commitSha }).populate(commitPopulate)
}

const upsertStaticAnalysisResult = async ({ repositoryId, commitSha, source, data }) => {
  return await StaticAnalysisResult.findOneAndUpdate(
    { repositoryId, commitSha, source },
    { $set: data },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

const listStaticAnalysisResultsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await StaticAnalysisResult.find({ repositoryId })
    .sort({ createdAt: -1, updatedAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countStaticAnalysisResultsByRepository = async (repositoryId) => {
  return await StaticAnalysisResult.countDocuments({ repositoryId })
}

const replaceChangedCodeContexts = async ({ repositoryId, commitSha, contexts }) => {
  await ChangedCodeContext.deleteMany({ repositoryId, commitSha })
  if (!contexts.length) return []
  return await ChangedCodeContext.insertMany(contexts)
}

const listChangedCodeContexts = async ({ repositoryId, commitSha }) => {
  return await ChangedCodeContext.find({ repositoryId, commitSha }).sort({ filePath: 1, startLine: 1, createdAt: 1 })
}

const upsertImpactDecision = async ({ repositoryId, commitSha, data }) => {
  return await ImpactDecision.findOneAndUpdate(
    { repositoryId, commitSha },
    { $set: data },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

const listImpactDecisionsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await ImpactDecision.find({ repositoryId })
    .sort({ createdAt: -1, updatedAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countImpactDecisionsByRepository = async (repositoryId) => {
  return await ImpactDecision.countDocuments({ repositoryId })
}

const findConfigByKey = async (key) => {
  return await SystemConfiguration.findOne({ key })
}

const updateWebhookDeliveryById = async (id, data) => {
  return await GitHubWebhookEvent.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  })
}

export const REPOSITORY_EVIDENCE_REPOSITORY = {
  findRepositoryById,
  findRepositoriesForScan,
  updateRepositoryById,
  upsertCommit,
  upsertCommitDiff,
  listCommitsByRepository,
  countCommitsByRepository,
  listCommitDiffsByRepository,
  countCommitDiffsByRepository,
  findCommitDiffByRepositoryAndHeadSha,
  findCommitByRepositoryAndSha,
  upsertStaticAnalysisResult,
  listStaticAnalysisResultsByRepository,
  countStaticAnalysisResultsByRepository,
  replaceChangedCodeContexts,
  listChangedCodeContexts,
  upsertImpactDecision,
  listImpactDecisionsByRepository,
  countImpactDecisionsByRepository,
  findConfigByKey,
  updateWebhookDeliveryById
}
