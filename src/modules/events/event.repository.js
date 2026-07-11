import Event from '#models/event.model.js'
import Participant from '#models/participant.model.js'

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

const findEventIdsForParticipant = async (userId) => {
  return await Participant.find({ userId }).distinct('eventId')
}

const findOpenRegistrationEventIds = async (now = new Date()) => {
  return await Event.find({
    status: 'OPEN_REGISTRATION',
    $and: [
      { $or: [{ registrationStart: { $exists: false } }, { registrationStart: null }, { registrationStart: { $lte: now } }] },
      { $or: [{ registrationEnd: { $exists: false } }, { registrationEnd: null }, { registrationEnd: { $gte: now } }] }
    ]
  }).distinct('_id')
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
  findEventIdsForParticipant,
  findOpenRegistrationEventIds,
  updateById,
  deleteById
}
