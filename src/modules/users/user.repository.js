import User from '#models/user.model.js'
import Role from '#models/role.model.js'
import Participant from '#models/participant.model.js'
import '#models/event.model.js'
import '#models/permission.model.js'

const populateRoles = [
  {
    path: 'roles',
    select: 'name code description permissions isSystemRole isActive',
    populate: {
      path: 'permissions',
      select: 'code name description module isActive'
    }
  }
]

const create = async (data) => {
  return await User.create(data)
}

const count = async (filter = {}) => {
  return await User.countDocuments(filter)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await User.find(filter)
    .populate(populateRoles)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await User.findById(id).populate(populateRoles)
}

const findByEmail = async (email) => {
  return await User.findOne({ email }).populate(populateRoles)
}

const findRoleByName = async (name) => {
  return await Role.findOne({ name: String(name).toUpperCase() })
}

const findRolesByNames = async (names) => {
  const normalizedNames = names.map(name => String(name).toUpperCase())
  return await Role.find({ name: { $in: normalizedNames }, isActive: true })
}

const findRolesByIds = async (ids) => {
  return await Role.find({ _id: { $in: ids }, isActive: true }).populate({ path: 'permissions', select: 'code name description module isActive' })
}

const updateById = async (id, data) => {
  return await User.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(populateRoles)
}

const findStartedJoinedParticipantByUserId = async (userId, now = new Date()) => {
  const participants = await Participant.find({
    userId,
    status: 'JOINED'
  })
    .populate({
      path: 'eventId',
      match: { startDate: { $lte: now } },
      select: 'title startDate status'
    })

  return participants.find((participant) => participant.eventId) || null
}

const deleteById = async (id) => {
  return await User.findByIdAndDelete(id)
}

export const USER_REPOSITORY = {
  create,
  count,
  findAll,
  findById,
  findByEmail,
  findRoleByName,
  findRolesByNames,
  findRolesByIds,
  findStartedJoinedParticipantByUserId,
  updateById,
  deleteById
}
