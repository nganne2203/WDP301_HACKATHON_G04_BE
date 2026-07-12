import Event from '#models/event.model.js'
import Participant from '#models/participant.model.js'
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

const findEventIdsForParticipant = async (userId) => {
  return await Participant.find({ userId, status: 'JOINED' }).distinct('eventId')
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

const findNonDraftEventIds = async () => {
  return await Event.find({ status: { $ne: 'DRAFT' } }).distinct('_id')
}

export const TRACK_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByEventAndName,
  updateById,
  deleteById,
  findEventIdsForParticipant,
  findOpenRegistrationEventIds,
  findNonDraftEventIds
}
