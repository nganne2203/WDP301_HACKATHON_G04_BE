import assert from 'node:assert/strict'
import test from 'node:test'

import { validateRuntimeEnvironment } from '../src/configs/env-validation.js'

const createConfig = (overrides = {}) => ({
  db: { uri: 'mongodb://localhost:27017/seal' },
  jwt: {
    secret: 'jwt-secret-value-123',
    refreshTokenSecret: 'refresh-secret-value-123'
  },
  security: {
    tokenEncryptionSecret: 'encryption-secret-123'
  },
  redis: {
    url: 'redis://localhost:6379'
  },
  github: {
    webhookCallbackUrl: '',
    webhookSecret: ''
  },
  ai: {
    provider: 'mock',
    apiKey: ''
  },
  server: {
    publicUrl: 'http://localhost:3000',
    readinessRequiresRedis: true
  },
  ...overrides
})

test('environment validation reports missing worker Redis configuration', () => {
  assert.throws(
    () => validateRuntimeEnvironment({
      runtime: 'worker',
      config: createConfig({ redis: { url: '' } })
    }),
    /REDIS_URL is required for queue-backed runtime/
  )
})

test('environment validation does not require local AI credentials anymore', () => {
  const result = validateRuntimeEnvironment({
    runtime: 'api',
    strict: false,
    config: createConfig({
      ai: {
        provider: 'openai',
        apiKey: ''
      }
    })
  })

  assert.equal(result.errors.length, 0)
})

test('environment validation returns warnings in non-strict mode', () => {
  const result = validateRuntimeEnvironment({
    runtime: 'api',
    strict: false,
    config: createConfig({
      redis: { url: '' },
      server: {
        publicUrl: '',
        readinessRequiresRedis: false
      }
    })
  })

  assert.equal(result.errors.length, 0)
  assert.equal(result.warnings.length, 2)
  assert.match(result.warnings[0], /REDIS_URL is not configured/)
  assert.match(result.warnings[1], /APP_BASE_URL or SERVER_PUBLIC_URL is not configured/)
})
