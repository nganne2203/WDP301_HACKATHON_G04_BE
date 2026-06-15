import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const AUDIT_LOG_VALIDATION = {
  listAuditLogs: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      userId: objectId,
      action: Joi.string().trim().max(100),
      username: Joi.string().trim().max(200),
      userRole: Joi.string().trim().max(100),
      resourceType: Joi.string().trim().max(100),
      resourceId: Joi.string().trim().max(100),
      result: Joi.string().valid('SUCCESS', 'FAILURE'),
      sourceModule: Joi.string().trim().max(100),
      search: Joi.string().trim().max(200),
      from: Joi.date().iso(),
      to: Joi.date().iso()
    })
  },
  getAuditLogSummary: {
    query: Joi.object({
      userId: objectId,
      action: Joi.string().trim().max(100),
      username: Joi.string().trim().max(200),
      userRole: Joi.string().trim().max(100),
      resourceType: Joi.string().trim().max(100),
      resourceId: Joi.string().trim().max(100),
      result: Joi.string().valid('SUCCESS', 'FAILURE'),
      sourceModule: Joi.string().trim().max(100),
      search: Joi.string().trim().max(200),
      from: Joi.date().iso(),
      to: Joi.date().iso()
    })
  }
}
