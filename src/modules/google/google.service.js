import { google } from 'googleapis'

import { GOOGLE_REPOSITORY } from './google.repository.js'
import {
  buildGoogleOAuthUrl,
  createGoogleOAuthClient,
  generateGoogleOAuthState,
  verifyGoogleOAuthState
} from '#configs/google.js'
import { env } from '#configs/environment.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { ENCRYPTION_UTILS } from '#utils/encryption.util.js'

const GOOGLE_TOKEN_REFRESH_WINDOW_MS = 60 * 1000
const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const normalizeScope = (scope) => {
  if (!scope) return []
  if (Array.isArray(scope)) return scope
  return String(scope).split(' ').filter(Boolean)
}

const getConnectedCalendar = (user) => {
  if (!user?.googleCalendar?.connected) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google Calendar is not connected for this user'])
  }

  if (!user.googleCalendar.accessToken || !user.googleCalendar.refreshToken) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google Calendar tokens are missing for this user'])
  }

  return user.googleCalendar
}

const getGoogleConnectUrl = (actor = {}) => {
  const state = generateGoogleOAuthState({
    purpose: 'GOOGLE_CONNECT',
    userId: actor.id
  })

  return buildGoogleOAuthUrl({
    redirectUri: env.google.connectCallbackUrl,
    state,
    prompt: 'consent'
  })
}

const getGoogleProfile = async ({ code, redirectUri }) => {
  const oauth2Client = createGoogleOAuthClient(redirectUri)
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data } = await oauth2.userinfo.get()

  return {
    profile: data,
    tokens
  }
}

const connectGoogleCalendar = async ({ code, state }) => {
  if (!code) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google authorization code is required'])
  }

  if (!state) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google OAuth state is required'])
  }

  let statePayload
  try {
    statePayload = verifyGoogleOAuthState(state)
  } catch {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid Google OAuth state'])
  }

  if (statePayload.purpose !== 'GOOGLE_CONNECT' || !statePayload.userId) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invalid Google OAuth state'])
  }

  const user = await GOOGLE_REPOSITORY.findUserById(statePayload.userId)
  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['User not found'])
  }

  const { profile, tokens } = await getGoogleProfile({
    code,
    redirectUri: env.google.connectCallbackUrl
  })

  const existingRefreshToken = user.googleCalendar?.refreshToken
  const refreshToken = tokens.refresh_token
    ? ENCRYPTION_UTILS.encrypt(tokens.refresh_token)
    : existingRefreshToken

  if (!refreshToken) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google refresh token was not returned. Please reconnect with consent.'])
  }

  const updatedUser = await GOOGLE_REPOSITORY.updateUserById(user._id, {
    googleAuth: {
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    },
    googleCalendar: {
      connected: true,
      googleId: profile.id,
      email: profile.email,
      accessToken: ENCRYPTION_UTILS.encrypt(tokens.access_token),
      refreshToken,
      tokenExpiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scope: normalizeScope(tokens.scope)
    }
  })

  return {
    connected: true,
    googleId: updatedUser.googleCalendar.googleId,
    email: updatedUser.googleCalendar.email,
    tokenExpiryDate: updatedUser.googleCalendar.tokenExpiryDate,
    scope: updatedUser.googleCalendar.scope || []
  }
}

const buildAuthenticatedCalendarClient = async (organizerUserId) => {
  const user = await GOOGLE_REPOSITORY.findUserById(organizerUserId)
  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Organizer user not found'])
  }

  const googleCalendar = getConnectedCalendar(user)
  const oauth2Client = createGoogleOAuthClient(env.google.connectCallbackUrl)
  oauth2Client.setCredentials({
    access_token: ENCRYPTION_UTILS.decrypt(googleCalendar.accessToken),
    refresh_token: ENCRYPTION_UTILS.decrypt(googleCalendar.refreshToken),
    expiry_date: googleCalendar.tokenExpiryDate?.getTime()
  })

  const tokenExpiryDate = googleCalendar.tokenExpiryDate?.getTime() || 0
  if (tokenExpiryDate <= Date.now() + GOOGLE_TOKEN_REFRESH_WINDOW_MS) {
    await oauth2Client.getAccessToken()

    const refreshedCredentials = oauth2Client.credentials
    await GOOGLE_REPOSITORY.updateUserById(user._id, {
      'googleCalendar.accessToken': ENCRYPTION_UTILS.encrypt(refreshedCredentials.access_token),
      'googleCalendar.tokenExpiryDate': refreshedCredentials.expiry_date
        ? new Date(refreshedCredentials.expiry_date)
        : googleCalendar.tokenExpiryDate,
      'googleCalendar.scope': normalizeScope(refreshedCredentials.scope || googleCalendar.scope)
    })
  }

  return {
    calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
    organizerEmail: googleCalendar.email
  }
}

const extractMeetLink = (calendarEvent) => {
  return calendarEvent.hangoutLink ||
    calendarEvent.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === 'video')?.uri
}

const createGoogleMeetEvent = async ({
  organizerUserId,
  title,
  description,
  startTime,
  endTime,
  attendees = []
}) => {
  const { calendar, organizerEmail } = await buildAuthenticatedCalendarClient(organizerUserId)

  const response = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: title,
      description,
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: DEFAULT_TIME_ZONE
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: DEFAULT_TIME_ZONE
      },
      attendees: attendees.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `seal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    }
  })

  const calendarEvent = response.data
  const meetLink = extractMeetLink(calendarEvent)
  if (!meetLink) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Google Calendar did not return a Meet link'])
  }

  return {
    meetLink,
    calendarEventId: calendarEvent.id,
    htmlLink: calendarEvent.htmlLink,
    organizerEmail
  }
}

export const GOOGLE_SERVICE = {
  getGoogleConnectUrl,
  connectGoogleCalendar,
  createGoogleMeetEvent
}
