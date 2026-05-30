import Notification from '#models/notification.model.js'

const create = async (data) => {
  return await Notification.create(data)
}

const countByUser = async (userId, filter = {}) => {
  return await Notification.countDocuments({ ...filter, userId })
}

const findByUser = async ({ userId, filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 } } = {}) => {
  return await Notification.find({ ...filter, userId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const markAsRead = async ({ id, userId }) => {
  return await Notification.findOneAndUpdate(
    { _id: id, userId },
    { status: 'READ' },
    { new: true, runValidators: true }
  )
}

const markAllAsRead = async (userId) => {
  return await Notification.updateMany(
    { userId, status: 'UNREAD' },
    { status: 'READ' }
  )
}

export const NOTIFICATION_REPOSITORY = {
  create,
  countByUser,
  findByUser,
  markAsRead,
  markAllAsRead
}
