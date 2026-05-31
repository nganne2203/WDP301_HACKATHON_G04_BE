import assert from 'node:assert/strict'
import test from 'node:test'

import { EMAIL_TEMPLATE_KEYS, renderEmailTemplate } from '../src/modules/notifications/email-templates.js'
import {
  createTeamService,
  createInvitationToken,
  hashInvitationToken,
  isRegistrationOpen,
  normalizeInvitationEmails,
  normalizeInvitationMembers
} from '../src/modules/teams/team.service.js'
import ApiError from '../src/utils/ApiError.js'

const createSession = () => ({
  withTransaction: async (work) => await work(),
  endSession: async () => {}
})

const createLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {}
})

test('team invitation helper normalizes emails and hashes secure tokens', () => {
  assert.deepEqual(
    normalizeInvitationEmails([' Member@Example.com ', 'member@example.com', '', 'Other@Example.com']),
    ['member@example.com', 'other@example.com']
  )
  assert.deepEqual(
    normalizeInvitationMembers({
      members: [
        { fullName: 'Member One', email: 'Member@Example.com' },
        { fullName: 'Duplicate Member', email: 'member@example.com' }
      ],
      emails: ['Other@Example.com']
    }),
    [
      { fullName: 'Member One', email: 'member@example.com' },
      { fullName: '', email: 'other@example.com' }
    ]
  )

  const token = createInvitationToken()
  const anotherToken = createInvitationToken()
  assert.notEqual(token, anotherToken)
  assert.equal(hashInvitationToken(token), hashInvitationToken(token))
  assert.notEqual(hashInvitationToken(token), token)
})

test('registration must be open before team creation or invitation acceptance', () => {
  const now = new Date('2026-05-30T00:00:00.000Z')
  const baseEvent = {
    status: 'OPEN_REGISTRATION',
    registrationStart: '2026-05-01T00:00:00.000Z',
    registrationEnd: '2026-06-01T00:00:00.000Z'
  }

  assert.equal(isRegistrationOpen(baseEvent, now), true)
  assert.equal(isRegistrationOpen({ ...baseEvent, status: 'DRAFT' }, now), false)
  assert.equal(isRegistrationOpen({ ...baseEvent, registrationStart: '2026-06-01T00:00:00.000Z' }, now), false)
  assert.equal(isRegistrationOpen({ ...baseEvent, registrationEnd: '2026-05-01T00:00:00.000Z' }, now), false)
})

test('team invitation templates include required accept, decline, and temporary password content', () => {
  const invitation = renderEmailTemplate(EMAIL_TEMPLATE_KEYS.TEAM_INVITATION, {
    fullName: 'Member User',
    eventTitle: 'SEAL Hackathon',
    teamName: 'Code Wizards',
    leaderName: 'Leader User',
    leaderEmail: 'leader@example.com',
    acceptUrl: 'http://localhost:5173/team-invitations/confirm?decision=accept',
    declineUrl: 'http://localhost:5173/team-invitations/confirm?decision=decline'
  })

  assert.match(invitation.text, /Code Wizards/)
  assert.match(invitation.text, /Accept:/)
  assert.match(invitation.text, /Decline:/)

  const temporaryAccount = renderEmailTemplate(EMAIL_TEMPLATE_KEYS.TEMPORARY_ACCOUNT, {
    fullName: 'Member User',
    email: 'member@example.com',
    temporaryPassword: 'test',
    loginUrl: 'http://localhost:5173/login'
  })

  assert.match(temporaryAccount.text, /member@example.com/)
  assert.match(temporaryAccount.text, /test/)
  assert.match(temporaryAccount.text, /change your password/i)
})

