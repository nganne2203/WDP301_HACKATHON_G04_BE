import mongoose from 'mongoose'
import crypto from 'node:crypto'

import { AUDIT_LOG_REPOSITORY } from './audit-log.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { AUDIT_RESULTS } from '#constants/audit.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import sanitize, { normalizeSearchTerm } from '#utils/sanitizeUtil.js'

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const getAuditUserId = (user) => {
  return user?._id?.toString?.() || user?.id?.toString?.() || user?.toString?.() || user || null
}

const normalizeAuditUser = (user) => {
  if (!user || typeof user !== 'object' || !user._id) return null

  return {
    id: user._id.toString(),
    fullName: user.fullName || null,
    email: user.email || null,
    status: user.status || null
  }
}

const normalizeRoleValue = (value) => {
  if (Array.isArray(value)) return value.map(normalizeRoleValue).filter(Boolean).join(',')
  if (!value) return null
  if (typeof value === 'string') return value
  return value.name || value.code || value._id?.toString?.() || value.id || null
}

const normalizeAuditLog = (auditLog) => {
  if (!auditLog) return null
  const plain = typeof auditLog.toObject === 'function'
    ? auditLog.toObject({ getters: true, virtuals: false })
    : auditLog

  return {
    id: plain._id?.toString() || plain.id,
    auditId: plain.auditId || plain._id?.toString() || plain.id,
    userId: getAuditUserId(plain.userId),
    user: normalizeAuditUser(plain.userId),
    username: plain.username || plain.userId?.fullName || plain.userId?.email || null,
    userRole: plain.userRole || null,
    action: plain.action,
    entityType: plain.entityType || plain.resourceType || null,
    entityId: plain.entityId?._id?.toString?.() || plain.entityId?.toString?.() || plain.entityId || plain.resourceId?._id?.toString?.() || plain.resourceId?.toString?.() || plain.resourceId || null,
    resourceType: plain.resourceType || null,
    resourceId: plain.resourceId?._id?.toString?.() || plain.resourceId?.toString?.() || plain.resourceId || null,
    oldValue: plain.oldValue || null,
    newValue: plain.newValue || null,
    description: plain.description || null,
    ipAddress: plain.ipAddress || null,
    userAgent: plain.userAgent || null,
    requestId: plain.requestId || null,
    sessionId: plain.sessionId || null,
    result: plain.result || AUDIT_RESULTS.SUCCESS,
    errorMessage: plain.errorMessage || null,
    sourceModule: plain.sourceModule || null,
    metadata: plain.metadata || {},
    createdAt: plain.createdAt
  }
}

const escapeRegex = (value) => normalizeSearchTerm(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildAuditFilter = (query = {}) => {
  const filter = {}
  const andFilters = []
  if (query.userId) {
    ensureObjectId(query.userId, 'user id')
    filter.userId = query.userId
  }
  if (query.action) filter.action = { $regex: escapeRegex(query.action), $options: 'i' }
  if (query.username) filter.username = { $regex: escapeRegex(query.username), $options: 'i' }
  if (query.userRole) filter.userRole = { $regex: escapeRegex(query.userRole), $options: 'i' }
  if (query.result) filter.result = query.result
  if (query.sourceModule) filter.sourceModule = { $regex: escapeRegex(query.sourceModule), $options: 'i' }
  if (query.resourceType) {
    andFilters.push({
      $or: [
        { resourceType: { $regex: escapeRegex(query.resourceType), $options: 'i' } },
        { entityType: { $regex: escapeRegex(query.resourceType), $options: 'i' } }
      ]
    })
  }
  if (query.resourceId) {
    andFilters.push({
      $or: [
        { resourceId: query.resourceId },
        { entityId: query.resourceId }
      ]
    })
  }
  if (query.search) {
    const regex = { $regex: escapeRegex(query.search), $options: 'i' }
    andFilters.push({
      $or: [
        { action: regex },
        { resourceType: regex },
        { entityType: regex },
        { username: regex },
        { description: regex },
        { requestId: regex }
      ]
    })
  }
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) filter.createdAt.$gte = new Date(query.from)
    if (query.to) filter.createdAt.$lte = new Date(query.to)
  }
  if (andFilters.length) filter.$and = andFilters
  return filter
}

const buildActorSnapshot = ({ userId, username, userRole, actor } = {}) => {
  const actorId = userId || actor?._id?.toString?.() || actor?.id?.toString?.() || null
  return {
    userId: actorId,
    username: username || actor?.fullName || actor?.email || null,
    userRole: userRole || normalizeRoleValue(actor?.roles || actor?.role) || null
  }
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
    const [totalItems, actionBreakdown, resourceBreakdown, resultBreakdown, roleBreakdown, recentAuditLogs] = await Promise.all([
      repository.countAuditLogs(filter),
      repository.aggregateByAction(filter),
      repository.aggregateByResourceType(filter),
      repository.aggregateByResult ? repository.aggregateByResult(filter) : [],
      repository.aggregateByUserRole ? repository.aggregateByUserRole(filter) : [],
      repository.findAuditLogs({ filter, skip: 0, limit: 10 })
    ])

    return {
      totalItems,
      actionBreakdown,
      resourceBreakdown,
      resultBreakdown,
      roleBreakdown,
      recentAuditLogs: recentAuditLogs.map(normalizeAuditLog)
    }
  }

  const createAuditLog = async ({
    userId,
    username,
    userRole,
    actor,
    action,
    resourceType,
    resourceId,
    entityType,
    entityId,
    oldValue = null,
    newValue = null,
    description = null,
    ipAddress = null,
    userAgent = null,
    requestId = null,
    sessionId = null,
    result = AUDIT_RESULTS.SUCCESS,
    errorMessage = null,
    sourceModule = null,
    metadata = {}
  } = {}) => {
    const actorSnapshot = buildActorSnapshot({ userId, username, userRole, actor })
    const created = await repository.create({
      auditId: crypto.randomUUID(),
      userId: actorSnapshot.userId || null,
      username: actorSnapshot.username,
      userRole: actorSnapshot.userRole,
      action,
      entityType: entityType || resourceType || null,
      entityId: entityId || resourceId || null,
      resourceType: resourceType || entityType || null,
      resourceId: resourceId || entityId || null,
      oldValue: sanitize(oldValue ?? metadata?.before ?? null),
      newValue: sanitize(newValue ?? metadata?.after ?? metadata?.changes ?? null),
      description,
      ipAddress,
      userAgent,
      requestId,
      sessionId,
      result,
      errorMessage,
      sourceModule,
      metadata: sanitize(metadata)
    })
    return normalizeAuditLog(created)
  }

  return {
    listAuditLogs,
    getAuditLogSummary,
    createAuditLog
  }
}

export const AUDIT_LOG_SERVICE = createAuditLogService()
