import { StatusCodes } from 'http-status-codes'

export const ERROR_CODES = {
  NOT_FOUND: {
    code: 'NOT_FOUND',
    statusCode: StatusCodes.NOT_FOUND,
    message: 'Yêu cầu không tồn tại.'
  },

  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    statusCode: StatusCodes.UNAUTHORIZED,
    message: 'Bạn không có quyền truy cập tài nguyên này.'
  },

  FORBIDDEN: {
    code: 'FORBIDDEN',
    statusCode: StatusCodes.FORBIDDEN,
    message: 'Bạn không có quyền truy cập tài nguyên này.'
  },

  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Yêu cầu không hợp lệ hoặc không thể phục vụ.'
  },

  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Đã xảy ra lỗi không mong muốn trên máy chủ.'
  },

  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Có lỗi xác thực trong yêu cầu.'
  },

  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: StatusCodes.TOO_MANY_REQUESTS,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.'
  },

  INVALID_REQUEST_DATA: {
    code: 'INVALID_REQUEST_DATA',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Dữ liệu yêu cầu không hợp lệ.'
  },

  ACCOUNT_DISABLED: {
    code: 'ACCOUNT_DISABLED',
    statusCode: StatusCodes.FORBIDDEN,
    message: 'Tài khoản đã bị vô hiệu hóa.'
  },

  EMAIL_NOT_VERIFIED: {
    code: 'EMAIL_NOT_VERIFIED',
    statusCode: StatusCodes.FORBIDDEN,
    message: 'Email chưa được xác minh.'
  },

  EMAIL_ALREADY_VERIFIED: {
    code: 'EMAIL_ALREADY_VERIFIED',
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Email đã được xác minh.'
  },

  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Đã xảy ra lỗi không mong muốn trên máy chủ.'
  },

  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    statusCode: StatusCodes.UNAUTHORIZED,
    message: 'Token đã hết hạn.'
  },

  CONFLICT: {
    code: 'CONFLICT',
    statusCode: StatusCodes.CONFLICT,
    message: 'Xung đột dữ liệu.'
  }
}