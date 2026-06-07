import IORedis from 'ioredis'
import { Queue } from 'bullmq'

import { env } from '#configs/environment.js'
import { JOB_TYPES, QUEUE_NAMES } from '#constants/queue.js'

let redisConnection
let githubPushQueue

const getRedisConnection = () => {
  if (!redisConnection) {
    redisConnection = new IORedis(env.redis.url, {
      maxRetriesPerRequest: null
    })
  }

  return redisConnection
}

const getGithubPushQueue = () => {
  if (!githubPushQueue) {
    githubPushQueue = new Queue(QUEUE_NAMES.GITHUB_PUSH_EVENTS, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3
      }
    })
  }

  return githubPushQueue
}

export const QUEUE_SERVICE = {
  async enqueueGithubPushEvent(data) {
    return await getGithubPushQueue().add(JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT, data, {
      jobId: data.deliveryId
    })
  }
}
