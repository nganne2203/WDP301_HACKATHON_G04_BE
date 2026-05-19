import { JWT_UTILS } from '#utils/jwtUtil.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { USER_SERVICE } from '#services/userService.js'

export const authorizationMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Không tìm thấy token xác thực'])

    const token = authHeader.split(' ')[1]
    const decoded = JWT_UTILS.verifyAccessToken(token)

    const user = await USER_SERVICE.getUserById(decoded.id)

    if (!user.isActive) throw new ApiError(ERROR_CODES.ACCOUNT_DISABLED, ['Tài khoản của bạn đã bị vô hiệu hóa'])

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      branch: user.branch ? user.branch.toString() : null
    }

    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new ApiError(ERROR_CODES.UNAUTHORIZED, [error.message]))
    } else if (error.name === 'TokenExpiredError') {
      next(new ApiError(ERROR_CODES.TOKEN_EXPIRED, [error.message]))
    } else {
      next(error)
    }
  }
}