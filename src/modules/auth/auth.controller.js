import { StatusCodes } from 'http-status-codes'

import { AUTH_SERVICE, isGoogleLoginFallback } from './auth.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const register = async (req, res, next) => {
  try {
    if (isGoogleLoginFallback(req.body)) {
      const authData = await AUTH_SERVICE.googleLogin(req.body)

      return res.status(StatusCodes.OK).json(responseSuccess({
        message: 'Login with Google successfully',
        data: authData
      }))
    }

    const user = await AUTH_SERVICE.register(req.body)

    return res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Register successfully. Your account is pending approval.',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const login = async (req, res, next) => {
  try {
    const authData = await AUTH_SERVICE.login(req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Login successfully',
      data: authData
    }))
  } catch (error) {
    next(error)
  }
}

const googleLogin = async (req, res, next) => {
  try {
    const authData = await AUTH_SERVICE.googleLogin(req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Login with Google successfully',
      data: authData
    }))
  } catch (error) {
    next(error)
  }
}

const refreshToken = async (req, res, next) => {
  try {
    const authData = await AUTH_SERVICE.refreshToken(req.body.refreshToken)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Refresh token successfully',
      data: authData
    }))
  } catch (error) {
    next(error)
  }
}

const getMe = async (req, res, next) => {
  try {
    const user = await AUTH_SERVICE.getMe(req.user.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get current user successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const changePassword = async (req, res, next) => {
  try {
    const user = await AUTH_SERVICE.changePassword(req.user.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Change password successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const logout = async (req, res, next) => {
  try {
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Logout successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

export const AUTH_CONTROLLER = {
  register,
  login,
  googleLogin,
  refreshToken,
  getMe,
  changePassword,
  logout
}
