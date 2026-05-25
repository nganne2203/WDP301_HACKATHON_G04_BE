import Event from '#models/event.model.js'

const count = async (filter = {}) => {
  return await Event.countDocuments(filter)
}

const create = async (data) => {
  return await Event.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { startDate: -1, createdAt: -1 } } = {}) => {
  return await Event.find(filter)
    .populate({ path: 'createdBy', select: 'fullName email' })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Event.findById(id).populate({ path: 'createdBy', select: 'fullName email' })
}

const updateById = async (id, data) => {
  return await Event.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate({ path: 'createdBy', select: 'fullName email' })
}

const deleteById = async (id) => {
  return await Event.findByIdAndDelete(id)
}

export const EVENT_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  updateById,
  deleteById
}
