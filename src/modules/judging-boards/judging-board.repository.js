import JudgingBoard from '#models/judgingBoard.model.js'

const boardPopulate = [
  { path: 'eventId', select: 'title semester season year status competitionConfig' },
  { path: 'roundId', select: 'name roundType status trackId startTime endTime submissionDeadline publishTime' },
  { path: 'trackId', select: 'code name type maxTeams status' },
  { path: 'teamIds', select: 'name chapterName projectName status trackId boardNumber placementSlot' },
  { path: 'judgeIds', select: 'email fullName status' }
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

export const JUDGING_BOARD_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  updateById,
  deleteById,
  findByRoundAndBoardNumber
}
