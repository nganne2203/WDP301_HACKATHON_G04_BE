import { env } from '#configs/environment.js'

export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = env.CLIENT_URLS
    if (
      !origin ||
      origin === 'null' ||
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://192.168.')
    ) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}