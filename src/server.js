import { env } from '#configs/environment.js'
import { validateRuntimeEnvironment } from '#configs/env-validation.js'
import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import { verifyGmailConnection } from '#configs/mail.js'
import { LOGGER } from '#utils/logger.js'
import { createApp } from './app.js'

const app = createApp()

const PORT = env.server.port || 3000
const HOSTNAME = env.server.hostname || '0.0.0.0'
let httpServer = null

const startServer = async () => {
  const validation = validateRuntimeEnvironment({ runtime: 'api' })
  for (const warning of validation.warnings) {
    LOGGER.warn('Environment validation warning', { runtime: 'api', warning })
  }

  await CONNECT_DB()
  httpServer = app.listen(PORT, HOSTNAME, () => {
    LOGGER.info('HTTP server started', {
      hostname: HOSTNAME,
      port: PORT
    })
  })

  await verifyGmailConnection()
}

startServer().catch((error) => {
  LOGGER.error('HTTP server failed to start', {
    error: error.message
  })
  process.exit(1)
})

const shutdown = async () => {
  if (httpServer) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) return reject(error)
        return resolve()
      })
    })
  }

  await CLOSE_DB()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
