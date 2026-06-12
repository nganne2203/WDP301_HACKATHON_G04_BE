import Score from '#models/score.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'

const scorePopulate = [{
  path: 'scoreIds',
  populate: [
    { path: 'criterionId', select: 'name description maxScore weight order' },
    { path: 'judgeId', select: 'fullName email' }
  ]
}]

const scoreSheetPopulate = [
  { path: 'eventId', select: 'title semester season year status competitionConfig' },
  { path: 'roundId', select: 'name roundType status tieBreakRule rubricId' },
  { path: 'boardId', select: 'name boardNumber teamIds judgeIds status' },
  { path: 'teamId', select: 'name chapterName projectName boardNumber status' },
  { path: 'submissionId', select: 'status submittedAt repositoryId demoUrl reportUrl presentationUrl' },
  { path: 'judgeId', select: 'fullName email status' },
  { path: 'rubricId', select: 'title totalScore status version' },
  ...scorePopulate
]

const countScoreSheets = async (filter = {}) => {
  return await ScoreSheet.countDocuments(filter)
}

const findScoreSheets = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await ScoreSheet.find(filter)
    .populate(scoreSheetPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findScoreSheetById = async (id) => {
  return await ScoreSheet.findById(id).populate(scoreSheetPopulate)
}

const findScoreSheetByRoundTeamJudge = async ({ roundId, teamId, judgeId }) => {
  return await ScoreSheet.findOne({ roundId, teamId, judgeId }).populate(scoreSheetPopulate)
}

const createScoreSheet = async (data) => {
  return await ScoreSheet.create(data)
}

const updateScoreSheetById = async (id, data) => {
  return await ScoreSheet.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(scoreSheetPopulate)
}

const deleteScoresByScoreSheetId = async (scoreSheetId) => {
  await Score.deleteMany({ scoreSheetId })
}

const createScores = async (scores = []) => {
  return await Score.insertMany(scores)
}

export const SCORE_SHEET_REPOSITORY = {
  countScoreSheets,
  findScoreSheets,
  findScoreSheetById,
  findScoreSheetByRoundTeamJudge,
  createScoreSheet,
  updateScoreSheetById,
  deleteScoresByScoreSheetId,
  createScores
}
