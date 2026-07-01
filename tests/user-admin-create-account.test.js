import assert from 'node:assert/strict'
import test from 'node:test'

import { USER_SERVICE } from '../src/modules/users/user.service.js'
import { USER_REPOSITORY } from '../src/modules/users/user.repository.js'
import { EMAIL_SERVICE } from '../src/modules/notifications/email.service.js'

test('admin-created approved accounts require a password change and trigger a temporary account email', async (context) => {
  const actor = {
    id: 'admin-1',
    permissions: ['USER_ROLE_ASSIGN', 'USER_CREATE', 'USER_ASSIGN_ROLE']
  }
  const payload = {
    email: 'mentor@example.com',
    password: 'Password123!',
    fullName: 'Mentor User',
    roles: ['MENTOR'],
    status: 'APPROVED'
  }

  let createdPayload = null
  let emailPayload = null

  context.mock.method(USER_REPOSITORY, 'findByEmail', async () => null)
  context.mock.method(USER_REPOSITORY, 'findRolesByNames', async (names) => names.map((name, index) => ({
    _id: `role-${index + 1}`,
    name
  })))
  context.mock.method(USER_REPOSITORY, 'create', async (data) => {
    createdPayload = data
    return { _id: 'user-1' }
  })
  context.mock.method(USER_REPOSITORY, 'findById', async () => ({
    _id: 'user-1',
    email: payload.email,
    authProvider: 'LOCAL',
    registrationSource: 'FORM',
    fullName: payload.fullName,
    status: 'APPROVED',
    mustChangePassword: true,
    roles: [{
      _id: 'role-1',
      name: 'MENTOR',
      code: 'MENTOR',
      permissions: []
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }))
  context.mock.method(EMAIL_SERVICE, 'sendTemplateEmail', async (data) => {
    emailPayload = data
    return { sent: true, status: 'SENT' }
  })

  const result = await USER_SERVICE.createUser(payload, actor)

  assert.equal(createdPayload.status, 'APPROVED')
  assert.equal(createdPayload.mustChangePassword, true)
  assert.equal(emailPayload?.to, payload.email)
  assert.equal(emailPayload?.template, 'TEMPORARY_ACCOUNT')
  assert.equal(emailPayload?.context?.temporaryPassword, payload.password)
  assert.equal(result.mustChangePassword, true)
  assert.equal(result.emailNotification?.sent, true)
})
