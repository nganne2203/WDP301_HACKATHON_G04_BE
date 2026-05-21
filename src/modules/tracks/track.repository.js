import Track from '#models/track.model.js'

const count = async (filter = {}) => {
  return await Track.countDocuments(filter)
}

const create = async (data) => {
  return await Track.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await Track.find(filter)
    .populate({ path: 'eventId', select: 'title semester status' })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Track.findById(id).populate({ path: 'eventId', select: 'title semester status' })
}

const findByEventAndName = async (eventId, name) => {
  return await Track.findOne({ eventId, name })
}

const updateById = async (id, data) => {
  return await Track.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate({ path: 'eventId', select: 'title semester status' })
}

const deleteById = async (id) => {
  return await Track.findByIdAndDelete(id)
}

export const TRACK_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByEventAndName,
  updateById,
  deleteById
}
