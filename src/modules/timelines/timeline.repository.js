import Event from '#models/event.model.js'
import Participant from '#models/participant.model.js'
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

export const TIMELINE_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  updateById,
  deleteById,
  findEventIdsForParticipant,
  findOpenRegistrationEventIds,
  findNonDraftEventIds
}
