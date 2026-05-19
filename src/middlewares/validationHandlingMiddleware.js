import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'

export const validationHandlingMiddleware = (schema) => {
  return async (req, res, next) => {
    try {
      const validationErrors = []

      req.validated = req.validated || {}

      if (schema.body) {
        const { error, value } = schema.body.validate(req.body, { abortEarly: false })
        if (error) {
          validationErrors.push(...error.details.map(detail => detail.message))
        } else {
          req.body = value
        }
      }

      if (schema.params) {
        const { error, value } = schema.params.validate(req.params, { abortEarly: false })
        if (error) {
          validationErrors.push(...error.details.map(detail => detail.message))
        } else {
          req.params = value
        }
      }

      if (schema.query) {
        const { error, value } = schema.query.validate(req.query, { abortEarly: false })
        if (error) {
          validationErrors.push(...error.details.map(detail => detail.message))
        } else {
          req.validated.query = value
        }
      }

      if (validationErrors.length > 0) {
        throw new ApiError(ERROR_CODES.VALIDATION_ERROR, validationErrors)
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
