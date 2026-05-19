import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'

import { env } from '#configs/environment.js'
import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import { corsOptions } from '#configs/cors.js'
import { swaggerSpec } from '#configs/swagger.js'
import { swaggerHandlingMiddleware } from '#middlewares/swaggerHandlingMiddleware.js'
import { errorHandlingMiddleware } from '#middlewares/errorHandlingMiddleware.js'
import { apiRateLimiter } from '#middlewares/rateLimitHandlingMiddleware.js'
import apiRoutes from '#routes/index.js'

const app = express()

app.use(cors(corsOptions))
app.use(helmet())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(apiRateLimiter)

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/api', apiRoutes)
app.use('/api-docs', swaggerHandlingMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use(errorHandlingMiddleware)

const PORT = env.server.port || 3000
const HOSTNAME = env.server.hostname || '0.0.0.0'

const startServer = async () => {
  await CONNECT_DB()
  app.listen(PORT, HOSTNAME, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running at http://${HOSTNAME}:${PORT}`)
  })
}

startServer()

const shutdown = async () => {
  await CLOSE_DB()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
