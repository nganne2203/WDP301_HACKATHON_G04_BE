import { env } from '#configs/environment.js'
import { LOGGER } from '#utils/logger.js'

export const createN8nService = ({
  getConfig = () => env.n8n,
  fetchImpl
} = {}) => {
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

    const response = await activeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`n8n webhook returned status ${response.status}: ${text}`)
    }

    return response.status
  }

  return {
    async triggerPerPushAudit({ evidence, aiReviewId, callbackUrl }) {
      const config = getConfig()
      return await triggerN8nWebhook(config.perPushWebhookUrl, {
        reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
        aiReviewId,
        callbackUrl,
        evidence
      })
    },

    async triggerTeamAggregateAudit({ evidence, aiReviewId, callbackUrl }) {
      const config = getConfig()
      return await triggerN8nWebhook(config.teamAggregateWebhookUrl, {
        reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
        aiReviewId,
        callbackUrl,
        evidence
      })
    }
  }
}

export const N8N_SERVICE = createN8nService()
