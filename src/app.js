import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import swaggerUi from 'swagger-ui-express'

import { corsOptions } from '#configs/cors.js'
import { env } from '#configs/environment.js'
import { swaggerSpec } from '#configs/swagger.js'
import { swaggerHandlingMiddleware } from '#middlewares/swaggerHandlingMiddleware.js'
import { errorHandlingMiddleware } from '#middlewares/errorHandlingMiddleware.js'
import { apiRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'
import apiRoutes from '#routes/index.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'

export const createApp = () => {
  const app = express()
  const jsonParser = express.json({ limit: '2mb' })
  const urlencodedParser = express.urlencoded({ extended: true })

  app.use(cors(corsOptions))
  app.use(helmet())
  app.use('/api/github/webhooks', express.raw({ type: 'application/json', limit: '2mb' }))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/github/webhooks')) return next()
    return jsonParser(req, res, next)
  })
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/github/webhooks')) return next()
    return urlencodedParser(req, res, next)
  })
  app.use(morgan('dev'))
  app.use(apiRateLimiter)

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  app.get('/ready', async (req, res) => {
    const dbReady = mongoose.connection.readyState === 1
    let redisReady = true
    let redisError = null

    if (env.server.readinessRequiresRedis) {
      try {
        redisReady = (await QUEUE_SERVICE.ping()) === 'PONG'
      } catch (error) {
        redisReady = false
        redisError = error.message
      }
    }

    const ready = dbReady && redisReady
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      checks: {
        mongodb: dbReady ? 'ready' : 'not_ready',
        redis: redisReady ? 'ready' : 'not_ready'
      },
      ...(redisError ? { redisError } : {})
    })
  })

  app.use('/api', apiRoutes)
  app.use('/api-docs', swaggerHandlingMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  app.use(errorHandlingMiddleware)

  return app
}
