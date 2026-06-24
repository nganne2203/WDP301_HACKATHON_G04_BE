import 'dotenv/config'

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase())
}

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined

  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const nodeEnv = process.env.NODE_ENV
const clientUrls = process.env.CLIENT_URLS?.split(',').map(url => url.trim()).filter(Boolean) || []
const localFrontendUrl = ['prod', 'production'].includes(nodeEnv) ? undefined : 'http://localhost:5173'
const frontendUrl = process.env.FRONTEND_URL || clientUrls[0] || localFrontendUrl
const allowedClientUrls = clientUrls.length > 0 ? clientUrls : (frontendUrl ? [frontendUrl] : [])
const emailUser = process.env.EMAIL_USER
const emailPassword = process.env.EMAIL_PASSWORD

export const env = {
  EMAIL_USER: emailUser,
  EMAIL_PASSWORD: emailPassword,
  server: {
    port: process.env.PORT || 3000,
    hostname: process.env.HOSTNAME,
    nodeEnv,
    publicUrl: process.env.APP_BASE_URL || process.env.SERVER_PUBLIC_URL,
    readinessRequiresRedis: parseBoolean(process.env.READINESS_REQUIRES_REDIS, true)
  },
  db: {
    uri: process.env.MONGODB_URI
  },
  client: {
    urls: allowedClientUrls,
    frontendUrl
  },
  CLIENT_URLS: allowedClientUrls,
  swagger: {
    user: process.env.SWAGGER_USER,
    password: process.env.SWAGGER_PASSWORD
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
  },
  email: {
    user: emailUser,
    password: emailPassword,
    from: emailUser,
    devMode: process.env.EMAIL_DEV_MODE || (['dev', 'development', 'test'].includes(nodeEnv) ? 'console' : 'silent')
  },
  teamInvitation: {
    expiresHours: parseNumber(process.env.TEAM_INVITATION_EXPIRES_HOURS) || 72,
    temporaryPassword: process.env.TEAM_INVITATION_TEMP_PASSWORD || 'test'
  },
  checkInQr: {
    expiresMinutes: parseNumber(process.env.CHECK_IN_QR_EXPIRES_MINUTES) || 5
  },
  otp: {
    expiresIn: process.env.OTP_EXPIRES_IN
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    connectCallbackUrl: process.env.GOOGLE_CONNECT_CALLBACK_URL
  },
  n8n: {
    enabled: parseBoolean(process.env.N8N_ENABLED, false),
    perPushWebhookUrl: process.env.N8N_PER_PUSH_WEBHOOK_URL,
    aggregateWebhookUrl: process.env.N8N_AGGREGATE_WEBHOOK_URL || process.env.N8N_TEAM_AGGREGATE_WEBHOOK_URL,
    teamAggregateWebhookUrl: process.env.N8N_AGGREGATE_WEBHOOK_URL || process.env.N8N_TEAM_AGGREGATE_WEBHOOK_URL,
    callbackSecret: process.env.N8N_CALLBACK_SECRET,
    dispatchMaxRetries: parseNumber(process.env.N8N_DISPATCH_MAX_RETRIES) ?? 2,
    dispatchTimeoutMs: parseNumber(process.env.N8N_DISPATCH_TIMEOUT_MS) ?? 15000
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    webhookCallbackUrl: process.env.GITHUB_WEBHOOK_CALLBACK_URL,
    webhookEvents: process.env.GITHUB_WEBHOOK_EVENTS?.split(',').map(value => value.trim()).filter(Boolean) || ['push']
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  },
  worker: {
    concurrency: parseNumber(process.env.WORKER_CONCURRENCY) || 3
  },
  security: {
    tokenEncryptionSecret: process.env.GITHUB_TOKEN_DECRYPTION_KEY,
    githubTokenAesKey: process.env.GITHUB_TOKEN_AES_KEY
  }
}
