import basicAuth from 'express-basic-auth'
import { env } from '#configs/environment.js'

const hasSwaggerCredentials = Boolean(env.swagger.user && env.swagger.password)

export const swaggerHandlingMiddleware = hasSwaggerCredentials
  ? basicAuth({
    users: { [env.swagger.user]: env.swagger.password },
    challenge: true,
    realm: 'Swagger API Documentation'
  })
  : (req, res, next) => next()
