import { env } from '#configs/environment.js'
import { ERROR_CODES } from '#constants/errorCode.js'

// eslint-disable-next-line no-unused-vars
export const errorHandlingMiddleware = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(ERROR_CODES.FORBIDDEN.statusCode).json({
      success: false,
      code: ERROR_CODES.FORBIDDEN.code,
      message: ERROR_CODES.FORBIDDEN.message,
      errors: ['CORS policy does not allow access from the specified origin.']
    })
  }

  const statusCode = err.statusCode || ERROR_CODES.INTERNAL_SERVER_ERROR.statusCode
  const responseError = {
    success: false,
    code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR.code,
    message: err.message || ERROR_CODES.INTERNAL_SERVER_ERROR.message,
    errors: err.errors || []
  }

  if (env.NODE_ENV === 'dev') {
    responseError.stack = err.stack
    // eslint-disable-next-line no-console
    console.error(err)
  }

  res.status(statusCode).json(responseError)
}