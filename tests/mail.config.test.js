import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import {
  SMTP_ADDRESS_FAMILY,
  SMTP_HOST,
  SMTP_PORT,
  buildSmtpTransportConfig,
  createIpv4SmtpSocketFactory,
  createSmtpTransporter,
  getSmtpConfigurationIssues,
  getSmtpFailureProbableCauses,
  verifyMailConnection
} from '../src/configs/mail.js'

const createLogger = () => {
  const entries = []
  return {
    entries,
    info: (message, metadata) => entries.push({ level: 'info', message, metadata }),
    warn: (message, metadata) => entries.push({ level: 'warn', message, metadata }),
    error: (message, metadata) => entries.push({ level: 'error', message, metadata })
  }
}

test('builds Gmail SMTP transport configuration', () => {
  const config = buildSmtpTransportConfig({
    gmailUser: 'sender@gmail.com',
    gmailAppPassword: 'app-password'
  })

  assert.equal(config.host, SMTP_HOST)
  assert.equal(config.port, SMTP_PORT)
  assert.equal(config.secure, true)
  assert.equal(config.family, SMTP_ADDRESS_FAMILY)
  assert.equal(typeof config.getSocket, 'function')
  assert.deepEqual(config.auth, {
    user: 'sender@gmail.com',
    pass: 'app-password'
  })
})

test('creates a reusable SMTP transporter when Gmail credentials are configured', () => {
  let createdConfig
  const transporter = createSmtpTransporter({
    gmailUser: 'sender@gmail.com',
    gmailAppPassword: 'app-password',
    transporterFactory: (config) => {
      createdConfig = config
      return { sendMail: async () => ({ messageId: 'message-1' }) }
    }
  })

  assert.equal(typeof transporter.sendMail, 'function')
  assert.equal(createdConfig.host, 'smtp.gmail.com')
  assert.equal(createdConfig.family, 4)
  assert.equal(createdConfig.auth.user, 'sender@gmail.com')
})

test('SMTP socket factory resolves Gmail over IPv4 and preserves TLS servername', async () => {
  class FakeSocket extends EventEmitter {
    setTimeout() {}
    destroy() {
      this.destroyed = true
    }
  }

  let lookupArgs
  let connectOptions
  const socketFactory = createIpv4SmtpSocketFactory({
    lookup: async (...args) => {
      lookupArgs = args
      return { address: '142.250.1.109', family: 4 }
    },
    connect: (options, onConnect) => {
      connectOptions = options
      const socket = new FakeSocket()
      queueMicrotask(onConnect)
      return socket
    }
  })

  const socketOptions = await new Promise((resolve, reject) => {
    socketFactory({
      host: 'smtp.gmail.com',
      port: 465,
      connectionTimeout: 1000,
      tls: { rejectUnauthorized: true }
    }, (error, result) => {
      if (error) return reject(error)
      return resolve(result)
    })
  })

  assert.deepEqual(lookupArgs, ['smtp.gmail.com', { family: 4 }])
  assert.equal(connectOptions.host, '142.250.1.109')
  assert.equal(connectOptions.port, 465)
  assert.equal(connectOptions.servername, 'smtp.gmail.com')
  assert.equal(connectOptions.rejectUnauthorized, true)
  assert.equal(socketOptions.secured, true)
  assert.equal(socketOptions.host, 'smtp.gmail.com')
})

test('does not create an SMTP transporter without Gmail credentials', () => {
  assert.equal(createSmtpTransporter({ gmailUser: '', gmailAppPassword: 'app-password' }), null)
  assert.equal(createSmtpTransporter({ gmailUser: 'sender@gmail.com', gmailAppPassword: '' }), null)
})

test('reports missing Gmail SMTP variables', () => {
  assert.deepEqual(getSmtpConfigurationIssues({
    gmailUser: '',
    gmailAppPassword: '',
    mailFrom: ''
  }), ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM'])
})

test('startup SMTP check logs a warning without crashing when configuration is missing', async () => {
  const logger = createLogger()
  const configured = await verifyMailConnection({
    transporter: null,
    config: { from: '' },
    gmailUser: '',
    gmailAppPassword: '',
    logger
  })

  assert.equal(configured, false)
  assert.equal(logger.entries[0].level, 'warn')
  assert.equal(logger.entries[0].message, 'Gmail SMTP provider is not fully configured')
  assert.deepEqual(logger.entries[0].metadata.missing, ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM'])
})

test('startup SMTP check logs SMTP Ready when verification succeeds', async () => {
  const logger = createLogger()
  const configured = await verifyMailConnection({
    transporter: { verify: async () => true },
    config: { from: 'SEAL Hackathon <sender@gmail.com>' },
    gmailUser: 'sender@gmail.com',
    gmailAppPassword: 'app-password',
    logger
  })

  assert.equal(configured, true)
  assert.equal(logger.entries[0].level, 'info')
  assert.equal(logger.entries[0].message, 'SMTP Ready')
  assert.equal(logger.entries[0].metadata.provider, 'gmail-smtp')
  assert.equal(logger.entries[0].metadata.from, 'SEAL Hackathon <sender@gmail.com>')
})

test('startup SMTP check logs diagnostics when verification fails', async () => {
  const logger = createLogger()
  const authError = new Error('Invalid login')
  authError.code = 'EAUTH'
  authError.responseCode = 535

  const configured = await verifyMailConnection({
    transporter: {
      verify: async () => {
        throw authError
      }
    },
    config: { from: 'SEAL Hackathon <sender@gmail.com>' },
    gmailUser: 'sender@gmail.com',
    gmailAppPassword: 'app-password',
    logger
  })

  assert.equal(configured, false)
  assert.equal(logger.entries[0].level, 'error')
  assert.equal(logger.entries[0].message, 'SMTP verification failed')
  assert.equal(logger.entries[0].metadata.error.code, 'EAUTH')
  assert.match(logger.entries[0].metadata.probableCauses.join(' '), /Invalid Gmail App Password/)
})

test('SMTP verification causes explain connectivity failures', () => {
  assert.match(
    getSmtpFailureProbableCauses({ error: { code: 'ETIMEDOUT' }, missing: [] }).join(' '),
    /SMTP connectivity issue/
  )
})

test('SMTP verification causes explain unavailable IPv6 routes', () => {
  assert.match(
    getSmtpFailureProbableCauses({
      error: {
        code: 'ESOCKET',
        message: 'connect ENETUNREACH 2607:f8b0:4023:c03::6d:465 - Local (:::0)'
      },
      missing: []
    }).join(' '),
    /force Gmail SMTP over IPv4/
  )
})
