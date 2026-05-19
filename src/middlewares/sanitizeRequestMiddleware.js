import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'

export const sanitizeRequest = (allowedFields = [], requiredFields = []) => {
  return (req, res, next) => {

    if (allowedFields.length === 0 && requiredFields.length === 0) {
      return next()
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(
        new ApiError(
          ERROR_CODES.INVALID_REQUEST_DATA,
          ['Dữ liệu không hợp lệ: body không hợp lệ']
        )
      )
    }

    const incomingFields = Object.keys(req.body)

    const invalidFields = incomingFields.filter(
      (field) => !allowedFields.includes(field)
    )

    if (invalidFields.length > 0) {
      return next(
        new ApiError(
          ERROR_CODES.INVALID_REQUEST_DATA,
          [`Dữ liệu không hợp lệ: ${invalidFields.join(', ')}`]
        )
      )
    }

    const missingFields = requiredFields.filter(
      (field) => !incomingFields.includes(field)
    )

    if (missingFields.length > 0) {
      return next(
        new ApiError(
          ERROR_CODES.INVALID_REQUEST_DATA,
          [`Thiếu trường bắt buộc: ${missingFields.join(', ')}`]
        )
      )
    }

    req.body = pickSafeFields(req.body, allowedFields)

    next()
  }
}