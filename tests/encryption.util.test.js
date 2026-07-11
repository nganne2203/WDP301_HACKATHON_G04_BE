import assert from 'node:assert/strict'
import test from 'node:test'

import { env } from '../src/configs/environment.js'
import { ENCRYPTION_UTILS } from '../src/utils/encryption.util.js'

test('n8n GitHub token AES-256-GCM encryption round-trips with iv.tag.ciphertext format', () => {
  const originalKey = env.security.githubTokenAesKey
  env.security.githubTokenAesKey = Buffer.alloc(32, 11).toString('base64')

  try {
    const encrypted = ENCRYPTION_UTILS.encryptGithubTokenForN8n('github_pat_secret')
    const parts = encrypted.split('.')

    assert.equal(parts.length, 3)
    assert.equal(Buffer.from(parts[0], 'base64').length, 12)
    assert.equal(Buffer.from(parts[1], 'base64').length, 16)
    assert.notEqual(encrypted.includes('github_pat_secret'), true)
    assert.equal(ENCRYPTION_UTILS.decryptGithubTokenFromN8nPayload(encrypted), 'github_pat_secret')
  } finally {
    env.security.githubTokenAesKey = originalKey
  }
})
