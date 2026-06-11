import Permission from '#models/permission.model.js'

const findAll = ({ filter = {}, skip = 0, limit = 100 } = {}) => {
  return Permission.find(filter).sort({ module: 1, code: 1 }).skip(skip).limit(limit).lean()
}

const findById = (id) => {
  return Permission.findById(id).lean()
}

const findByCode = (code) => {
  return Permission.findOne({ code: code.toUpperCase() }).lean()
}

const findByCodes = (codes = []) => {
  return Permission.find({ code: { $in: codes.map(c => c.toUpperCase()) } }).lean()
}

const findByIds = (ids = []) => {
  return Permission.find({ _id: { $in: ids } }).lean()
}

const count = (filter = {}) => {
  return Permission.countDocuments(filter)
}

const updateById = (id, data) => {
  return Permission.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean()
}

export const PERMISSION_REPOSITORY = {
  findAll,
  findById,
  findByCode,
  findByCodes,
  findByIds,
  count,
  updateById
}
