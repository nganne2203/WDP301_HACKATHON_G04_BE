import AiReview from '#models/aiReview.model.js'
import AiReviewCriterion from '#models/aiReviewCriterion.model.js'
import ChangedCodeContext from '#models/changedCodeContext.model.js'
import Commit from '#models/commit.model.js'
import CommitDiff from '#models/commitDiff.model.js'
import Criterion from '#models/criterion.model.js'
import Event from '#models/event.model.js'
import ImpactDecision from '#models/impactDecision.model.js'
import Repository from '#models/repository.model.js'
import Round from '#models/round.model.js'
import Rubric from '#models/rubric.model.js'
import StaticAnalysisResult from '#models/staticAnalysisResult.model.js'
import SuggestedJudgeQuestion from '#models/suggestedJudgeQuestion.model.js'
import SuggestedTestCase from '#models/suggestedTestCase.model.js'
import Team from '#models/team.model.js'
import TechnicalFinding from '#models/technicalFinding.model.js'

const aiReviewPopulate = [
  { path: 'eventId', select: 'title semester season year status competitionConfig' },
  { path: 'teamId', select: 'name chapterName projectName status boardNumber placementSlot qualificationStatus' },
  { path: 'roundId', select: 'name roundType status rubricId promotionRule tieBreakRule' },
  { path: 'repositoryId', select: 'repositoryFullName githubOwner githubRepo defaultBranch latestCommitSha lastProcessedCommitSha' },
  { path: 'commitId', select: 'commitSha branch authorName authorEmail authorUsername timestamp message commitUrl linesAdded linesRemoved filesChanged' },
  { path: 'commitDiffId', select: 'headCommitSha baseCommitSha status totalFiles includedFiles excludedFiles cleanDiffText files fetchedAt' },
  { path: 'impactDecisionId', select: 'impactScore impactLevel decision reasons needsHumanReview' }
]

const findRepositoryById = async (id) => {
  return await Repository.findById(id)
    .populate({ path: 'eventId', select: 'title semester season year status competitionConfig' })
    .populate({ path: 'teamId', select: 'name chapterName projectName status boardNumber placementSlot qualificationStatus' })
    .populate({ path: 'roundId', select: 'name roundType status rubricId promotionRule tieBreakRule assignedJudgeIds assignedTeamIds' })
}

const findTeamById = async (id) => {
  return await Team.findById(id)
}

const findRepositoriesByTeamId = async (teamId) => {
  return await Repository.find({ teamId })
    .populate({ path: 'eventId', select: 'title semester season year status competitionConfig' })
    .populate({ path: 'teamId', select: 'name chapterName projectName status boardNumber placementSlot qualificationStatus' })
    .populate({ path: 'roundId', select: 'name roundType status rubricId promotionRule tieBreakRule' })
}

const findEventById = async (id) => {
  return await Event.findById(id)
}

const findRoundById = async (id) => {
  return await Round.findById(id)
}

const findRubricById = async (id) => {
  return await Rubric.findById(id)
}

const findCriteriaByRubricId = async (rubricId) => {
  return await Criterion.find({ rubricId }).sort({ createdAt: 1 })
}

const findCommitByRepositoryAndSha = async ({ repositoryId, commitSha }) => {
  return await Commit.findOne({ repositoryId, commitSha })
}

const findLatestCommitsByRepository = async ({ repositoryId, limit = 10 }) => {
  return await Commit.find({ repositoryId })
    .sort({ timestamp: -1, createdAt: -1 })
    .limit(limit)
}

const findCommitDiffByRepositoryAndHeadSha = async ({ repositoryId, headCommitSha }) => {
  return await CommitDiff.findOne({ repositoryId, headCommitSha })
}

const findLatestCommitDiffsByRepository = async ({ repositoryId, limit = 10 }) => {
  return await CommitDiff.find({ repositoryId })
    .sort({ fetchedAt: -1, createdAt: -1 })
    .limit(limit)
}

const listStaticAnalysisResultsByRepositoryAndCommit = async ({ repositoryId, commitSha }) => {
  return await StaticAnalysisResult.find({ repositoryId, commitSha }).sort({ createdAt: 1 })
}

const listChangedCodeContextsByRepositoryAndCommit = async ({ repositoryId, commitSha }) => {
  return await ChangedCodeContext.find({ repositoryId, commitSha }).sort({ filePath: 1, startLine: 1, createdAt: 1 })
}

const findImpactDecisionByRepositoryAndCommit = async ({ repositoryId, commitSha }) => {
  return await ImpactDecision.findOne({ repositoryId, commitSha })
}

