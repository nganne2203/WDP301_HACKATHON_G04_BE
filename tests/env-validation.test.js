import assert from 'node:assert/strict'
import test from 'node:test'

import { validateRuntimeEnvironment } from '../src/configs/env-validation.js'

const createConfig = (overrides = {}) => ({
  db: { uri: 'mongodb://localhost:27017/seal' },
  jwt: {
    secret: 'jwt-secret-value-123',
    refreshTokenSecret: 'refresh-secret-value-123'
  },
  email: {
    gmailUser: 'sender@gmail.com',
    gmailAppPassword: 'app-password',
    from: 'SEAL Hackathon <sender@gmail.com>'
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

test('environment validation warns instead of crashing when Gmail SMTP variables are missing', () => {
  const result = validateRuntimeEnvironment({
    runtime: 'api',
    strict: false,
    config: createConfig({
      email: {
        gmailUser: '',
        gmailAppPassword: '',
        from: ''
      }
    })
  })

  assert.equal(result.errors.length, 0)
  assert.equal(result.warnings.length, 1)
  assert.match(result.warnings[0], /GMAIL_USER, GMAIL_APP_PASSWORD, MAIL_FROM are not configured/)
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

test('environment validation requires base64 32-byte GitHub token AES key when n8n is enabled', () => {
  assert.throws(
    () => validateRuntimeEnvironment({
      runtime: 'api',
      config: createConfig({
        n8n: {
          enabled: true,
          perPushWebhookUrl: 'https://n8n.test/per-push',
          aggregateWebhookUrl: 'https://n8n.test/aggregate',
          callbackSecret: 'secret',
          dispatchMaxRetries: 1
        },
        security: {
          tokenEncryptionSecret: 'encryption-secret-123',
          githubTokenAesKey: 'not-a-32-byte-key'
        }
      })
    }),
    /GITHUB_TOKEN_AES_KEY must be a base64 encoded 32-byte key/
  )

  const result = validateRuntimeEnvironment({
    runtime: 'api',
    config: createConfig({
      n8n: {
        enabled: true,
        perPushWebhookUrl: 'https://n8n.test/per-push',
        aggregateWebhookUrl: 'https://n8n.test/aggregate',
        callbackSecret: 'secret',
        dispatchMaxRetries: 1
      },
      security: {
        tokenEncryptionSecret: 'encryption-secret-123',
        githubTokenAesKey: Buffer.alloc(32, 3).toString('base64')
      }
    })
  })

  assert.equal(result.errors.length, 0)
})
