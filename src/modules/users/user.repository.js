import User from '#models/user.model.js'
import Role from '#models/role.model.js'
import '#models/permission.model.js'

const populateRoles = [
  {
    path: 'roles',
    select: 'name description permissions',
    populate: {
      path: 'permissions',
      select: 'code description'
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
  return await Role.find({ name: { $in: normalizedNames } })
}

const updateById = async (id, data) => {
  return await User.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(populateRoles)
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
  updateById,
  deleteById
}
