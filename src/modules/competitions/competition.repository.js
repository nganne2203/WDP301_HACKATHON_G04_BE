import Competition from '#models/competition.model.js'
import Participant from '#models/participant.model.js'

const count = async (filter = {}) => {
  return await Competition.countDocuments(filter)
}

const create = async (data) => {
  return await Competition.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { startDate: -1, createdAt: -1 } } = {}) => {
  return await Competition.find(filter)
    .populate({ path: 'createdBy', select: 'fullName email' })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Competition.findById(id).populate({ path: 'createdBy', select: 'fullName email' })
}

const findCompetitionIdsForParticipant = async (userId) => {
  return await Participant.find({ userId }).distinct('competitionId')
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

const updateById = async (id, data) => {
  return await Competition.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate({ path: 'createdBy', select: 'fullName email' })
}

const deleteById = async (id) => {
  return await Competition.findByIdAndDelete(id)
}

export const COMPETITION_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findCompetitionIdsForParticipant,
  findOpenRegistrationCompetitionIds,
  updateById,
  deleteById
}
