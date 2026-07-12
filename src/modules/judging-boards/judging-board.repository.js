import JudgingBoard from '#models/judgingBoard.model.js'
import RoundTeamPlacement from '#models/roundTeamPlacement.model.js'

const boardPopulate = [
  { path: 'eventId', select: 'title semester season year status competitionConfig' },
  { path: 'roundId', select: 'name roundType status trackId startTime endTime submissionOpenAt submissionCloseAt submissionDeadline publishTime' },
  { path: 'trackId', select: 'code name type maxTeams status' },
  { path: 'teamIds', select: 'name chapterName projectName status trackId boardNumber placementSlot' },
  { path: 'judgeIds', select: 'email fullName status roles', populate: { path: 'roles', select: 'name code' } }
]

const count = async (filter = {}) => {
  return await JudgingBoard.countDocuments(filter)
}

const create = async (data) => {
  return await JudgingBoard.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { boardNumber: 1, createdAt: 1 } } = {}) => {
  return await JudgingBoard.find(filter)
    .populate(boardPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await JudgingBoard.findById(id).populate(boardPopulate)
}

const updateById = async (id, data) => {
  return await JudgingBoard.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(boardPopulate)
}

const deleteById = async (id) => {
  return await JudgingBoard.findByIdAndDelete(id)
}

const findByRoundAndBoardNumber = async ({ roundId, boardNumber }) => {
  return await JudgingBoard.findOne({ roundId, boardNumber }).populate(boardPopulate)
}

const findByRoundId = async (roundId) => {
  return await JudgingBoard.find({ roundId })
    .populate(boardPopulate)
    .sort({ boardNumber: 1, createdAt: 1 })
}

const deleteManyByRoundExcludingBoardNumbers = async ({ roundId, boardNumbers = [] }) => {
  return await JudgingBoard.deleteMany({
    roundId,
    boardNumber: { $nin: boardNumbers }
  })
}

const replaceRoundTeamPlacements = async ({ eventId, roundId, placements = [] }) => {
  await RoundTeamPlacement.deleteMany({ eventId, roundId })
  if (placements.length === 0) return []
  return await RoundTeamPlacement.insertMany(placements)
}

export const JUDGING_BOARD_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  updateById,
  deleteById,
  findByRoundAndBoardNumber,
  findByRoundId,
  deleteManyByRoundExcludingBoardNumbers,
  replaceRoundTeamPlacements
}
