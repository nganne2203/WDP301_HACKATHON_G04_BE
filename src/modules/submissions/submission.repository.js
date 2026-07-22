import Submission from '#models/submission.model.js'

const submissionPopulate = [
  { path: 'competitionId', select: 'title semester season year status competitionConfig' },
  { path: 'roundId', select: 'name roundType status assignedTeamIds rubricId submissionDeadline' },
  { path: 'teamId', select: 'name chapterName projectName status boardNumber trackId' },
  { path: 'repositoryId', select: 'repositoryFullName repositoryUrl status accessState' }
]

const count = async (filter = {}) => {
  return await Submission.countDocuments(filter)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await Submission.find(filter)
    .populate(submissionPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Submission.findById(id).populate(submissionPopulate)
}

const findByRoundAndTeam = async ({ roundId, teamId }) => {
  return await Submission.findOne({ roundId, teamId }).populate(submissionPopulate)
}

const findByTeamId = async (teamId) => {
  return await Submission.find({ teamId }).populate(submissionPopulate)
}

const create = async (data) => {
  return await Submission.create(data)
}

const updateById = async (id, data) => {
  return await Submission.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(submissionPopulate)
}

export const SUBMISSION_REPOSITORY = {
  count,
  findAll,
  findById,
  findByRoundAndTeam,
  findByTeamId,
  create,
  updateById
}
