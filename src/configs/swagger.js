import swaggerJSDoc from 'swagger-jsdoc'

const buildSwaggerSpec = (swaggerOptions) => {
  const emitWarning = process.emitWarning

  process.emitWarning = (...args) => {
    const warning = args[0]
    const warningCode = warning?.code || args[2]

    if (warningCode === 'DEP0169') {
      return
    }

    return emitWarning.apply(process, args)
  }

  try {
    return swaggerJSDoc(swaggerOptions)
  } finally {
    process.emitWarning = emitWarning
  }
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SEAL API',
      version: '1.0.0',
      description: `API documentation for SEAL - Hackathon Management Platform with AI-assisted Repository Evaluation.

Common FE integration notes:
- Most successful responses follow the envelope: { success, message, data, pagination }.
- Endpoints that "queue" work usually return success immediately while background processing continues in worker services.
- AI review endpoints are advisory and must not be treated as official judging results.
- GitHub webhook endpoints are system-to-system integration endpoints, not browser-facing APIs.`
    },
    servers: [],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'Bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/**/*.js', './src/modules/**/*.js', './src/models/**/*.js', './src/docs/**/*.yaml']
}

export const swaggerSpec = buildSwaggerSpec(options)
