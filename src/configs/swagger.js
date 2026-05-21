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
      description: 'API documentation for SEAL - Hackathon Management Platform with AI-assisted Repository Evaluation'
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
  apis: ['./src/routes/**/*.js', './src/modules/**/*.js', './src/models/**/*.js']
}

export const swaggerSpec = buildSwaggerSpec(options)
