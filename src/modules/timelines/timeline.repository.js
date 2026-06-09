import TimelineEvent from '#models/timelineEvent.model.js'

const timelinePopulate = [
  { path: 'eventId', select: 'title semester season year status' }
]

const count = async (filter = {}) => {
  return await TimelineEvent.countDocuments(filter)
}

const create = async (data) => {
  return await TimelineEvent.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { startTime: 1, createdAt: 1 } } = {}) => {
  return await TimelineEvent.find(filter)
    .populate(timelinePopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await TimelineEvent.findById(id).populate(timelinePopulate)
}

const updateById = async (id, data) => {
  return await TimelineEvent.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(timelinePopulate)
}

const deleteById = async (id) => {
  return await TimelineEvent.findByIdAndDelete(id)
}

export const TIMELINE_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  updateById,
  deleteById
}
