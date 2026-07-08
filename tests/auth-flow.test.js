import assert from 'node:assert/strict'
import test from 'node:test'

import { AUTH_VALIDATION } from '../src/modules/auth/auth.validation.js'
import { AUTH_REPOSITORY } from '../src/modules/auth/auth.repository.js'
import {
  AUTH_SERVICE,
  isCompleteFormRegistrationPayload,
  isGoogleLoginFallback
} from '../src/modules/auth/auth.service.js'
import {
  canAccessAuthenticatedRoutes,
  getRegistrationSource,
  isGoogleAccount
} from '../src/utils/userAccountUtil.js'

const googlePayload = {
  googleId: 'google-user-1',
  email: 'person@example.com',
  name: 'Example Person',
  avatar: null
}

const formPayload = {
  email: 'person@example.com',
  password: 'Password123!',
  fullName: 'Example Person',
  githubUsername: 'example-person',
  studentType: 'FPT',
  studentId: 'SE123456'
}

test('registration flow distinguishes complete forms from Google login fallback payloads', () => {
  assert.equal(isCompleteFormRegistrationPayload(formPayload), true)
  assert.equal(isGoogleLoginFallback(formPayload), false)
  assert.equal(isCompleteFormRegistrationPayload(googlePayload), false)
  assert.equal(isGoogleLoginFallback(googlePayload), true)
})

test('register validation accepts form registration and Google login fallback payloads', () => {
  assert.equal(AUTH_VALIDATION.register.body.validate(formPayload).error, undefined)
  assert.equal(AUTH_VALIDATION.register.body.validate(googlePayload).error, undefined)

  const invalidCompleteForm = { ...formPayload, ...googlePayload, password: 'short' }
  assert.ok(AUTH_VALIDATION.register.body.validate(invalidCompleteForm).error)
})

test('legacy account source is inferred from authProvider', () => {
  assert.equal(getRegistrationSource({ authProvider: 'LOCAL' }), 'FORM')
  assert.equal(getRegistrationSource({ authProvider: 'GOOGLE' }), 'GOOGLE')
  assert.equal(getRegistrationSource({ authProvider: 'GOOGLE', passwordHash: 'legacy-form-hash' }), 'FORM')
  assert.equal(isGoogleAccount({ registrationSource: 'GOOGLE', authProvider: 'LOCAL' }), true)
})

test('only active account status can access authenticated routes', () => {
  assert.equal(canAccessAuthenticatedRoutes({ status: 'APPROVED' }), false)
  assert.equal(canAccessAuthenticatedRoutes({ status: 'ACTIVE' }), true)
  assert.equal(canAccessAuthenticatedRoutes({ status: 'PENDING' }), false)
  assert.equal(canAccessAuthenticatedRoutes({ status: 'REJECTED' }), false)
  assert.equal(canAccessAuthenticatedRoutes({ status: 'SUSPENDED' }), false)
})

test('Google login does not create a user when no matching account exists', async (context) => {
  let createCalls = 0
  context.mock.method(AUTH_REPOSITORY, 'findUserByGoogleId', async () => null)
  context.mock.method(AUTH_REPOSITORY, 'findUserByEmail', async () => null)
  context.mock.method(AUTH_REPOSITORY, 'createUser', async () => {
    createCalls += 1
    throw new Error('createUser must not be called')
  })

  await assert.rejects(
    AUTH_SERVICE.googleLogin(googlePayload),
    error => error.code === 'GOOGLE_ACCOUNT_NOT_FOUND'
  )
  assert.equal(createCalls, 0)
})

test('register creates participant accounts instead of the removed USER role', async (context) => {
  const participantRole = { _id: 'role-participant' }
  let createPayload = null

  context.mock.method(AUTH_REPOSITORY, 'findUserByEmail', async () => null)
  context.mock.method(AUTH_REPOSITORY, 'findRoleByName', async (name) => {
    assert.equal(name, 'PARTICIPANT')
    return participantRole
  })
  context.mock.method(AUTH_REPOSITORY, 'createUser', async (payload) => {
    createPayload = payload
    return { _id: 'user-1' }
  })
  context.mock.method(AUTH_REPOSITORY, 'findUserById', async () => ({
    _id: 'user-1',
    email: formPayload.email,
    authProvider: 'LOCAL',
    registrationSource: 'FORM',
    fullName: formPayload.fullName,
    status: 'PENDING',
    mustChangePassword: false,
    roles: [{
      _id: 'role-participant',
      name: 'PARTICIPANT',
      code: 'PARTICIPANT',
      permissions: []
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }))

  const result = await AUTH_SERVICE.register(formPayload)

  assert.deepEqual(createPayload.roles, ['role-participant'])
  assert.deepEqual(result.roles.map((role) => role.name), ['PARTICIPANT'])
})
