import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createGmailApiTransporter,
  getGmailApiConfigurationIssues,
  verifyMailConnection
} from '../src/configs/mail.js'
import { env } from '../src/configs/environment.js'

const createLogger = () => {
  const entries = []
  return {
    entries,
    info: (message, metadata) => entries.push({ level: 'info', message, metadata }),
    warn: (message, metadata) => entries.push({ level: 'warn', message, metadata }),
    error: (message, metadata) => entries.push({ level: 'error', message, metadata })
  }
}

test('reports missing Gmail API variables', () => {
  assert.deepEqual(getGmailApiConfigurationIssues({
    gmailUser: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    mailFrom: ''
  }), ['GMAIL_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'MAIL_FROM'])
})

test('does not create a Gmail API transporter without credentials', () => {
  assert.equal(createGmailApiTransporter({
    gmailUser: '',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    refreshToken: 'refresh-token'
  }), null)
})

test('creates a Gmail API transporter when credentials are configured', () => {
  const transporter = createGmailApiTransporter({
    gmailUser: 'sender@gmail.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    refreshToken: 'refresh-token'
  })

  assert.equal(typeof transporter.verify, 'function')
  assert.equal(typeof transporter.sendMail, 'function')
  assert.equal(transporter.isGmailApi, true)
})

test('startup Gmail API check logs a warning without crashing when configuration is missing', async () => {
  const logger = createLogger()
  const originalClientId = env.email.gmailClientId
  const originalClientSecret = env.email.gmailClientSecret
  const originalRefreshToken = env.email.gmailRefreshToken

  env.email.gmailClientId = ''
  env.email.gmailClientSecret = ''
  env.email.gmailRefreshToken = ''

  try {
    const configured = await verifyMailConnection({
      transporter: null,
      config: { from: '' },
      gmailUser: '',
      logger
    })

    assert.equal(configured, false)
    assert.equal(logger.entries[0].level, 'warn')
    assert.equal(logger.entries[0].message, 'Gmail API provider is not fully configured')
    assert.deepEqual(logger.entries[0].metadata.missing, ['GMAIL_USER', 'MAIL_FROM'])
  } finally {
    env.email.gmailClientId = originalClientId
    env.email.gmailClientSecret = originalClientSecret
    env.email.gmailRefreshToken = originalRefreshToken
  }
})

test('startup Gmail API check logs Gmail API Ready when verification succeeds', async () => {
  const logger = createLogger()
  const configured = await verifyMailConnection({
    transporter: { verify: async () => true },
    config: { from: 'SEAL Hackathon <sender@gmail.com>' },
    gmailUser: 'sender@gmail.com',
    logger
  })

  assert.equal(configured, true)
  assert.equal(logger.entries[0].level, 'info')
  assert.equal(logger.entries[0].message, 'Gmail API Ready')
  assert.equal(logger.entries[0].metadata.provider, 'gmail-api')
  assert.equal(logger.entries[0].metadata.from, 'SEAL Hackathon <sender@gmail.com>')
})

test('startup Gmail API check logs diagnostics when verification fails', async () => {
  const logger = createLogger()
  const authError = new Error('Invalid OAuth2 Credentials')
  authError.code = 'INVALID_CREDENTIALS'

  const configured = await verifyMailConnection({
    transporter: {
      verify: async () => {
        throw authError
      }
    },
    config: { from: 'SEAL Hackathon <sender@gmail.com>' },
    gmailUser: 'sender@gmail.com',
    logger
  })

  assert.equal(configured, false)
  assert.equal(logger.entries[0].level, 'error')
  assert.equal(logger.entries[0].message, 'Gmail API verification failed')
  assert.equal(logger.entries[0].metadata.error.code, 'INVALID_CREDENTIALS')
})
