import { StatusCodes } from 'http-status-codes'

export const ERROR_CODES = {
  NOT_FOUND: {
    code: 'NOT_FOUND',
    statusCode: StatusCodes.NOT_FOUND,
    message: 'The requested resource was not found.'
  },

  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    statusCode: StatusCodes.UNAUTHORIZED,
    message: 'Authentication is required to access this resource.'
  },

  FORBIDDEN: {
    code: 'FORBIDDEN',
    statusCode: StatusCodes.FORBIDDEN,
    message: 'You do not have permission to access this resource.'
  },

  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'The request is invalid or cannot be processed.'
  },

  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'An unexpected server error occurred.'
  },

  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'The request contains validation errors.'
  },

  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: StatusCodes.TOO_MANY_REQUESTS,
    message: 'Too many requests. Please try again later.'
  },

  INVALID_REQUEST_DATA: {
    code: 'INVALID_REQUEST_DATA',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'The request data is invalid.'
  },

  ACCOUNT_DISABLED: {
    code: 'ACCOUNT_DISABLED',
    statusCode: StatusCodes.FORBIDDEN,
    message: 'This account has been disabled.'
  },

  EMAIL_NOT_VERIFIED: {
    code: 'EMAIL_NOT_VERIFIED',
    statusCode: StatusCodes.FORBIDDEN,
    message: 'This email address has not been verified.'
  },

  EMAIL_ALREADY_VERIFIED: {
    code: 'EMAIL_ALREADY_VERIFIED',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'This email address has already been verified.'
  },

  GOOGLE_ACCOUNT_NOT_FOUND: {
    code: 'GOOGLE_ACCOUNT_NOT_FOUND',
    statusCode: StatusCodes.NOT_FOUND,
    message: 'No account exists for this Google email.'
  },

  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'An unexpected server error occurred.'
  },

  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    statusCode: StatusCodes.UNAUTHORIZED,
    message: 'The token has expired.'
  },

  INVALID_CHECK_IN_QR: {
    code: 'INVALID_CHECK_IN_QR',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'The check-in QR code is invalid.'
  },

  CHECK_IN_QR_EXPIRED: {
    code: 'CHECK_IN_QR_EXPIRED',
    statusCode: StatusCodes.GONE,
    message: 'The check-in QR code has expired.'
  },

  PARTICIPANT_ALREADY_CHECKED_IN: {
    code: 'PARTICIPANT_ALREADY_CHECKED_IN',
    statusCode: StatusCodes.CONFLICT,
    message: 'The participant has already checked in.'
  },

  CONFLICT: {
    code: 'CONFLICT',
    statusCode: StatusCodes.CONFLICT,
    message: 'A data conflict occurred.'
  }
}
