import Joi from 'joi'

const githubUsername = Joi.string().trim().min(1).max(39).pattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)

const googleLoginBody = Joi.object({
  googleId: Joi.string().trim().required(),
  email: Joi.string().email().trim().lowercase().required(),
  name: Joi.string().trim().min(1).max(120).required(),
  avatar: Joi.string().uri().allow(null).required()
})

const formRegisterBody = Joi.object({
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
  }),
  googleId: Joi.string().trim(),
  name: Joi.string().trim().min(1).max(120),
  avatar: Joi.string().uri().allow(null)
})

const googleLoginFallbackBody = googleLoginBody.unknown(true).custom((value, helpers) => {
  const requiredFormFields = ['email', 'password', 'fullName', 'githubUsername', 'studentType', 'studentId']
  const hasCompleteForm = requiredFormFields.every(field => {
    const fieldValue = value[field]
    return fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== ''
  }) && (value.studentType !== 'EXTERNAL' || Boolean(value.schoolName?.trim()))

  return hasCompleteForm ? helpers.error('any.invalid') : value
})

const register = {
  body: Joi.alternatives().try(formRegisterBody, googleLoginFallbackBody)
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

const googleLogin = {
  body: googleLoginBody
}

export const AUTH_VALIDATION = {
  register,
  login,
  refreshToken,
  changePassword,
  googleLogin
}
