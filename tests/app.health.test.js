import assert from 'node:assert/strict'
import test from 'node:test'

import { processHealthHandler, rootHealthHandler } from '../src/app.js'

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('root endpoint reports the backend is running for Render health checks', () => {
  const response = createResponse()
  rootHealthHandler({}, response)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, {
    success: true,
    service: 'backend',
    status: 'running'
  })
})

test('health endpoint reports process uptime', () => {
  const response = createResponse()
  processHealthHandler({}, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.success, true)
  assert.equal(typeof response.body.uptime, 'number')
})
