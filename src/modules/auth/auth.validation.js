import Joi from 'joi'

const githubUsername = Joi.string().trim().min(1).max(39).pattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)

const register = {
  body: Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().min(8).max(128).required(),
    fullName: Joi.string().trim().min(2).max(120).required(),
    githubUsername: githubUsername.required(),
    studentType: Joi.string().trim().uppercase().valid('FPT', 'EXTERNAL').required(),
    studentId: Joi.string().trim().min(2).max(50).required(),
    schoolName: Joi.when('studentType', {
      is: 'EXTERNAL',
      then: Joi.string().trim().min(2).max(200).required(),
      otherwise: Joi.string().trim().max(200).allow('', null)
    })
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

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
  })
}

const googleCallback = {
  query: Joi.object({
    code: Joi.string().trim().required(),
    state: Joi.string().trim().required(),
    scope: Joi.string().trim(),
    authuser: Joi.string().trim(),
    prompt: Joi.string().trim()
  }).unknown(true)
}

export const AUTH_VALIDATION = {
  register,
  login,
  refreshToken,
  changePassword,
  googleCallback
}
