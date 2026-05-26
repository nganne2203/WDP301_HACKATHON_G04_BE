import { StatusCodes } from 'http-status-codes'

import { GOOGLE_SERVICE } from './google.service.js'
import { env } from '#configs/environment.js'
import { responseSuccess } from '#utils/responseUtil.js'

const redirectToGoogleConnect = async (req, res, next) => {
  try {
    const url = GOOGLE_SERVICE.getGoogleConnectUrl(req.user)
    res.redirect(url)
  } catch (error) {
    next(error)
  }
}

const googleConnectCallback = async (req, res, next) => {
  try {
    const googleCalendar = await GOOGLE_SERVICE.connectGoogleCalendar(req.validated?.query || req.query)
    const frontendUrl = env.client.frontendUrl || env.client.urls[0]

    if (frontendUrl) {
      const redirectUrl = new URL('/google/callback', frontendUrl)
      redirectUrl.searchParams.set('success', 'true')
      redirectUrl.searchParams.set('email', googleCalendar.email)
      return res.redirect(redirectUrl.toString())
    }

    return res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Connect Google Calendar successfully',
      data: googleCalendar
    }))
  } catch (error) {
    next(error)
  }
}

export const GOOGLE_CONTROLLER = {
  redirectToGoogleConnect,
  googleConnectCallback
}
