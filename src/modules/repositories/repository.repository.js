import Repository from '#models/repository.model.js'

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

export const REPOSITORY_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByTeamId,
  updateById
}
