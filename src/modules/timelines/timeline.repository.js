import TimelineEvent from '#models/timelineEvent.model.js'

const count = async (filter = {}) => {
  return await TimelineEvent.countDocuments(filter)
}

const create = async (data) => {
  return await TimelineEvent.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 50, sort = { startTime: 1 } } = {}) => {
  return await TimelineEvent.find(filter)
    .populate({ path: 'eventId', select: 'title semester status' })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await TimelineEvent.findById(id)
    .populate({ path: 'eventId', select: 'title semester status' })
}

const updateById = async (id, data) => {
  return await TimelineEvent.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate({ path: 'eventId', select: 'title semester status' })
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
