import { ERROR_CODES } from '#constants/errorCode.js'
import ApiError from '#utils/ApiError.js'

export const requireRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = req.user
      if (!user) {
        throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Bạn cần đăng nhập để thực hiện hành động này'])
      }
      const userRoles = user.roles || (user.role ? [user.role] : [])
      const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role))

      if (!hasAllowedRole) {
        throw new ApiError(ERROR_CODES.FORBIDDEN, ['Bạn không có quyền thực hiện hành động này'])
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
