import mongoose from 'mongoose'

import { AUDIT_LOG_REPOSITORY } from './audit-log.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const normalizeAuditLog = (auditLog) => {
  if (!auditLog) return null
  const plain = typeof auditLog.toObject === 'function'
    ? auditLog.toObject({ getters: true, virtuals: false })
    : auditLog

  return {
    id: plain._id?.toString() || plain.id,
    userId: plain.userId?._id?.toString?.() || plain.userId?.toString?.() || plain.userId || null,
    action: plain.action,
    resourceType: plain.resourceType || null,
    resourceId: plain.resourceId?._id?.toString?.() || plain.resourceId?.toString?.() || plain.resourceId || null,
    metadata: plain.metadata || {},
    createdAt: plain.createdAt
  }
}

const buildAuditFilter = (query = {}) => {
  const filter = {}
  if (query.userId) {
    ensureObjectId(query.userId, 'user id')
    filter.userId = query.userId
  }
  if (query.action) filter.action = query.action
  if (query.resourceType) filter.resourceType = query.resourceType
  if (query.resourceId) {
    ensureObjectId(query.resourceId, 'resource id')
    filter.resourceId = query.resourceId
  }
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) filter.createdAt.$gte = new Date(query.from)
    if (query.to) filter.createdAt.$lte = new Date(query.to)
  }
  return filter
}

export const createAuditLogService = ({
  repository = AUDIT_LOG_REPOSITORY
} = {}) => {
  const listAuditLogs = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = buildAuditFilter(query)

    const [auditLogs, totalItems] = await Promise.all([
      repository.findAuditLogs({ filter, skip, limit }),
      repository.countAuditLogs(filter)
    ])

    return {
      auditLogs: auditLogs.map(normalizeAuditLog),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getAuditLogSummary = async (query = {}) => {
    const filter = buildAuditFilter(query)
    const [totalItems, actionBreakdown, resourceBreakdown, recentAuditLogs] = await Promise.all([
      repository.countAuditLogs(filter),
      repository.aggregateByAction(filter),
      repository.aggregateByResourceType(filter),
      repository.findAuditLogs({ filter, skip: 0, limit: 10 })
    ])

    return {
      totalItems,
      actionBreakdown,
      resourceBreakdown,
      recentAuditLogs: recentAuditLogs.map(normalizeAuditLog)
    }
  }

  return {
    listAuditLogs,
    getAuditLogSummary
  }
}

export const AUDIT_LOG_SERVICE = createAuditLogService()
