import Joi from 'joi'

const googleCallback = {
  query: Joi.object({
    code: Joi.string().trim().required(),
    state: Joi.string().trim().required(),
    scope: Joi.string().trim(),
    authuser: Joi.string().trim(),
    prompt: Joi.string().trim()
  }).unknown(true)
}

export const GOOGLE_VALIDATION = {
  googleCallback
}
