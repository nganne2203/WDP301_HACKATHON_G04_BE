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
import auditLogMiddleware from '#middlewares/auditLogMiddleware.js'
import apiRoutes from '#routes/index.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'

export const rootHealthHandler = (req, res) => {
  res.status(200).json({
    success: true,
    service: 'backend',
    status: 'running'
  })
}

export const processHealthHandler = (req, res) => {
  res.status(200).json({
    success: true,
    uptime: process.uptime()
  })
}

const checkMongoTransactionReadiness = async () => {
  if (mongoose.connection.readyState !== 1) {
    return { ready: false, status: 'not_ready', error: 'MongoDB is not connected' }
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 })
    const transactionReady = Boolean(hello.setName || hello.msg === 'isdbgrid')
    return {
      ready: transactionReady,
      status: transactionReady ? 'ready' : 'not_ready',
      ...(transactionReady ? {} : { error: 'MongoDB transactions require a replica set or mongos' })
    }
  } catch (error) {
    return { ready: false, status: 'not_ready', error: error.message }
  }
}

export const createApp = () => {
  const app = express()
  const jsonParser = express.json({ limit: '2mb' })
  const urlencodedParser = express.urlencoded({ extended: true })

  app.use((req, res, next) => {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
    next()
  })

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

  app.get('/', rootHealthHandler)
  app.get('/health', processHealthHandler)

  app.use(apiRateLimiter)
  app.use(auditLogMiddleware)

  app.get('/ready', async (req, res) => {
    const dbReady = mongoose.connection.readyState === 1
    let redisReady = true
    let redisError = null
    let transactionReady = true
    let transactionError = null

    if (env.server.readinessRequiresRedis) {
      try {
        redisReady = (await QUEUE_SERVICE.ping()) === 'PONG'
      } catch (error) {
        redisReady = false
        redisError = error.message
      }
    }

    if (env.server.readinessRequiresTransactions) {
      const transactionCheck = await checkMongoTransactionReadiness()
      transactionReady = transactionCheck.ready
      transactionError = transactionCheck.error || null
    }

    const ready = dbReady && redisReady && transactionReady
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      checks: {
        mongodb: dbReady ? 'ready' : 'not_ready',
        redis: redisReady ? 'ready' : 'not_ready',
        transactions: transactionReady ? 'ready' : 'not_ready'
      },
      ...(redisError ? { redisError } : {}),
      ...(transactionError ? { transactionError } : {})
    })
  })

  app.use('/api', apiRoutes)
  app.use('/api-docs', swaggerHandlingMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  app.use(errorHandlingMiddleware)

  return app
}