test('createTeam rejects duplicate team creation for the same event leader', async () => {
  const repository = {
    createSession,
    findEventById: async () => ({
      _id: 'event-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 5,
      maxTeams: 30
    }),
    countTeams: async () => 0,
    findUserById: async () => ({ _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'APPROVED' }),
    findTeamByLeaderAndEvent: async () => ({ _id: 'team-1', name: 'Existing Team' })
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({ eventId: 'event-1', name: 'New Team' }, { id: 'leader-1' }),
    (error) => error instanceof ApiError && error.code === 'CONFLICT'
  )
})

test('createTeam rejects inviting the leader email as a team member', async () => {
  const leader = { _id: 'leader-1', email: 'Leader@Example.com', fullName: 'Leader', status: 'APPROVED' }
  const repository = {
    createSession,
    findEventById: async () => ({
      _id: 'event-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 5,
      maxTeams: 30
    }),
    countTeams: async () => 0,
    findUserById: async () => leader,
    findTeamByLeaderAndEvent: async () => null,
    findParticipantByEventAndUser: async () => null,
    findBlockingInvitation: async () => null
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({
      eventId: 'event-1',
      name: 'New Team',
      invitedMembers: [{ fullName: 'Leader Duplicate', email: 'leader@example.com' }]
    }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Team leader cannot invite their own email')
  )
})

test('createTeam sends temporary account and invitation emails for unknown invitees', async () => {
  const sentEmails = []
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'APPROVED' }
  const event = {
    _id: 'event-1',
    title: 'SEAL Hackathon',
    status: 'OPEN_REGISTRATION',
    minTeamMembers: 3,
    maxTeamMembers: 5,
    maxTeams: 30
  }
  const team = {
    _id: 'team-1',
    eventId: event,
    leaderId: leader,
    memberIds: [leader],
    name: 'Code Wizards',
    status: 'WAITING_FOR_MEMBERS'
  }
  const invitation = {
    _id: 'invitation-1',
    eventId: 'event-1',
    teamId: 'team-1',
    leaderId: 'leader-1',
    invitedEmail: 'member@example.com',
    invitedUserId: 'member-1',
    status: 'PENDING',
    expiresAt: new Date('2026-06-02T00:00:00.000Z')
  }

  const repository = {
    createSession,
    findEventById: async () => event,
    countTeams: async () => 0,
    findUserById: async (id) => id === 'leader-1' ? leader : { _id: id, email: 'member@example.com', fullName: 'Member', status: 'APPROVED' },
    findTeamByLeaderAndEvent: async () => null,
    findParticipantByEventAndUser: async () => null,
    findBlockingInvitation: async () => null,
    createTeam: async () => team,
    upsertParticipant: async () => ({}),
    findUserByEmail: async () => null,
    findRoleByName: async () => ({ _id: 'role-user' }),
    createUser: async () => ({ _id: 'member-1', email: 'member@example.com', fullName: 'Member', status: 'APPROVED' }),
    createInvitation: async () => invitation,
    findTeamById: async () => team,
    findParticipantsByTeam: async () => [{
      _id: 'participant-1',
      eventId: 'event-1',
      teamId: 'team-1',
      userId: leader,
      teamRole: 'LEADER',
      status: 'ACTIVE'
    }],
    findInvitationsByTeam: async () => [invitation]
  }

  const service = createTeamService({
    repository,
    emailService: {
      sendTemplateEmail: async (payload) => {
        sentEmails.push(payload)
        return { sent: true, status: 'SENT', accepted: [payload.to] }
      }
    },
    notificationService: {
      notifyUser: async () => ({ notification: null, email: null, errors: [] })
    },
    logger: createLogger()
  })

  const result = await service.createTeam({
    eventId: 'event-1',
    name: 'Code Wizards',
    invitedEmails: ['member@example.com']
  }, { id: 'leader-1' })

  assert.equal(result.name, 'Code Wizards')
  assert.equal(sentEmails.length, 2)
  assert.equal(sentEmails[0].template, EMAIL_TEMPLATE_KEYS.TEMPORARY_ACCOUNT)
  assert.equal(sentEmails[1].template, EMAIL_TEMPLATE_KEYS.TEAM_INVITATION)
})
