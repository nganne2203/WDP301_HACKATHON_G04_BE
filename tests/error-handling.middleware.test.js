import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { ERROR_CODES } from '../src/constants/errorCode.js'
import { errorHandlingMiddleware } from '../src/middlewares/errorHandlingMiddleware.js'

const invoke = (error) => {
  const result = {}
  const response = {
    status: (statusCode) => {
      result.statusCode = statusCode
      return response
    },
    json: (body) => {
      result.body = body
      return response
    }
  }
  errorHandlingMiddleware(error, { method: 'POST', originalUrl: '/api/test' }, response, () => {})
  return result
}

test('error middleware converts duplicate database errors into a safe conflict response', () => {
  const result = invoke({
    name: 'MongoServerError',
    code: 11000,
    message: 'E11000 duplicate key error collection: seal-hackathon.tracks index: competitionId_1_code_1'
  })

  assert.equal(result.statusCode, 409)
  assert.equal(result.body.code, 'CONFLICT')
  assert.equal(result.body.errors[0], 'A record with the same information already exists. Please use a different value.')
  assert.equal(JSON.stringify(result.body).includes('E11000'), false)
  assert.equal('stack' in result.body, false)
})

test('error middleware does not expose unexpected error messages or stack traces', () => {
  const result = invoke(new Error('ECONNREFUSED mongodb://username:secret@database'))

  assert.equal(result.statusCode, 500)
  assert.equal(result.body.code, 'INTERNAL_SERVER_ERROR')
  assert.equal(result.body.errors[0], 'We could not complete your request. Please try again later.')
  assert.equal(JSON.stringify(result.body).includes('secret'), false)
  assert.equal('stack' in result.body, false)
})

test('error middleware preserves intentional user-facing ApiError messages', () => {
  const result = invoke(new ApiError(ERROR_CODES.BAD_REQUEST, ['Track code is required']))

  assert.equal(result.statusCode, 400)
  assert.equal(result.body.errors[0], 'Track code is required')
})
