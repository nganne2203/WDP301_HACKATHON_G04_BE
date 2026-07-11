import crypto from 'crypto'

import { env } from '#configs/environment.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const getKey = () => {
  if (!env.security.tokenEncryptionSecret) {
    throw new Error('GITHUB_TOKEN_DECRYPTION_KEY is not set')
  }

  return crypto
    .createHash('sha256')
    .update(env.security.tokenEncryptionSecret)
    .digest()
}

const encrypt = (plainText) => {
  if (!plainText) return plainText

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':')
}

const decrypt = (encryptedText) => {
  if (!encryptedText) return encryptedText

  const [ivValue, authTagValue, encryptedValue] = String(encryptedText).split(':')
  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Invalid encrypted token format')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivValue, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

const getGithubTokenAesKey = () => {
  const rawKey = env.security.githubTokenAesKey || env.security.tokenEncryptionSecret
  if (!rawKey) {
    throw new Error('GITHUB_TOKEN_AES_KEY is not set')
  }

  const key = Buffer.from(String(rawKey), 'base64')
  if (key.length !== 32) {
    throw new Error('GITHUB_TOKEN_AES_KEY must be a base64 encoded 32-byte key')
  }

  return key
}

const encryptGithubTokenForN8n = (plainToken) => {
  if (!plainToken) {
    throw new Error('GitHub token is required for n8n dispatch')
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getGithubTokenAesKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH
  })
  const ciphertext = Buffer.concat([
    cipher.update(String(plainToken), 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64')
  ].join('.')
}

const decryptGithubTokenFromN8nPayload = (encryptedToken) => {
  if (!encryptedToken) return encryptedToken

  const [ivValue, authTagValue, ciphertextValue] = String(encryptedToken).split('.')
  if (!ivValue || !authTagValue || !ciphertextValue) {
    throw new Error('Invalid encrypted GitHub token format')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getGithubTokenAesKey(), Buffer.from(ivValue, 'base64'), {
    authTagLength: AUTH_TAG_LENGTH
  })
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

export const ENCRYPTION_UTILS = {
  encrypt,
  decrypt,
  encryptGithubTokenForN8n,
  decryptGithubTokenFromN8nPayload
}
