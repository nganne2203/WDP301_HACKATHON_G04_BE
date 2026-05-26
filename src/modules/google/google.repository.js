import User from '#models/user.model.js'

const userSelect = 'email fullName googleAuth googleCalendar avatarUrl status roles'

const findUserById = async (id) => {
  return await User.findById(id).select(userSelect)
}

const updateUserById = async (id, data) => {
  return await User.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).select(userSelect)
}

export const GOOGLE_REPOSITORY = {
  findUserById,
  updateUserById
}
