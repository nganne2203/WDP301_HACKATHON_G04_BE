import { env } from '#configs/environment.js'
import { validateRuntimeEnvironment } from '#configs/env-validation.js'
import { CLOSE_DB, CONNECT_DB } from '#configs/mongodb.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'
import { LOGGER } from '#utils/logger.js'
import { createGithubPushWorker } from '#workers/github-push.worker.js'

let worker = null

const startWorkerRuntime = async () => {
  const validation = validateRuntimeEnvironment({ runtime: 'worker' })
  for (const warning of validation.warnings) {
    LOGGER.warn('Environment validation warning', { runtime: 'worker', warning })
  }

  await CONNECT_DB()

  worker = createGithubPushWorker()
  worker.on('completed', (job) => {
    LOGGER.info('Queue job completed', {
      jobId: job.id,
      jobName: job.name
    })
  })
  worker.on('failed', (job, error) => {
    LOGGER.error('Queue job failed', {
      jobId: job?.id,
      jobName: job?.name,
      error: error.message
    })
  })

  LOGGER.info('Worker runtime started', {
    concurrency: env.worker.concurrency
  })
}

const shutdown = async () => {
  if (worker) {
    await worker.close()
    worker = null
  }

  await QUEUE_SERVICE.close()
  await CLOSE_DB()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

void startWorkerRuntime().catch((error) => {
  LOGGER.error('Worker runtime failed to start', {
    error: error.message
  })
  process.exit(1)
})
