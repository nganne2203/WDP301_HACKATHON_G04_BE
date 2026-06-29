import { createServer } from 'node:http'

import { env } from '#configs/environment.js'
import { validateRuntimeEnvironment } from '#configs/env-validation.js'
import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import { verifyMailConnection } from '#configs/mail.js'
import { LOGGER } from '#utils/logger.js'
import { createApp } from './app.js'
import { createGithubPushWorker } from '#workers/github-push.worker.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'
import { initializeSocketServer } from '#services/socket/socket.js'

const app = createApp()

const PORT = env.server.port || 3000
const HOSTNAME = env.server.hostname || '0.0.0.0'
let httpServer = null
let gitWorker = null

const startServer = async () => {
  const validation = validateRuntimeEnvironment({ runtime: 'api' })
  for (const warning of validation.warnings) {
    LOGGER.warn('Environment validation warning', { runtime: 'api', warning })
  }

  await CONNECT_DB()
  await verifyMailConnection()

  // Start background worker in the same process if n8n is enabled
  if (env.n8n?.enabled) {
    try {
      gitWorker = createGithubPushWorker()
      gitWorker.on('completed', (job) => {
        LOGGER.info('Queue job completed', {
          jobId: job.id,
          jobName: job.name
        })
      })
      gitWorker.on('failed', (job, error) => {
        LOGGER.error('Queue job failed', {
          jobId: job?.id,
          jobName: job?.name,
          error: error.message
        })
      })
      LOGGER.info('Background Worker started inside Server process successfully', {
        concurrency: env.worker.concurrency
      })
    } catch (workerErr) {
      LOGGER.error('Failed to start Background Worker inside Server', {
        error: workerErr.message
      })
    }
  }

  httpServer = createServer(app)
  initializeSocketServer(httpServer, app)

  httpServer.listen(PORT, HOSTNAME, () => {
    LOGGER.info('HTTP server started', {
      hostname: HOSTNAME,
      port: PORT
    })
  })
}

startServer().catch((error) => {
  LOGGER.error('HTTP server failed to start', {
    error: error.message
  })
  process.exit(1)
})

const shutdown = async () => {
  if (gitWorker) {
    await gitWorker.close()
    await QUEUE_SERVICE.close()
  }

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
