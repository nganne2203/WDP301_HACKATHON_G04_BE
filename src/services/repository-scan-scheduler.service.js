import { QUEUE_SERVICE } from '#services/queue.service.js'
import { LOGGER } from '#utils/logger.js'

export const createRepositoryScanScheduler = ({
  queueService = QUEUE_SERVICE,
  logger = LOGGER,
  intervalMs,
  runOnStart = false
} = {}) => {
  let timer = null
  let running = false

  const runScan = async () => {
    if (running) {
      logger.warn('Skipping repository scan tick because the previous tick is still running')
      return
    }

    running = true
    try {
      await queueService.enqueueHourlyRepositoryScan({})
      logger.info('Queued hourly repository scan job')
    } catch (error) {
      logger.error('Failed to queue hourly repository scan job', {
        error: error.message
      })
    } finally {
      running = false
    }
  }

  const start = () => {
    if (timer) return

    timer = setInterval(() => {
      void runScan()
    }, intervalMs)

    if (typeof timer.unref === 'function') timer.unref()

    if (runOnStart) {
      void runScan()
    }
  }

  const stop = () => {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  return {
    start,
    stop,
    runScan
  }
}
