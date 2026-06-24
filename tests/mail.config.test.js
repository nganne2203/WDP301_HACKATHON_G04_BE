import assert from 'node:assert/strict'
import test from 'node:test'

import { createResendTransport } from '../src/configs/mail.js'

test('Resend transport sends email through the HTTPS API', async () => {
  const requests = []
  const transport = createResendTransport({
    apiKey: 're_test_key',
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        json: async () => ({ id: 'email-1' })
      }
    }
  })

  const result = await transport.sendMail({
    from: 'SEAL <noreply@example.com>',
    to: ['participant@example.com'],
    subject: 'Account approved',
    html: '<p>Approved</p>',
    text: 'Approved'
  })

  assert.equal(requests[0].url, 'https://api.resend.com/emails')
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.Authorization, 'Bearer re_test_key')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    from: 'SEAL <noreply@example.com>',
    to: ['participant@example.com'],
    subject: 'Account approved',
    html: '<p>Approved</p>',
    text: 'Approved'
  })
  assert.deepEqual(result, {
    accepted: ['participant@example.com'],
    rejected: [],
    messageId: 'email-1'
  })
})

test('Resend transport surfaces API errors', async () => {
  const transport = createResendTransport({
    apiKey: 're_test_key',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Domain is not verified' })
    })
  })

  await assert.rejects(
    () => transport.sendMail({
      from: 'noreply@example.com',
      to: 'participant@example.com',
      subject: 'Welcome',
      text: 'Welcome'
    }),
    /Domain is not verified/
  )
})
