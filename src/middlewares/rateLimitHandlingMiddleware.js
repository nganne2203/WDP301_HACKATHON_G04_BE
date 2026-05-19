import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { env } from '#configs/environment.js'

const isDev = env.NODE_ENV === 'dev'

const rateLimitStore = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000)

export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
    keyGenerator = (req) => req.ip || req.connection.remoteAddress || 'unknown',
    skipFailedRequests = false,
    skipSuccessfulRequests = false
  } = options

  return (req, res, next) => {
    if (isDev) return next()

    try {
      const key = keyGenerator(req)
      const now = Date.now()

      let record = rateLimitStore.get(key)

      if (!record || record.resetTime < now) {
        record = {
          count: 0,
          resetTime: now + windowMs
        }
      }

      record.count++
      rateLimitStore.set(key, record)

      res.setHeader('X-RateLimit-Limit', max)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count))
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000))

      if (record.count > max) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000)
        res.setHeader('Retry-After', retryAfter)
        throw new ApiError(ERROR_CODES.RATE_LIMIT_EXCEEDED, [message])
      }

      if (skipFailedRequests || skipSuccessfulRequests) {
        res.on('finish', () => {
          const currentRecord = rateLimitStore.get(key)
          if (currentRecord) {
            if (skipFailedRequests && res.statusCode >= 400) {
              currentRecord.count = Math.max(0, currentRecord.count - 1)
            }
            if (skipSuccessfulRequests && res.statusCode < 400) {
              currentRecord.count = Math.max(0, currentRecord.count - 1)
            }
            rateLimitStore.set(key, currentRecord)
          }
        })
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút',
  keyGenerator: (req) => `auth:${req.ip || 'unknown'}`
})

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau'
})

export const readRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau'
})

export const sensitiveRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau một giờ',
  keyGenerator: (req) => `sensitive:${req.ip || 'unknown'}:${req.user?.userId || 'anon'}`
})

export const userRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
  keyGenerator: (req) => `user:${req.user?.userId || req.ip || 'unknown'}`
})

export const guestRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
  keyGenerator: (req) => `guest:${req.ip || 'unknown'}`
})

export const writeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau'
})
