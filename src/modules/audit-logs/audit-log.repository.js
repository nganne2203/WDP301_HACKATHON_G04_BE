import AuditLog from '#models/auditLog.model.js'

const create = async (data) => {
  return await AuditLog.create(data)
}

const findAuditLogs = async ({ filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 } } = {}) => {
  return await AuditLog.find(filter)
    .populate({ path: 'userId', select: 'fullName email status' })
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const countAuditLogs = async (filter = {}) => {
  return await AuditLog.countDocuments(filter)
}

const aggregateByAction = async (filter = {}) => {
  return await AuditLog.aggregate([
    { $match: filter },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $project: { _id: 0, action: '$_id', count: 1 } },
    { $sort: { count: -1, action: 1 } },
    { $limit: 20 }
  ])
}

const aggregateByResourceType = async (filter = {}) => {
  return await AuditLog.aggregate([
    { $match: filter },
    { $group: { _id: '$resourceType', count: { $sum: 1 } } },
    { $project: { _id: 0, resourceType: '$_id', count: 1 } },
    { $sort: { count: -1, resourceType: 1 } },
    { $limit: 20 }
  ])
}

export const AUDIT_LOG_REPOSITORY = {
  create,
  findAuditLogs,
  countAuditLogs,
  aggregateByAction,
  aggregateByResourceType
}
