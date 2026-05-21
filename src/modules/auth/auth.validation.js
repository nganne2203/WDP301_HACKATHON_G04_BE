import Joi from 'joi'

const register = {
  body: Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().min(8).max(128).required(),
    fullName: Joi.string().trim().min(2).max(120).required()
  })
}

const login = {
  body: Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().required()
  })
}

const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().required()
  })
}

export const AUTH_VALIDATION = {
  register,
  login,
  refreshToken
}
