import { StatusCodes } from 'http-status-codes'

import { AUDIT_LOG_SERVICE } from './audit-log.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listAuditLogs = async (req, res, next) => {
  try {
    const { auditLogs, pagination } = await AUDIT_LOG_SERVICE.listAuditLogs(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get audit logs successfully',
      data: auditLogs,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getAuditLogSummary = async (req, res, next) => {
  try {
    const summary = await AUDIT_LOG_SERVICE.getAuditLogSummary(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get audit log summary successfully',
      data: summary
    }))
  } catch (error) {
    next(error)
  }
}

export const AUDIT_LOG_CONTROLLER = {
  listAuditLogs,
  getAuditLogSummary
}
