import Competition from '#models/competition.model.js'
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
    .populate({ path: 'competitionId', select: 'title semester status' })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Track.findById(id).populate({ path: 'competitionId', select: 'title semester status' })
}

const findByCompetitionAndName = async (competitionId, name) => {
  return await Track.findOne({ competitionId, name }).collation({ locale: 'en', strength: 2 })
}

const findByCompetitionAndCode = async (competitionId, code) => {
  return await Track.findOne({ competitionId, code })
}

const updateById = async (id, data) => {
  return await Track.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate({ path: 'competitionId', select: 'title semester status' })
}

const deleteById = async (id) => {
  return await Track.findByIdAndDelete(id)
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

export const TRACK_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByCompetitionAndName,
  findByCompetitionAndCode,
  updateById,
  deleteById,
  findCompetitionIdsForParticipant,
  findOpenRegistrationCompetitionIds,
  findNonDraftCompetitionIds
}
