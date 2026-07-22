import jwt from 'jsonwebtoken'
import { google } from 'googleapis'

import { env } from '#configs/environment.js'

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.competitions'
]

export const createGoogleOAuthClient = (redirectUri) => {
  return new google.auth.OAuth2(
    env.google.clientId,
    env.google.clientSecret,
    redirectUri
  )
}

export const generateGoogleOAuthState = (payload = {}) => {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: '10m' })
}

export const verifyGoogleOAuthState = (state) => {
  return jwt.verify(state, env.jwt.secret)
}

export const buildGoogleOAuthUrl = ({ redirectUri, state, prompt = 'select_account' }) => {
  const oauth2Client = createGoogleOAuthClient(redirectUri)

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt,
    scope: GOOGLE_OAUTH_SCOPES,
    state,
    include_granted_scopes: true
  })
}
