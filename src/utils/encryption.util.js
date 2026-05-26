import crypto from 'crypto'

import { env } from '#configs/environment.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

const getKey = () => {
  if (!env.security.tokenEncryptionSecret) {
    throw new Error('TOKEN_ENCRYPTION_SECRET is not set')
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

export const ENCRYPTION_UTILS = {
  encrypt,
  decrypt
}
