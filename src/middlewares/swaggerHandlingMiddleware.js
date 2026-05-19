import basicAuth from 'express-basic-auth'
import { env } from '#configs/environment.js'

export const swaggerHandlingMiddleware = basicAuth({
  users: { [env.SWAGGER_USER]: env.SWAGGER_PASSWORD },
  challenge: true,
  realm: 'Swagger API Documentation'
})