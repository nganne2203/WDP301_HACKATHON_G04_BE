import Role from '#models/role.model.js'
import User from '#models/user.model.js'

const POPULATE_PERMISSIONS = { path: 'permissions', select: 'code name description module isActive' }

const findAll = ({ filter = {}, skip = 0, limit = 100 } = {}) => {
  return Role.find(filter)
    .populate(POPULATE_PERMISSIONS)
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

const findById = (id) => {
  return Role.findById(id).populate(POPULATE_PERMISSIONS).lean()
}

const findByName = (name) => {
  return Role.findOne({ name: name.toUpperCase() }).populate(POPULATE_PERMISSIONS).lean()
}

const findByCode = (code) => {
  return Role.findOne({ code: code.toUpperCase() }).populate(POPULATE_PERMISSIONS).lean()
}

const findByNames = (names = []) => {
  return Role.find({ name: { $in: names.map(n => n.toUpperCase()) } })
    .populate(POPULATE_PERMISSIONS)
    .lean()
}

const count = (filter = {}) => {
  return Role.countDocuments(filter)
}

const countUsersByRoleId = (roleId) => {
  return User.countDocuments({ roles: roleId })
}

const create = (data) => {
  return Role.create(data)
}

const updateById = (id, data) => {
  return Role.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
    .populate(POPULATE_PERMISSIONS)
    .lean()
}

const softDeleteById = (id) => {
  return Role.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean()
}

export const ROLE_REPOSITORY = {
  findAll,
  findById,
  findByName,
  findByCode,
  findByNames,
  count,
  countUsersByRoleId,
  create,
  updateById,
  softDeleteById
}
