import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createParticipantService } from '../src/modules/participants/participant.service.js'

const createRepository = () => {
  const records = new Map()
  let sequence = 1

  const event = { _id: '000000000000000000000201', title: 'SEAL Event', status: 'OPEN_REGISTRATION' }
  const userA = { _id: '000000000000000000000301', email: 'a@example.com', fullName: 'User A', status: 'APPROVED' }
  const userB = { _id: '000000000000000000000302', email: 'b@example.com', fullName: 'User B', status: 'APPROVED' }
  const team = { _id: '000000000000000000000401', eventId: event._id, name: 'Code Wizards' }

  return {
    count: async () => records.size,
    findAll: async () => [...records.values()],
    findById: async (id) => records.get(id) || null,
    findByEventAndUser: async ({ eventId, userId }) => {
      return [...records.values()].find(record => record.eventId === eventId && record.userId === userId) || null
    },
    create: async (data) => {
      const id = String(sequence).padStart(24, '0')
      const record = {
        teamId: null,
        teamRole: 'MEMBER',
        isGraduated: false,
        consentMediaUse: false,
        eligibilityStatus: 'PENDING',
        attendedActivities: [],
        checkInStatus: 'NOT_CHECKED_IN',
        githubAccessStatus: 'NOT_GRANTED',
        status: 'INVITED',
        ...data,
        _id: id
      }
      records.set(id, record)
      sequence += 1
      return record
    },
    updateById: async (id, data) => {
      const existing = records.get(id)
      if (!existing) return null
      const updated = { ...existing, ...data, _id: id }
      records.set(id, updated)
      return updated
    },
    deleteById: async (id) => records.delete(id),
    findEventById: async (id) => id === event._id ? event : null,
    findUserById: async (id) => {
      if (id === userA._id) return userA
      if (id === userB._id) return userB
      return null
    },
    findTeamById: async (id) => id === team._id ? team : null
  }
}

test('createParticipant lets a user register themselves for an event', async () => {
  const service = createParticipantService({ repository: createRepository() })

  const participant = await service.createParticipant({
    eventId: '000000000000000000000201',
    consentMediaUse: true
  }, {
    id: '000000000000000000000301',
    permissions: ['EVENT_VIEW']
  })

  assert.equal(participant.userId, '000000000000000000000301')
  assert.equal(participant.eventId, '000000000000000000000201')
  assert.equal(participant.consentMediaUse, true)
  assert.equal(participant.status, 'INVITED')
})

test('createParticipant rejects registering another user without approver permission', async () => {
  const service = createParticipantService({ repository: createRepository() })

  await assert.rejects(
    service.createParticipant({
      eventId: '000000000000000000000201',
      userId: '000000000000000000000302'
    }, {
      id: '000000000000000000000301',
      permissions: ['EVENT_VIEW']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'FORBIDDEN' &&
      error.errors.includes('You do not have permission to register another user as a participant')
  )
})

test('updateAttendance and updateGithubAccessStatus persist participant lifecycle updates', async () => {
  const repository = createRepository()
  const service = createParticipantService({ repository })

  const created = await service.createParticipant({
    eventId: '000000000000000000000201',
    userId: '000000000000000000000301'
  }, {
    id: '000000000000000000000301',
    permissions: ['PARTICIPANT_APPROVE']
  })

  const attendanceUpdated = await service.updateAttendance(created.id, ['WORKSHOP', 'CODING'])
  const githubUpdated = await service.updateGithubAccessStatus(created.id, 'GRANTED')

  assert.deepEqual(attendanceUpdated.attendedActivities, ['WORKSHOP', 'CODING'])
  assert.equal(githubUpdated.githubAccessStatus, 'GRANTED')
})