const listImpactDecisionsByRepository = async ({ repositoryId, limit = 20 }) => {
  return await ImpactDecision.find({ repositoryId })
    .sort({ createdAt: -1, updatedAt: -1 })
    .limit(limit)
}

const createAiReview = async (data) => {
  return await AiReview.create(data)
}

const updateAiReviewById = async (id, data) => {
  return await AiReview.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(aiReviewPopulate)
}

const findAiReviewById = async (id) => {
  return await AiReview.findById(id).populate(aiReviewPopulate)
}

const listAiReviewsByRepository = async ({ repositoryId, skip = 0, limit = 10 }) => {
  return await AiReview.find({ repositoryId })
    .populate(aiReviewPopulate)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
}

const countAiReviewsByRepository = async (repositoryId) => {
  return await AiReview.countDocuments({ repositoryId })
}

const listAiReviewsByTeam = async ({ teamId, limit = 20 }) => {
  return await AiReview.find({ teamId })
    .populate(aiReviewPopulate)
    .sort({ createdAt: -1 })
    .limit(limit)
}

const replaceAiReviewCriteria = async ({ aiReviewId, criteria }) => {
  await AiReviewCriterion.deleteMany({ aiReviewId })
  if (!criteria.length) return []
  return await AiReviewCriterion.insertMany(criteria)
}

const replaceTechnicalFindings = async ({ aiReviewId, findings }) => {
  await TechnicalFinding.deleteMany({ aiReviewId })
  if (!findings.length) return []
  return await TechnicalFinding.insertMany(findings)
}

const replaceSuggestedTestCases = async ({ aiReviewId, testCases }) => {
  await SuggestedTestCase.deleteMany({ aiReviewId })
  if (!testCases.length) return []
  return await SuggestedTestCase.insertMany(testCases)
}

const replaceSuggestedJudgeQuestions = async ({ aiReviewId, questions }) => {
  await SuggestedJudgeQuestion.deleteMany({ aiReviewId })
  if (!questions.length) return []
  return await SuggestedJudgeQuestion.insertMany(questions)
}

const listAiReviewCriteria = async (aiReviewId) => {
  return await AiReviewCriterion.find({ aiReviewId }).sort({ order: 1, createdAt: 1 })
}

const listTechnicalFindings = async (aiReviewId) => {
  return await TechnicalFinding.find({ aiReviewId }).sort({ severity: -1, createdAt: 1 })
}

const listSuggestedTestCases = async (aiReviewId) => {
  return await SuggestedTestCase.find({ aiReviewId }).sort({ createdAt: 1 })
}

const listSuggestedJudgeQuestions = async (aiReviewId) => {
  return await SuggestedJudgeQuestion.find({ aiReviewId }).sort({ priority: -1, createdAt: 1 })
}

const upsertCommit = async ({ repositoryId, commitSha, data }) => {
  return await Commit.findOneAndUpdate(
    { repositoryId, commitSha },
    { $set: { repositoryId, commitSha, ...data } },
    { upsert: true, new: true }
  )
}

const upsertCommitDiff = async ({ repositoryId, headCommitSha, data }) => {
  return await CommitDiff.findOneAndUpdate(
    { repositoryId, headCommitSha },
    { $set: { repositoryId, headCommitSha, ...data } },
    { upsert: true, new: true }
  )
}

export const AI_REVIEW_REPOSITORY = {
  findRepositoryById,
  findTeamById,
  findRepositoriesByTeamId,
  findEventById,
  findRoundById,
  findRubricById,
  findCriteriaByRubricId,
  findCommitByRepositoryAndSha,
  findLatestCommitsByRepository,
  findCommitDiffByRepositoryAndHeadSha,
  findLatestCommitDiffsByRepository,
  listStaticAnalysisResultsByRepositoryAndCommit,
  listChangedCodeContextsByRepositoryAndCommit,
  findImpactDecisionByRepositoryAndCommit,
  listImpactDecisionsByRepository,
  createAiReview,
  updateAiReviewById,
  findAiReviewById,
  listAiReviewsByRepository,
  countAiReviewsByRepository,
  listAiReviewsByTeam,
  replaceAiReviewCriteria,
  replaceTechnicalFindings,
  replaceSuggestedTestCases,
  replaceSuggestedJudgeQuestions,
  listAiReviewCriteria,
  listTechnicalFindings,
  listSuggestedTestCases,
  listSuggestedJudgeQuestions,
  upsertCommit,
  upsertCommitDiff
}
