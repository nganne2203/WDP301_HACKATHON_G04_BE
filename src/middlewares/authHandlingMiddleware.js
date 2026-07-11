import { JWT_UTILS } from '#utils/jwtUtil.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { USER_SERVICE } from '#modules/users/user.service.js'
import { canAccessAuthenticatedRoutes } from '#utils/userAccountUtil.js'

export const authorizationMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication token was not provided'])
    }

    const token = authHeader.split(' ')[1]
    const decoded = JWT_UTILS.verifyAccessToken(token)

    const user = await USER_SERVICE.getRawUserById(decoded.id)

    if (!canAccessAuthenticatedRoutes(user)) {
      throw new ApiError(ERROR_CODES.ACCOUNT_DISABLED, [`Account status is ${user.status}`])
    }

    const roles = USER_SERVICE.getRoleNames(user)
    const effectivePermissions = USER_SERVICE.getPermissionCodes(user)

    req.user = {
      id: user._id.toString(),
      email: user.email,
      roles,
      role: roles[0] || null,
      permissions: effectivePermissions,
      effectivePermissions
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
