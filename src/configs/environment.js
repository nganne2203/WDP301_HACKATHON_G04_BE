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
const legacyEmailHost = process.env.EMAIL_HOST
const legacyEmailHostIsAddress = legacyEmailHost?.includes('@')
const emailUser = process.env.SMTP_USER || process.env.EMAIL_USER || (legacyEmailHostIsAddress ? legacyEmailHost : undefined)
const emailHost = process.env.SMTP_HOST || (!legacyEmailHostIsAddress ? legacyEmailHost : undefined)

export const env = {
  server: {
    port: process.env.PORT || 3000,
    hostname: process.env.HOSTNAME,
    nodeEnv
  },
  db: {
    uri: process.env.MONGODB_URI
  },
  client: {
    urls: process.env.CLIENT_URLS?.split(',') || [],
    frontendUrl: process.env.FRONTEND_URL
  },
  CLIENT_URLS: process.env.CLIENT_URLS?.split(',') || [],
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
    service: process.env.EMAIL_SERVICE,
    host: emailHost,
    port: parseNumber(process.env.SMTP_PORT),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: emailUser,
    password: process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || emailUser,
    devMode: process.env.EMAIL_DEV_MODE || (['dev', 'development', 'test'].includes(nodeEnv) ? 'console' : 'silent')
  },
  otp: {
    expiresIn: process.env.OTP_EXPIRES_IN
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authCallbackUrl: process.env.GOOGLE_AUTH_CALLBACK_URL,
    connectCallbackUrl: process.env.GOOGLE_CONNECT_CALLBACK_URL
  },
  security: {
    tokenEncryptionSecret: process.env.TOKEN_ENCRYPTION_SECRET
  }
}
