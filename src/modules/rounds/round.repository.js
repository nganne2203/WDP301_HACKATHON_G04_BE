import Round from '#models/round.model.js'

const roundPopulate = [
  { path: 'eventId', select: 'title semester season year status competitionConfig' },
  { path: 'trackId', select: 'code name type maxTeams status' },
  { path: 'assignedTeamIds', select: 'name chapterName projectName status trackId boardNumber placementSlot' },
  { path: 'promotedTeamIds', select: 'name chapterName projectName status trackId boardNumber placementSlot' },
  { path: 'assignedJudgeIds', select: 'email fullName status roles', populate: { path: 'roles', select: 'name code' } },
  { path: 'rubricId', select: 'title description totalScore' }
]

const count = async (filter = {}) => {
  return await Round.countDocuments(filter)
}

const create = async (data) => {
  return await Round.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { startTime: 1, createdAt: 1 } } = {}) => {
  return await Round.find(filter)
    .populate(roundPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Round.findById(id).populate(roundPopulate)
}

const updateById = async (id, data) => {
  return await Round.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(roundPopulate)
}

const deleteById = async (id) => {
  return await Round.findByIdAndDelete(id)
}

export const ROUND_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  updateById,
  deleteById
}
