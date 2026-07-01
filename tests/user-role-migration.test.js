import assert from 'node:assert/strict'
import test from 'node:test'

import { USER_SERVICE } from '../src/modules/users/user.service.js'
import { migrateLegacyUserRoleNames } from '../src/utils/userRoleMigrationUtil.js'

test('legacy USER-only accounts normalize to PARTICIPANT on read', () => {
  const normalized = USER_SERVICE.normalizeUser({
    _id: 'user-1',
    email: 'participant@example.com',
    authProvider: 'LOCAL',
    registrationSource: 'FORM',
    fullName: 'Participant User',
    status: 'APPROVED',
    mustChangePassword: false,
    roles: [{
      _id: 'role-user',
      name: 'USER',
      code: 'USER',
      permissions: [{ code: 'TEAM_CREATE' }, { code: 'TEAM_VIEW' }]
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  assert.deepEqual(normalized.roles.map((role) => role.name), ['PARTICIPANT'])
  assert.deepEqual(normalized.permissions, ['TEAM_CREATE', 'TEAM_VIEW'])
})

test('legacy USER plus specialized roles drop USER permissions immediately', () => {
  const roles = [
    {
      _id: 'role-user',
      name: 'USER',
      code: 'USER',
      permissions: [{ code: 'TEAM_CREATE' }, { code: 'TEAM_VIEW' }]
    },
    {
      _id: 'role-mentor',
      name: 'MENTOR',
      code: 'MENTOR',
      permissions: [{ code: 'TEAM_VIEW' }, { code: 'AI_REVIEW_VIEW' }]
    }
  ]

  assert.deepEqual(USER_SERVICE.getRoleNames({ roles }), ['MENTOR'])
  assert.deepEqual(USER_SERVICE.getPermissionCodes({ roles }), ['TEAM_VIEW', 'AI_REVIEW_VIEW'])
})

test('legacy role migration utility removes USER according to the locked rule', () => {
  assert.deepEqual(migrateLegacyUserRoleNames(['USER']), ['PARTICIPANT'])
  assert.deepEqual(migrateLegacyUserRoleNames(['USER', 'MENTOR']), ['MENTOR'])
  assert.deepEqual(migrateLegacyUserRoleNames(['USER', 'PARTICIPANT']), ['PARTICIPANT'])
  assert.deepEqual(migrateLegacyUserRoleNames(['TEAM_LEADER']), ['PARTICIPANT'])
})
