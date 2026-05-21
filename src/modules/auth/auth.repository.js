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

const createUser = async (data) => {
  return await User.create(data)
}

const findUserByEmail = async (email) => {
  return await User.findOne({ email }).populate(populateRoles)
}

const findUserById = async (id) => {
  return await User.findById(id).populate(populateRoles)
}

const findRoleByName = async (name) => {
  return await Role.findOne({ name: String(name).toUpperCase() })
}

export const AUTH_REPOSITORY = {
  createUser,
  findUserByEmail,
  findUserById,
  findRoleByName
}
