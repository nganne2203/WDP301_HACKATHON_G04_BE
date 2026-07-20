import Ranking from '#models/ranking.model.js'
import JudgingBoard from '#models/judgingBoard.model.js'
import RoundTeamPlacement from '#models/roundTeamPlacement.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'

const rankingPopulate = [
  { path: 'competitionId', select: 'title semester season year status competitionConfig' },
  { path: 'roundId', select: 'name roundType status tieBreakRule' },
  { path: 'trackId', select: 'code name status' },
  { path: 'teamId', select: 'name chapterName projectName boardNumber trackId status' },
  { path: 'publishedBy', select: 'fullName email' },
  { path: 'tieBreakResolvedBy', select: 'fullName email' }
]

const findRankings = async ({ filter = {}, skip = 0, limit = 50, sort = { rank: 1, score: -1 } } = {}) => {
  return await Ranking.find(filter)
    .populate(rankingPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const countRankings = async (filter = {}) => {
  return await Ranking.countDocuments(filter)
}

const deleteRankings = async (filter = {}) => {
  await Ranking.deleteMany(filter)
}

const createManyRankings = async (items = []) => {
  return await Ranking.insertMany(items)
}

const updateRankingById = async (id, data) => {
  return await Ranking.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(rankingPopulate)
}

const updateManyRankings = async (filter = {}, data = {}) => {
  await Ranking.updateMany(filter, data)
}

const findRankingById = async (id) => {
  return await Ranking.findById(id).populate(rankingPopulate)
}

const findScoreSheetsForRanking = async ({ competitionId, roundId }) => {
  return await ScoreSheet.find({
    competitionId,
    roundId,
    status: 'LOCKED'
  }).populate([
    { path: 'teamId', select: 'name chapterName projectName boardNumber trackId status' },
    { path: 'judgeId', select: 'fullName email' },
    { path: 'boardId', select: 'name boardNumber' }
  ])
}

const findRoundTeamPlacements = async ({ competitionId, roundId }) => {
  return await RoundTeamPlacement.find({ competitionId, roundId })
}

const findBoardsForRanking = async ({ competitionId, roundId }) => {
  return await JudgingBoard.find({
    competitionId,
    roundId,
    teamIds: { $exists: true, $ne: [] },
    judgeIds: { $exists: true, $ne: [] }
  }).populate([
    { path: 'teamIds', select: 'name status' },
    { path: 'judgeIds', select: 'fullName email status roles', populate: { path: 'roles', select: 'name code' } }
  ])
}

export const RANKING_REPOSITORY = {
  findRankings,
  countRankings,
  deleteRankings,
  createManyRankings,
  findRankingById,
  updateRankingById,
  updateManyRankings,
  findScoreSheetsForRanking,
  findRoundTeamPlacements,
  findBoardsForRanking
}
