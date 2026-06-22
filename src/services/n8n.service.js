import { env } from '#configs/environment.js'
import { GITHUB_SERVICE } from '#modules/github/github.service.js'
import { ENCRYPTION_UTILS } from '#utils/encryption.util.js'
import { LOGGER } from '#utils/logger.js'

export const createN8nService = ({
  getConfig = () => env.n8n,
  fetchImpl,
  githubTokenProvider = GITHUB_SERVICE.getTokenForN8nDispatch,
  encryption = ENCRYPTION_UTILS
} = {}) => {
  const buildDispatchPayload = async ({ reviewKind, aiReviewId, callbackUrl, reviewContext, eventId }) => {
    const githubToken = await githubTokenProvider({ eventId, reviewKind, reviewContext })
    const encryptedGithubToken = encryption.encryptGithubTokenForN8n(githubToken)

    return {
      aiReviewId,
      callbackUrl,
      reviewKind,
      encryptedGithubToken,
      context: reviewContext
    }
  }

  const triggerN8nWebhook = async (url, payload) => {
    const config = getConfig()
    const activeFetch = fetchImpl || globalThis.fetch
    if (!config?.enabled) {
      throw new Error('n8n integration is disabled')
    }
    if (!url) {
      throw new Error('n8n webhook URL is not configured')
    }

    LOGGER.info('Triggering n8n audit webhook', { url, aiReviewId: payload.aiReviewId })

    const controller = new AbortController()
    const timeoutMs = Number(config.dispatchTimeoutMs || 15000)
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let response
    try {
      response = await activeFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`n8n webhook request timed out after ${timeoutMs}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`n8n webhook returned status ${response.status}: ${text}`)
    }

    return response.status
  }

  return {
    async triggerPerPushAudit({ reviewContext, aiReviewId, callbackUrl, eventId }) {
      const config = getConfig()
      const payload = await buildDispatchPayload({
        reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
        aiReviewId,
        callbackUrl,
        reviewContext,
        eventId
      })
      return await triggerN8nWebhook(config.perPushWebhookUrl, payload)
    },

    async triggerTeamAggregateAudit({ reviewContext, aiReviewId, callbackUrl, eventId }) {
      const config = getConfig()
      const payload = await buildDispatchPayload({
        reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
        aiReviewId,
        callbackUrl,
        reviewContext,
        eventId
      })
      return await triggerN8nWebhook(config.aggregateWebhookUrl || config.teamAggregateWebhookUrl, payload)
    }
  }
}

export const N8N_SERVICE = createN8nService()
