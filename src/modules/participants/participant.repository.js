import Participant from '#models/participant.model.js'

const USER_SELECT = 'fullName email avatarUrl studentId studentType schoolName'
const TEAM_SELECT = 'name status trackId leaderId'

const count = async (filter = {}) => {
  return await Participant.countDocuments(filter)
}

const create = async (data) => {
  return await Participant.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await Participant.find(filter)
    .populate({ path: 'userId', select: USER_SELECT })
    .populate({ path: 'teamId', select: TEAM_SELECT })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Participant.findById(id)
    .populate({ path: 'userId', select: USER_SELECT })
    .populate({ path: 'teamId', select: TEAM_SELECT })
}

const findByEventAndUser = async (eventId, userId) => {
  return await Participant.findOne({ eventId, userId })
}

const updateById = async (id, data) => {
  return await Participant.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  })
    .populate({ path: 'userId', select: USER_SELECT })
    .populate({ path: 'teamId', select: TEAM_SELECT })
}

const deleteById = async (id) => {
  return await Participant.findByIdAndDelete(id)
}

export const PARTICIPANT_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByEventAndUser,
  updateById,
  deleteById
}
