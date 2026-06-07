import AuditLog from '#models/auditLog.model.js'

const create = async (data) => {
  return await AuditLog.create(data)
}

export const AUDIT_LOG_REPOSITORY = {
  create
}
