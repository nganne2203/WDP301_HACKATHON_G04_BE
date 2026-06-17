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

test('createTeam rejects duplicate active participant membership in the same event', async () => {
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'APPROVED' }
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
    findParticipantByEventAndUser: async () => ({
      _id: 'participant-1',
      teamId: 'other-team',
      status: 'ACTIVE'
    }),
    findBlockingInvitation: async () => null
  }

  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({ eventId: 'event-1', name: 'New Team' }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'CONFLICT' &&
      error.errors.includes('User already belongs to another team in this event')
  )
})

test('createTeam enforces event max team size from invited members', async () => {
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'APPROVED' }
  const repository = {
    createSession,
    findEventById: async () => ({
      _id: 'event-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 3,
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
      invitedEmails: ['one@example.com', 'two@example.com', 'three@example.com']
    }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Too many invited members for this event')
  )
})

test('updateTeamStatus confirms a team and auto-assigns the next available placement slot', async () => {
  const event = {
    _id: '000000000000000000000501',
    title: 'SEAL Hackathon',
    status: 'OPEN_REGISTRATION',
    minTeamMembers: 3,
    maxTeamMembers: 5,
    maxTeams: 30,
    competitionConfig: {
      boardCount: 2,
      trackCount: 2,
      maxTeamsPerBoard: 2
    }
  }
  const tracks = [
    { _id: '000000000000000000000601', eventId: '000000000000000000000501', code: 'A', name: 'Board A', maxTeams: 2, status: 'OPEN' },
    { _id: '000000000000000000000602', eventId: '000000000000000000000501', code: 'B', name: 'Board B', maxTeams: 2, status: 'OPEN' }
  ]
  const teamMap = new Map([
    ['000000000000000000000701', {
      _id: '000000000000000000000701',
      eventId: event,
      trackId: null,
      leaderId: { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader' },
      memberIds: [{ _id: 'leader-1' }, { _id: 'member-2' }, { _id: 'member-3' }],
      name: 'Code Wizards',
      status: 'WAITING_FOR_MEMBERS'
    }]
  ])
  const repository = {
    createSession,
    findTeamById: async (id) => teamMap.get(id) || null,
    findEventById: async () => event,
    countTeams: async (filter = {}) => {
      if (filter.trackId === '000000000000000000000601' && filter.status?.$in) return 1
      if (filter.trackId === '000000000000000000000602' && filter.status?.$in) return 0
      if (filter.status?.$in) return 1
      return 0
    },
    updateTeamById: async (id, data) => {
      const existing = teamMap.get(id)
      const updated = { ...existing, ...data, _id: id }
      teamMap.set(id, updated)
      return updated
    },
    findTracksByEvent: async () => tracks,
    findTrackById: async (id) => tracks.find(track => track._id === id) || null,
    findParticipantsByTeam: async () => [],
    findInvitationsByTeam: async () => []
  }

  const service = createTeamService({ repository, logger: createLogger() })

  const result = await service.updateTeamStatus('000000000000000000000701', {
    status: 'CONFIRMED'
  }, {
    id: 'coord-1',
    permissions: ['TEAM_UPDATE']
  })

  assert.equal(result.status, 'CONFIRMED')
  assert.equal(result.trackId, '000000000000000000000602')
  assert.equal(result.boardNumber, 2)
  assert.equal(result.placementSlot, 1)
})

test('updateTeamPlacement rejects manual placement when the selected track is full', async () => {
  const event = {
    _id: '000000000000000000000801',
    title: 'SEAL Hackathon',
    status: 'OPEN_REGISTRATION',
    minTeamMembers: 3,
    maxTeamMembers: 5,
    maxTeams: 30,
    competitionConfig: {
      boardCount: 2,
      trackCount: 2,
      maxTeamsPerBoard: 1
    }
  }
  const tracks = [
    { _id: '000000000000000000000901', eventId: '000000000000000000000801', code: 'A', name: 'Board A', maxTeams: 1, status: 'OPEN' },
    { _id: '000000000000000000000902', eventId: '000000000000000000000801', code: 'B', name: 'Board B', maxTeams: 1, status: 'OPEN' }
  ]
  const repository = {
    createSession,
    findTeamById: async () => ({
      _id: '000000000000000000000903',
      eventId: event,
      trackId: null,
      leaderId: { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader' },
      memberIds: [{ _id: 'leader-1' }, { _id: 'member-2' }, { _id: 'member-3' }],
      name: 'Code Wizards',
      status: 'CONFIRMED'
    }),
    findEventById: async () => event,
    countTeams: async (filter = {}) => {
      if (filter.trackId === '000000000000000000000901' && filter.status?.$in) return 1
      return 0
    },
    updateTeamById: async () => {
      throw new Error('should not update when capacity is full')
    },
    findTracksByEvent: async () => tracks,
    findTrackById: async (id) => tracks.find(track => track._id === id) || null
  }

  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.updateTeamPlacement('000000000000000000000903', {
      trackId: '000000000000000000000901',
      trackAssignmentMethod: 'MANUAL'
    }, {
      id: 'coord-1',
      permissions: ['TEAM_UPDATE']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'CONFLICT' &&
      error.errors.includes('Selected track is full')
  )
})

test('mentor can list only teams assigned to them', async () => {
  const assignedTeam = {
    _id: '000000000000000000000111',
    eventId: { _id: '000000000000000000000211', title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' },
    trackId: { _id: '000000000000000000000311', code: 'WEB', name: 'Web Experience', type: 'PRELIMINARY_GROUP', status: 'OPEN' },
    leaderId: { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader One', status: 'APPROVED' },
    memberIds: [{ _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader One', status: 'APPROVED' }],
    mentorIds: [{ _id: 'mentor-1', email: 'mentor@example.com', fullName: 'Mentor One', status: 'APPROVED' }],
    name: 'Assigned Team',
    chapterName: 'SE',
    projectName: 'Mentored Project',
    status: 'CONFIRMED',
    qualificationStatus: 'REGISTERED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const repository = {
    findTeams: async ({ filter }) => {
      assert.equal(filter.eventId, '000000000000000000000211')
      assert.equal(filter.mentorIds, 'mentor-1')
      return [assignedTeam]
    },
    countTeams: async (filter) => {
      assert.equal(filter.mentorIds, 'mentor-1')
      return 1
    },
    findParticipantsByTeam: async () => [],
    findInvitationsByTeam: async () => []
  }

  const service = createTeamService({ repository, logger: createLogger() })
  const result = await service.listTeams({ eventId: '000000000000000000000211' }, {
    id: 'mentor-1',
    roles: ['MENTOR']
  })

  assert.equal(result.teams.length, 1)
  assert.equal(result.teams[0].name, 'Assigned Team')
  assert.deepEqual(result.teams[0].mentorIds, ['mentor-1'])
})

test('updateTeamStatus rejects actors without team management permission', async () => {
  const service = createTeamService({
    repository: {
      createSession
    },
    logger: createLogger()
  })

  await assert.rejects(
    service.updateTeamStatus('000000000000000000000701', {
      status: 'CONFIRMED'
    }, {
      id: 'user-1',
      roles: ['COORDINATOR'],
      permissions: ['TEAM_VIEW']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'FORBIDDEN' &&
      error.errors.includes('You do not have permission to manage teams')
  )
})
