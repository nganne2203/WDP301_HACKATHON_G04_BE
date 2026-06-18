import User from '#models/user.model.js'
import Role from '#models/role.model.js'
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

const createUser = async (data) => {
  return await User.create(data)
}

const findUserByEmail = async (email) => {
  return await User.findOne({ email }).populate(populateRoles)
}

const findUserById = async (id) => {
  return await User.findById(id).populate(populateRoles)
}

const findUserByGoogleId = async (googleId) => {
  return await User.findOne({
    $or: [
      { googleId },
      { 'googleAuth.googleId': googleId }
    ]
  }).populate(populateRoles)
}

const findRoleByName = async (name) => {
  return await Role.findOne({ name: String(name).toUpperCase() })
}

const updateUserById = async (id, data) => {
  return await User.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(populateRoles)
}

export const AUTH_REPOSITORY = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  findRoleByName,
  updateUserById
}
