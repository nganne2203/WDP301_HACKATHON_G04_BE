import 'dotenv/config'

export const env = {
  server: {
    port: process.env.PORT || 3000,
    hostname: process.env.HOSTNAME,
    nodeEnv: process.env.NODE_ENV
  },
  db: {
    uri: process.env.MONGODB_URI
  },
  client: {
    urls: process.env.CLIENT_URLS?.split(',') || []
  },
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
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD
  },
  otp: {
    expiresIn: process.env.OTP_EXPIRES_IN
  }
}