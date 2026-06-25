import assert from 'node:assert/strict'
import test from 'node:test'

import { RESEND_SENDER, createResendClient, validateResendConfiguration } from '../src/configs/mail.js'

const createLogger = () => {
  const entries = []
  return {
    entries,
    info: (message, metadata) => entries.push({ level: 'info', message, metadata }),
    warn: (message, metadata) => entries.push({ level: 'warn', message, metadata }),
    error: (message, metadata) => entries.push({ level: 'error', message, metadata })
  }
}

test('creates a Resend client when an API key is configured', () => {
  const client = createResendClient('re_test_key')

  assert.equal(typeof client.emails.send, 'function')
})

test('does not create a Resend client without an API key', () => {
  assert.equal(createResendClient(''), null)
  assert.equal(createResendClient(undefined), null)
})

test('startup Resend check logs a warning without crashing when API key is missing', () => {
  const logger = createLogger()
  const configured = validateResendConfiguration({ apiKey: '', logger })

  assert.equal(configured, false)
  assert.equal(logger.entries[0].level, 'warn')
  assert.equal(logger.entries[0].message, 'Resend email provider is not configured')
  assert.equal(logger.entries[0].metadata.missing, 'RESEND_API_KEY')
})

test('startup Resend check logs configured sender when API key exists', () => {
  const logger = createLogger()
  const configured = validateResendConfiguration({ apiKey: 're_test_key', logger })

  assert.equal(configured, true)
  assert.equal(logger.entries[0].level, 'info')
  assert.equal(logger.entries[0].message, 'Resend email provider configured')
  assert.equal(logger.entries[0].metadata.from, RESEND_SENDER)
})
