import Competition from '#models/competition.model.js'
import Participant from '#models/participant.model.js'
import TimelineActivity from '#models/timelineActivity.model.js'

const timelinePopulate = [
  { path: 'competitionId', select: 'title semester season year status' }
]

const count = async (filter = {}) => {
  return await TimelineActivity.countDocuments(filter)
}

const create = async (data) => {
  return await TimelineActivity.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { startTime: 1, createdAt: 1 } } = {}) => {
  return await TimelineActivity.find(filter)
    .populate(timelinePopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await TimelineActivity.findById(id).populate(timelinePopulate)
}

const updateById = async (id, data) => {
  return await TimelineActivity.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(timelinePopulate)
}

const deleteById = async (id) => {
  return await TimelineActivity.findByIdAndDelete(id)
}

const findCompetitionIdsForParticipant = async (userId) => {
  return await Participant.find({ userId, status: 'JOINED' }).distinct('competitionId')
}

const findOpenRegistrationCompetitionIds = async (now = new Date()) => {
  return await Competition.find({
    status: 'OPEN_REGISTRATION',
    $and: [
      { $or: [{ registrationStart: { $exists: false } }, { registrationStart: null }, { registrationStart: { $lte: now } }] },
      { $or: [{ registrationEnd: { $exists: false } }, { registrationEnd: null }, { registrationEnd: { $gte: now } }] }
    ]
  }).distinct('_id')
}

const findNonDraftCompetitionIds = async () => {
  return await Competition.find({ status: { $ne: 'DRAFT' } }).distinct('_id')
}

export const TIMELINE_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  updateById,
  deleteById,
  findCompetitionIdsForParticipant,
  findOpenRegistrationCompetitionIds,
  findNonDraftCompetitionIds
}
