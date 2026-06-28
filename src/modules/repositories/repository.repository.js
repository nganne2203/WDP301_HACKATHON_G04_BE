import Repository from '#models/repository.model.js'
import Commit from '#models/commit.model.js'
import CommitDiff from '#models/commitDiff.model.js'
import ImpactDecision from '#models/impactDecision.model.js'
import StaticAnalysisResult from '#models/staticAnalysisResult.model.js'

const repositoryPopulate = [
  { path: 'eventId', select: 'title semester season year status competitionConfig' },
  { path: 'teamId', select: 'name chapterName projectName status trackId boardNumber placementSlot' },
  { path: 'roundId', select: 'name roundType status trackId' }
]

const count = async (filter = {}) => {
  return await Repository.countDocuments(filter)
}

const create = async (data) => {
  return await Repository.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await Repository.find(filter)
    .populate(repositoryPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Repository.findById(id).populate(repositoryPopulate)
}

const findByTeamId = async (teamId) => {
  return await Repository.findOne({ teamId }).populate(repositoryPopulate)
}

const updateById = async (id, data) => {
  return await Repository.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(repositoryPopulate)
}

const listCommitsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await Commit.find({ repositoryId })
    .sort({ timestamp: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countCommitsByRepository = async (repositoryId) => {
  return await Commit.countDocuments({ repositoryId })
}

const listStaticAnalysisByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await StaticAnalysisResult.find({ repositoryId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countStaticAnalysisByRepository = async (repositoryId) => {
  return await StaticAnalysisResult.countDocuments({ repositoryId })
}

const listCommitDiffsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await CommitDiff.find({ repositoryId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countCommitDiffsByRepository = async (repositoryId) => {
  return await CommitDiff.countDocuments({ repositoryId })
}

const listImpactDecisionsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await ImpactDecision.find({ repositoryId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countImpactDecisionsByRepository = async (repositoryId) => {
  return await ImpactDecision.countDocuments({ repositoryId })
}

export const REPOSITORY_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByTeamId,
  updateById,
  listCommitsByRepository,
  countCommitsByRepository,
  listStaticAnalysisByRepository,
  countStaticAnalysisByRepository,
  listCommitDiffsByRepository,
  countCommitDiffsByRepository,
  listImpactDecisionsByRepository,
  countImpactDecisionsByRepository
}
