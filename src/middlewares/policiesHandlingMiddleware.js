import { ERROR_CODES } from '#constants/errorCode.js'
import ApiError from '#utils/ApiError.js'

export const requireRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = req.user
      if (!user) {
        throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Bạn cần đăng nhập để thực hiện hành động này'])
      }
      if (!allowedRoles.includes(user.role)) {
        throw new ApiError(ERROR_CODES.FORBIDDEN, ['Bạn không có quyền thực hiện hành động này'])
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}