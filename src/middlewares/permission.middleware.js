import { ERROR_CODES } from '#constants/errorCode.js'
import ApiError from '#utils/ApiError.js'

const normalizePermissions = (user = {}) => {
  const directPermissions = user.effectivePermissions || user.permissions || []
  const activeRoles = (user.roles || []).filter(role => {
    if (typeof role === 'string') return true
    return role.isActive !== false
  })
  const rolePermissions = activeRoles.flatMap(role => role.permissions || [])

  return [...directPermissions, ...rolePermissions]
    .map(permission => {
      if (typeof permission === 'string') return permission
      if (permission.isActive === false) return null
      return permission.code
    })
    .filter(Boolean)
}

export const permissionMiddleware = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const user = req.user
      if (!user) {
        throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Bạn cần đăng nhập để thực hiện hành động này'])
      }

      const userPermissions = new Set(normalizePermissions(user))
      const hasPermission = requiredPermissions.every(permission => userPermissions.has(permission))

      if (!hasPermission) {
        throw new ApiError(ERROR_CODES.FORBIDDEN, ['Bạn không có quyền thực hiện hành động này'])
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
