import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { LOGGER } from '#utils/logger.js'

const duplicateRecordError = () => ({
  statusCode: ERROR_CODES.CONFLICT.statusCode,
  code: ERROR_CODES.CONFLICT.code,
  message: ERROR_CODES.CONFLICT.message,
  errors: ['A record with the same information already exists. Please use a different value.']
})

const validationError = () => ({
  statusCode: ERROR_CODES.VALIDATION_ERROR.statusCode,
  code: ERROR_CODES.VALIDATION_ERROR.code,
  message: ERROR_CODES.VALIDATION_ERROR.message,
  errors: ['Please review the information entered and try again.']
})

const redactErrorDetails = (value) => String(value || '')
  .replace(/:\/\/[^\s/@:]+(?::[^\s/@]+)?@/g, '://***@')
  .replace(/\b(token|secret|password)=([^\s&]+)/gi, '$1=***')

const toPublicError = (error) => {
  if (error?.message === 'Not allowed by CORS') {
    return {
      statusCode: ERROR_CODES.FORBIDDEN.statusCode,
      code: ERROR_CODES.FORBIDDEN.code,
      message: ERROR_CODES.FORBIDDEN.message,
      errors: ['This application origin is not allowed to access the service.']
    }
  }

  if (error instanceof ApiError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message, errors: error.errors }
  }

  if (error?.code === 11000 || error?.name === 'MongoServerError' && /duplicate key/i.test(error?.message || '')) {
    return duplicateRecordError()
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return validationError()

  return {
    statusCode: ERROR_CODES.INTERNAL_SERVER_ERROR.statusCode,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
    message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
    errors: ['We could not complete your request. Please try again later.']
  }
}

// eslint-disable-next-line no-unused-vars
export const errorHandlingMiddleware = (err, req, res, next) => {
  const responseError = toPublicError(err)

  if (!(err instanceof ApiError) || responseError.statusCode >= 500) {
    LOGGER.error('Request failed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: responseError.statusCode,
      errorName: err?.name,
      errorCode: err?.code,
      errorMessage: redactErrorDetails(err?.message),
      stack: redactErrorDetails(err?.stack)
    })
  }

  res.status(responseError.statusCode).json({
    success: false,
    code: responseError.code,
    message: responseError.message,
    errors: responseError.errors
  })
}
