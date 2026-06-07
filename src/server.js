import { env } from '#configs/environment.js'
import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import { createApp } from './app.js'

const app = createApp()

const PORT = env.server.port || 3000
const HOSTNAME = env.server.hostname || '0.0.0.0'

const startServer = async () => {
  await CONNECT_DB()
  app.listen(PORT, HOSTNAME, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running at http://${HOSTNAME}:${PORT}`)
  })
}

startServer()

const shutdown = async () => {
  await CLOSE_DB()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
