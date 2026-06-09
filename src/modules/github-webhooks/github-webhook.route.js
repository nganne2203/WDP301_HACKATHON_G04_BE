import { Router } from 'express'

import { GITHUB_WEBHOOK_CONTROLLER, createGithubWebhookController } from './github-webhook.controller.js'
import { GITHUB_WEBHOOK_SERVICE } from './github-webhook.service.js'

export const createGithubWebhookRouter = ({
  controller = createGithubWebhookController({ service: GITHUB_WEBHOOK_SERVICE })
} = {}) => {
  const router = Router()

  router.post(
    '/',
    controller.receiveWebhook
  )

  return router
}

export default createGithubWebhookRouter({
  controller: GITHUB_WEBHOOK_CONTROLLER
})
