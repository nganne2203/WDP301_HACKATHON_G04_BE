import { StatusCodes } from 'http-status-codes'

import { GITHUB_WEBHOOK_SERVICE } from './github-webhook.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

export const createGithubWebhookController = ({
  service = GITHUB_WEBHOOK_SERVICE
} = {}) => {
  const receiveWebhook = async (req, res, next) => {
    try {
      const result = await service.handleWebhook({
        rawBody: req.body,
        deliveryId: req.get('X-GitHub-Delivery'),
        eventType: req.get('X-GitHub-Event'),
        signature: req.get('X-Hub-Signature-256')
      })

      res.status(StatusCodes.OK).json(responseSuccess({
        message: 'GitHub webhook received successfully',
        data: result
      }))
    } catch (error) {
      next(error)
    }
  }

  return {
    receiveWebhook
  }
}

export const GITHUB_WEBHOOK_CONTROLLER = createGithubWebhookController()
