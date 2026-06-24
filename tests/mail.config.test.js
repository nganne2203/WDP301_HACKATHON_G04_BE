import assert from 'node:assert/strict'
import dns from 'node:dns'
import test from 'node:test'

import { createGmailTransport, verifyGmailConnection } from '../src/configs/mail.js'

const createLogger = () => {
  const entries = []
  return {
    entries,
    info: (message, metadata) => entries.push({ level: 'info', message, metadata }),
    error: (message, metadata) => entries.push({ level: 'error', message, metadata })
  }
}

test('creates an IPv4-first Gmail SMTP transporter with user and App Password', () => {
  const transport = createGmailTransport({
    user: 'sender@gmail.com',
    password: 'google-app-password'
  })

  assert.equal(transport.options.host, 'smtp.gmail.com')
  assert.equal(transport.options.port, 587)
  assert.equal(transport.options.secure, false)
  assert.equal(transport.options.auth.user, 'sender@gmail.com')
  assert.equal(transport.options.auth.pass, 'google-app-password')
  assert.equal(dns.getDefaultResultOrder(), 'ipv4first')
})

test('startup Gmail health check logs a successful connection', async () => {
  const logger = createLogger()
  const connected = await verifyGmailConnection({
    transport: { verify: async () => true },
    logger
  })

  assert.equal(connected, true)
  assert.equal(logger.entries[0].message, 'Connecting to Gmail SMTP...')
  assert.equal(logger.entries[1].level, 'info')
  assert.equal(logger.entries[1].message, 'Gmail SMTP connected successfully')
})

test('startup Gmail health check logs connection failures without crashing', async () => {
  const logger = createLogger()
  const connected = await verifyGmailConnection({
    transport: {
      verify: async () => {
        throw new Error('Connection timeout')
      }
    },
    logger
  })

  assert.equal(connected, false)
  assert.equal(logger.entries[0].message, 'Connecting to Gmail SMTP...')
  assert.equal(logger.entries[1].level, 'error')
  assert.equal(logger.entries[1].message, 'Gmail SMTP connection failed')
  assert.equal(logger.entries[1].metadata.error, 'Connection timeout')
})
