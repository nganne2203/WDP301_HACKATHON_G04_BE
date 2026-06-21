import { env } from '#configs/environment.js'

const MIN_SECRET_LENGTH = 16

const isBase64Encoded32ByteKey = (value) => {
  if (!value) return false

  try {
    return Buffer.from(String(value), 'base64').length === 32
  } catch {
    return false
  }
}

export const validateRuntimeEnvironment = ({
  runtime = 'api',
  config = env,
  strict = true
} = {}) => {
  const errors = []
  const warnings = []

  if (!config.db?.uri) errors.push('MONGODB_URI is required')
  if (!config.jwt?.secret) errors.push('JWT_SECRET is required')
  if (!config.jwt?.refreshTokenSecret) errors.push('REFRESH_TOKEN_SECRET is required')
  if (!config.security?.tokenEncryptionSecret) {
    errors.push('GITHUB_TOKEN_DECRYPTION_KEY is required')
  } else if (String(config.security.tokenEncryptionSecret).length < MIN_SECRET_LENGTH) {
    errors.push(`GITHUB_TOKEN_DECRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters`)
  }

  if (!config.redis?.url) {
    if (runtime === 'worker' || config.server?.readinessRequiresRedis) {
      errors.push('REDIS_URL is required for queue-backed runtime')
    } else {
      warnings.push('REDIS_URL is not configured; queue-backed features will be degraded')
    }
  }

  if (config.github?.webhookCallbackUrl && !config.github?.webhookSecret) {
    errors.push('GITHUB_WEBHOOK_SECRET is required when GITHUB_WEBHOOK_CALLBACK_URL is configured')
  }

  if (config.n8n?.enabled) {
    if (!config.n8n.perPushWebhookUrl) {
      errors.push('N8N_PER_PUSH_WEBHOOK_URL is required when N8N_ENABLED=true')
    }
    if (!config.n8n.aggregateWebhookUrl && !config.n8n.teamAggregateWebhookUrl) {
      errors.push('N8N_AGGREGATE_WEBHOOK_URL is required when N8N_ENABLED=true')
    }
    if (!config.n8n.callbackSecret) {
      errors.push('N8N_CALLBACK_SECRET is required when N8N_ENABLED=true')
    }
    if (!isBase64Encoded32ByteKey(config.security?.githubTokenAesKey || config.security?.tokenEncryptionSecret)) {
      errors.push('GITHUB_TOKEN_AES_KEY must be a base64 encoded 32-byte key when N8N_ENABLED=true')
    }
  }

  if (!config.server?.publicUrl) {
    warnings.push('APP_BASE_URL or SERVER_PUBLIC_URL is not configured; webhook callback auto-build may be unavailable')
  }

  if (strict && errors.length > 0) {
    throw new Error(`Environment validation failed for ${runtime}: ${errors.join('; ')}`)
  }

  return { errors, warnings }
}
