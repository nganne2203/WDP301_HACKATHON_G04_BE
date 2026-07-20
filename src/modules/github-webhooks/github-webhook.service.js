import crypto from 'node:crypto'

import { GITHUB_WEBHOOK_REPOSITORY } from './github-webhook.repository.js'
import { env } from '#configs/environment.js'
import { JOB_TYPES } from '#constants/queue.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { QUEUE_SERVICE } from '#services/queue.service.js'
import ApiError from '#utils/ApiError.js'

const parseWebhookPayload = (rawBody) => {
  try {
    return JSON.parse(rawBody.toString('utf8'))
  } catch {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid GitHub webhook JSON payload'])
  }
}

const parseBranch = (ref) => {
  if (!ref) return null
  return ref.replace(/^refs\/heads\//, '')
}

// GitHub sends '0000000000000000000000000000000000000000' as the `before` SHA
// when a branch is pushed for the first time (no previous commit to compare against).
// This SHA is invalid for the Compare API and causes a 404.
const ZERO_SHA = '0000000000000000000000000000000000000000'
const sanitizeSha = (sha) => (sha && sha !== ZERO_SHA ? sha : null)

const buildSignature = ({ secret, rawBody }) => {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
}

const compareSignatures = ({ expectedSignature, providedSignature }) => {
  if (!providedSignature || typeof providedSignature !== 'string') return false

  const expectedBuffer = Buffer.from(expectedSignature)
  const providedBuffer = Buffer.from(providedSignature)

  if (expectedBuffer.length !== providedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

export const createGithubWebhookService = ({
  repository = GITHUB_WEBHOOK_REPOSITORY,
  queueService = QUEUE_SERVICE,
  webhookSecret = env.github.webhookSecret
} = {}) => {
  const persistDelivery = async (payload) => {
    try {
      return await repository.createDelivery(payload)
    } catch (error) {
      if (error?.code === 11000) {
        return await repository.findDeliveryById(payload.deliveryId)
      }

      throw error
    }
  }

  const handleWebhook = async ({
    rawBody,
    deliveryId,
    eventType,
    signature
  }) => {
    if (!Buffer.isBuffer(rawBody)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub webhook raw body is required'])
    }

    if (!deliveryId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Missing X-GitHub-Delivery header'])
    }

    if (!eventType) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Missing X-GitHub-Event header'])
    }

    const existingDelivery = await repository.findDeliveryById(deliveryId)
    if (existingDelivery) {
      return {
        deliveryId,
        status: existingDelivery.status,
        duplicate: true,
        eventType: existingDelivery.eventType,
        enqueued: existingDelivery.status === 'QUEUED'
      }
    }

    if (!webhookSecret) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['GitHub webhook secret is not configured'])
    }

    const payload = parseWebhookPayload(rawBody)
    const expectedSignature = buildSignature({ secret: webhookSecret, rawBody })
    const signatureValid = compareSignatures({
      expectedSignature,
      providedSignature: signature
    })

    const repositoryFullName = payload.repository?.full_name || null
    const linkedRepository = repositoryFullName
      ? await repository.findRepositoryByFullName(repositoryFullName)
      : null

    const baseDeliveryPayload = {
      deliveryId,
      eventType,
      repositoryFullName,
      repositoryId: linkedRepository?._id,
      teamId: linkedRepository?.teamId,
      branch: parseBranch(payload.ref),
      beforeCommitSha: sanitizeSha(payload.before),
      afterCommitSha: payload.after || null,
      payload,
      signatureValid,
      receivedAt: new Date()
    }

    if (!signatureValid) {
      await persistDelivery({
        ...baseDeliveryPayload,
        status: 'REJECTED',
        errorMessage: 'Invalid GitHub webhook signature'
      })

      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Invalid GitHub webhook signature'])
    }

    if (eventType !== 'push') {
      await persistDelivery({
        ...baseDeliveryPayload,
        status: 'IGNORED'
      })

      return {
        deliveryId,
        status: 'IGNORED',
        duplicate: false,
        eventType,
        enqueued: false
      }
    }

    const delivery = await persistDelivery({
      ...baseDeliveryPayload,
      status: 'RECEIVED'
    })

    const jobData = {
      jobType: JOB_TYPES.PROCESS_GITHUB_PUSH_EVENT,
      deliveryCompetitionId: delivery._id?.toString?.() || delivery.id,
      deliveryId,
      eventType,
      repositoryId: linkedRepository?._id?.toString?.() || null,
      repositoryFullName,
      competitionId: linkedRepository?.competitionId?.toString?.() || null,
      teamId: linkedRepository?.teamId?.toString?.() || null,
      roundId: linkedRepository?.roundId?.toString?.() || null,
      branch: parseBranch(payload.ref),
      beforeCommitSha: sanitizeSha(payload.before),
      afterCommitSha: payload.after || null,
      receivedAt: delivery.receivedAt
    }

    await queueService.enqueueGithubPushCompetition(jobData)

    await repository.updateDeliveryById(delivery._id, {
      status: 'QUEUED'
    })

    if (linkedRepository && payload.after) {
      await repository.updateRepositoryById(linkedRepository._id, {
        latestCommitSha: payload.after
      })
    }

    return {
      deliveryId,
      status: 'QUEUED',
      duplicate: false,
      eventType,
      enqueued: true
    }
  }

  return {
    handleWebhook,
    buildSignature
  }
}

export const GITHUB_WEBHOOK_SERVICE = createGithubWebhookService()
