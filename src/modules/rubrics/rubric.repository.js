import Criterion from '#models/criterion.model.js'
import Rubric from '#models/rubric.model.js'

const rubricPopulate = [
  { path: 'eventId', select: 'title semester season year status' },
  { path: 'roundId', select: 'name roundType status' },
  { path: 'createdBy', select: 'fullName email' }
]

const countRubrics = async (filter = {}) => {
  return await Rubric.countDocuments(filter)
}

const findRubrics = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await Rubric.find(filter)
    .populate(rubricPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findRubricById = async (id) => {
  return await Rubric.findById(id).populate(rubricPopulate)
}

const createRubric = async (data) => {
  return await Rubric.create(data)
}

const updateRubricById = async (id, data) => {
  return await Rubric.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(rubricPopulate)
}

const createCriterion = async (data) => {
  return await Criterion.create(data)
}

const findCriteriaByRubricId = async (rubricId) => {
  return await Criterion.find({ rubricId }).sort({ order: 1, createdAt: 1 })
}

export const RUBRIC_REPOSITORY = {
  countRubrics,
  findRubrics,
  findRubricById,
  createRubric,
  updateRubricById,
  createCriterion,
  findCriteriaByRubricId
}
