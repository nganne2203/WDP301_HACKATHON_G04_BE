import { env } from '#configs/environment.js'

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const AUDIT_SYSTEM_PROMPT = [
  'You are a technical auditor for a hackathon backend.',
  'Return JSON only, without markdown fences or extra commentary.',
  'You must not suggest or imply official scores, rankings, winners, pass/fail decisions, or finalist decisions.',
  'Focus on technical risk, code evidence, test ideas, and judge-support commentary only.'
].join(' ')

const REPAIR_SYSTEM_PROMPT = [
  'You fix malformed JSON outputs for a technical auditor workflow.',
  'Return valid JSON only and preserve the original meaning when possible.',
  'Do not add scoring, ranking, winner, finalist, or pass/fail fields.'
].join(' ')

const shouldRetryStatus = (status) => status === 408 || status === 409 || status === 429 || status >= 500

const extractMessageText = (payload) => {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(part => part?.text || part?.content || '')
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

const withTimeout = async ({ timeoutMs, operation }) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs)

  try {
    return await operation(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

const buildAuditMessages = ({ reviewKind, promptInput }) => ([
  { role: 'system', content: AUDIT_SYSTEM_PROMPT },
  {
    role: 'user',
    content: [
      `Review kind: ${reviewKind}`,
      'Return a JSON object that satisfies the PHASE_8_AI_TECHNICAL_AUDITOR_V1 contract.',
      'Input evidence JSON:',
      JSON.stringify(promptInput, null, 2)
    ].join('\n\n')
  }
])

const buildRepairMessages = ({ rawResponse, reviewKind, schemaName }) => ([
  { role: 'system', content: REPAIR_SYSTEM_PROMPT },
  {
    role: 'user',
    content: [
      `Repair this malformed JSON for review kind ${reviewKind}.`,
      `Target schema: ${schemaName}.`,
      'Return valid JSON only.',
      'Malformed content:',
      String(rawResponse || '')
    ].join('\n\n')
  }
])

export const createAiRuntimeService = ({
  config = env.ai,
  fetchImpl = globalThis.fetch
} = {}) => {
  const ensureConfigured = () => {
    if (!config?.provider) throw new Error('AI runtime provider is not configured')
    if (!fetchImpl) throw new Error('Fetch runtime is not available for AI provider integration')
    if (config.provider !== 'openai') throw new Error(`Unsupported AI provider: ${config.provider}`)
    if (!config.apiKey) throw new Error('AI API key is not configured')
  }

  const requestChatCompletion = async ({ model, messages }) => {
    ensureConfigured()

    const maxRetries = Math.max(0, Number(config.maxRetries || 0))
    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await withTimeout({
          timeoutMs: config.timeoutMs,
          operation: async (signal) => {
            return await fetchImpl(`${String(config.baseUrl || '').replace(/\/$/, '')}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`
              },
              body: JSON.stringify({
                model,
                temperature: 0.1,
                response_format: { type: 'json_object' },
                messages
              }),
              signal
            })
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          const error = new Error(`AI provider request failed with status ${response.status}: ${errorText}`)
          error.status = response.status
          throw error
        }

        return await response.json()
      } catch (error) {
        lastError = error
        const status = error?.status
        const canRetry = attempt < maxRetries && (status === undefined || shouldRetryStatus(status))
        if (!canRetry) break
        await wait(500 * (attempt + 1))
      }
    }

    throw lastError || new Error('AI provider request failed')
  }

  const mapResponse = (payload, fallbackModel) => ({
    rawResponse: extractMessageText(payload),
    modelName: payload?.model || fallbackModel || config.model,
    provider: config.provider,
    tokenUsage: payload?.usage || null
  })

  return {
    async generateAudit({ reviewKind, promptInput }) {
      const payload = await requestChatCompletion({
        model: config.model,
        messages: buildAuditMessages({ reviewKind, promptInput })
      })

      return mapResponse(payload, config.model)
    },

    async repairJson({ rawResponse, schemaName, reviewKind }) {
      const payload = await requestChatCompletion({
        model: config.repairModel || config.model,
        messages: buildRepairMessages({ rawResponse, reviewKind, schemaName })
      })

      return extractMessageText(payload)
    }
  }
}

export const AI_RUNTIME_SERVICE = createAiRuntimeService()
