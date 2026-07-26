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
        { fullName: 'Member One', email: 'Member@Example.com', githubUsername: 'user1' },
        { fullName: 'Duplicate Member', email: 'member@example.com', githubUsername: 'user1' }
      ],
      emails: ['Other@Example.com']
    }),
    [
      { fullName: 'Member One', email: 'member@example.com', githubUsername: 'user1' },
      { fullName: '', email: 'other@example.com', githubUsername: '' }
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
  const baseCompetition = {
    status: 'OPEN_REGISTRATION',
    registrationStart: '2026-05-01T00:00:00.000Z',
    registrationEnd: '2026-06-01T00:00:00.000Z'
  }

  assert.equal(isRegistrationOpen(baseCompetition, now), true)
  assert.equal(isRegistrationOpen({ ...baseCompetition, status: 'DRAFT' }, now), false)
  assert.equal(isRegistrationOpen({ ...baseCompetition, registrationStart: '2026-06-01T00:00:00.000Z' }, now), false)
  assert.equal(isRegistrationOpen({ ...baseCompetition, registrationEnd: '2026-05-01T00:00:00.000Z' }, now), false)
})

test('team invitation templates include required accept, decline, and temporary password content', () => {
  const invitation = renderEmailTemplate(EMAIL_TEMPLATE_KEYS.TEAM_INVITATION, {
    fullName: 'Member User',
    competitionTitle: 'SEAL Hackathon',
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
  assert.match(temporaryAccount.html, /Temporary password/i)
  assert.match(temporaryAccount.html, /Open sign in/i)
  assert.match(temporaryAccount.html, /contact the organizing team/i)
})

test('createTeam rejects duplicate team creation for the same competition leader', async () => {
  const repository = {
    createSession,
    findCompetitionById: async () => ({
      _id: 'competition-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 5,
      maxTeams: 30
    }),
    countTeams: async () => 0,
    findUserById: async () => ({ _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'ACTIVE' }),
    findTeamByLeaderAndCompetition: async () => ({ _id: 'team-1', name: 'Existing Team' })
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({ competitionId: 'competition-1', name: 'New Team' }, { id: 'leader-1' }),
    (error) => error instanceof ApiError && error.code === 'CONFLICT'
  )
})

test('createTeam rejects duplicate team name in the same competition', async () => {
  const repository = {
    createSession,
    findCompetitionById: async () => ({
      _id: 'competition-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 5,
      maxTeams: 30
    }),
    countTeams: async () => 0,
    findUserById: async () => ({ _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'ACTIVE' }),
    findTeamByLeaderAndCompetition: async () => null,
    findTeamByCompetitionAndName: async ({ name }) => ({ _id: 'team-1', name })
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({ competitionId: 'competition-1', name: 'Code Wizards' }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'CONFLICT' &&
      error.errors.includes('Team name already exists in this competition')
  )
})

test('checkTeamAvailability reports duplicate team name and leader for an competition', async () => {
  const competitionId = '000000000000000000000001'
  const repository = {
    findCompetitionById: async () => ({ _id: competitionId, title: 'SEAL Hackathon' }),
    findTeamByCompetitionAndName: async () => ({ _id: 'team-1', name: 'Code Wizards' }),
    findTeamByLeaderAndCompetition: async () => ({ _id: 'team-2', name: 'Leader Team' })
  }
  const service = createTeamService({ repository, logger: createLogger() })

  const result = await service.checkTeamAvailability({
    competitionId,
    name: ' Code Wizards '
  }, { id: 'leader-1' })

  assert.equal(result.available, false)
  assert.equal(result.nameAvailable, false)
  assert.equal(result.leaderAvailable, false)
  assert.deepEqual(result.errors, [
    'Team name already exists in this competition',
    'You already created a team for this competition'
  ])
})

test('createTeam rejects inviting the leader email as a team member', async () => {
  const leader = { _id: 'leader-1', email: 'Leader@Example.com', fullName: 'Leader', status: 'ACTIVE' }
  const repository = {
    createSession,
    findCompetitionById: async () => ({
      _id: 'competition-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 5,
      maxTeams: 30
    }),
    countTeams: async () => 0,
    findUserById: async () => leader,
    findTeamByLeaderAndCompetition: async () => null,
    findTeamByCompetitionAndName: async () => null,
    findParticipantByCompetitionAndUser: async () => null,
    findBlockingInvitation: async () => null
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({
      competitionId: 'competition-1',
      name: 'New Team',
      invitedMembers: [{ fullName: 'Leader Duplicate', email: 'leader@example.com' }]
    }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Team leader cannot invite their own email')
  )
})

test('createTeam sends only invitation email for unknown invitees', async () => {
  const sentEmails = []
  const createdUsers = []
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'ACTIVE' }
  const competition = {
    _id: 'competition-1',
    title: 'SEAL Hackathon',
    status: 'OPEN_REGISTRATION',
    minTeamMembers: 2,
    maxTeamMembers: 5,
    maxTeams: 30
  }
  const team = {
    _id: 'team-1',
    competitionId: competition,
    leaderId: leader,
    memberIds: [leader],
    name: 'Code Wizards',
    status: 'WAITING_FOR_MEMBERS'
  }
  const invitation = {
    _id: 'invitation-1',
    competitionId: 'competition-1',
    teamId: 'team-1',
    leaderId: 'leader-1',
    invitedEmail: 'member@example.com',
    status: 'PENDING',
    metadata: {
      invitedFullName: undefined,
      invitedGithubUsername: undefined
    },
    expiresAt: new Date('2026-06-02T00:00:00.000Z')
  }

  const repository = {
    createSession,
    findCompetitionById: async () => competition,
    countTeams: async () => 0,
    findUserById: async (id) => id === 'leader-1' ? leader : { _id: id, email: 'member@example.com', fullName: 'Member', status: 'ACTIVE' },
    findTeamByLeaderAndCompetition: async () => null,
    findTeamByCompetitionAndName: async () => null,
    findParticipantByCompetitionAndUser: async () => null,
    findBlockingInvitation: async () => null,
    createTeam: async () => team,
    upsertParticipant: async () => ({}),
    findUserByEmail: async () => null,
    createUser: async (data) => {
      createdUsers.push(data)
      return { _id: 'member-1', email: data.email, fullName: data.fullName, status: 'ACTIVE' }
    },
    createInvitation: async () => invitation,
    findTeamById: async () => team,
    findParticipantsByTeam: async () => [{
      _id: 'participant-1',
      competitionId: 'competition-1',
      teamId: 'team-1',
      userId: leader,
      teamRole: 'LEADER',
      status: 'JOINED'
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
    competitionId: 'competition-1',
    name: 'Code Wizards',
    invitedEmails: ['member@example.com']
  }, { id: 'leader-1' })

  assert.equal(result.name, 'Code Wizards')
  assert.equal(createdUsers.length, 0)
  assert.equal(sentEmails.length, 1)
  assert.equal(sentEmails[0].template, EMAIL_TEMPLATE_KEYS.TEAM_INVITATION)
})

test('acceptInvitation creates account and sends temporary account email for unknown invitee', async () => {
  const sentEmails = []
  const notifications = []
  const createdUsers = []
  const token = createInvitationToken()
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'ACTIVE' }
  const competition = {
    _id: 'competition-1',
    title: 'SEAL Hackathon',
    status: 'OPEN_REGISTRATION',
    minTeamMembers: 2,
    maxTeamMembers: 5,
    maxTeams: 30
  }
  let createdUser = null
  let team = {
    _id: 'team-1',
    competitionId: competition,
    leaderId: leader,
    memberIds: [leader],
    name: 'Code Wizards',
    status: 'WAITING_FOR_MEMBERS'
  }
  let invitation = {
    _id: 'invitation-1',
    competitionId: 'competition-1',
    teamId: 'team-1',
    leaderId: 'leader-1',
    invitedEmail: 'member@example.com',
    tokenHash: hashInvitationToken(token),
    status: 'PENDING',
    metadata: {
      invitedFullName: 'Member User'
    },
    expiresAt: new Date('2099-06-02T00:00:00.000Z')
  }

  const repository = {
    createSession,
    findInvitationByTokenHash: async (tokenHash) => tokenHash === invitation.tokenHash ? invitation : null,
    findTeamById: async () => team,
    findCompetitionById: async () => competition,
    countTeams: async () => 0,
    findUserByEmail: async () => null,
    findRoleByName: async () => ({ _id: 'role-user' }),
    createUser: async (data) => {
      createdUsers.push(data)
      createdUser = {
        _id: 'member-1',
        email: data.email,
        fullName: data.fullName,
        githubUsername: data.githubUsername,
        status: data.status,
        mustChangePassword: data.mustChangePassword
      }
      return createdUser
    },
    findParticipantByCompetitionAndUser: async () => null,
    findBlockingInvitation: async () => null,
    findTracksByCompetition: async () => [],
    upsertParticipant: async () => ({}),
    updateTeamById: async (id, data) => {
      if (data.$addToSet?.memberIds) {
        team = {
          ...team,
          memberIds: [leader, createdUser]
        }
        return team
      }

      team = { ...team, ...data, _id: id }
      return team
    },
    updateInvitationById: async (id, data) => {
      invitation = { ...invitation, ...data, _id: id }
      return invitation
    },
    findParticipantsByTeam: async () => [{
      _id: 'participant-1',
      competitionId: 'competition-1',
      teamId: 'team-1',
      userId: leader,
      teamRole: 'LEADER',
      status: 'JOINED'
    }, {
      _id: 'participant-2',
      competitionId: 'competition-1',
      teamId: 'team-1',
      userId: createdUser,
      teamRole: 'MEMBER',
      status: 'JOINED'
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
      notifyUser: async (payload) => {
        notifications.push(payload)
        return { notification: null, email: null, errors: [] }
      }
    },
    logger: createLogger()
  })

  const result = await service.acceptInvitation(token)

  assert.equal(result.status, 'ACCEPTED')
  assert.equal(createdUsers.length, 1)
  assert.equal(createdUsers[0].email, 'member@example.com')
  assert.equal(createdUsers[0].fullName, 'Member User')
  assert.equal(createdUsers[0].status, 'ACTIVE')
  assert.equal(createdUsers[0].mustChangePassword, true)
  assert.equal(invitation.invitedUserId, 'member-1')
  assert.equal(team.status, 'CONFIRMED')
  assert.equal(team.trackId, null)
  assert.equal(team.boardNumber, null)
  assert.equal(team.placementSlot, null)
  assert.equal(sentEmails.length, 1)
  assert.equal(sentEmails[0].template, EMAIL_TEMPLATE_KEYS.TEMPORARY_ACCOUNT)
  assert.equal(sentEmails[0].to, 'member@example.com')
  assert.equal(sentEmails[0].context.temporaryPassword, process.env.TEAM_INVITATION_TEMP_PASSWORD || 'test')
  assert.equal(notifications.length, 1)
  assert.deepEqual(notifications[0].channels, ['IN_APP'])
})

test('acceptInvitation confirms team without placement when competition has no tracks configured', async () => {
  const token = createInvitationToken()
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'ACTIVE' }
  const member = {
    _id: 'member-1',
    email: 'member@example.com',
    fullName: 'Member User',
    status: 'ACTIVE',
    roles: [{ name: 'PARTICIPANT' }]
  }
  const competition = {
    _id: 'competition-1',
    title: 'SEAL Hackathon',
    status: 'OPEN_REGISTRATION',
    minTeamMembers: 2,
    maxTeamMembers: 5,
    maxTeams: 30
  }
  let team = {
    _id: 'team-1',
    competitionId: competition,
    leaderId: leader,
    memberIds: [leader],
    name: 'Code Wizards',
    status: 'WAITING_FOR_MEMBERS'
  }
  let invitation = {
    _id: 'invitation-1',
    competitionId: 'competition-1',
    teamId: 'team-1',
    leaderId: 'leader-1',
    invitedEmail: 'member@example.com',
    invitedUserId: 'member-1',
    tokenHash: hashInvitationToken(token),
    status: 'PENDING',
    expiresAt: new Date('2099-06-02T00:00:00.000Z')
  }

  const repository = {
    createSession,
    findInvitationByTokenHash: async (tokenHash) => tokenHash === invitation.tokenHash ? invitation : null,
    findTeamById: async () => team,
    findCompetitionById: async () => competition,
    countTeams: async () => 0,
    findUserById: async (id) => id === member._id ? member : leader,
    findParticipantByCompetitionAndUser: async () => null,
    findBlockingInvitation: async () => null,
    upsertParticipant: async () => ({}),
    updateTeamById: async (id, data) => {
      if (data.$addToSet?.memberIds) {
        team = {
          ...team,
          memberIds: [leader, member]
        }
        return team
      }

      team = { ...team, ...data, _id: id }
      return team
    },
    updateInvitationById: async (id, data) => {
      invitation = { ...invitation, ...data, _id: id }
      return invitation
    },
    findTracksByCompetition: async () => [],
    findParticipantsByTeam: async () => [{
      _id: 'participant-1',
      competitionId: 'competition-1',
      teamId: 'team-1',
      userId: leader,
      teamRole: 'LEADER',
      status: 'JOINED'
    }, {
      _id: 'participant-2',
      competitionId: 'competition-1',
      teamId: 'team-1',
      userId: member,
      teamRole: 'MEMBER',
      status: 'JOINED'
    }],
    findInvitationsByTeam: async () => [invitation]
  }

  const service = createTeamService({
    repository,
    notificationService: {
      notifyUser: async () => ({ notification: null, email: null, errors: [] })
    },
    logger: createLogger()
  })

  const result = await service.acceptInvitation(token)

  assert.equal(result.status, 'ACCEPTED')
  assert.equal(result.team.status, 'CONFIRMED')
  assert.equal(result.team.trackId, undefined)
  assert.equal(result.team.placementSlot, null)
  assert.equal(invitation.invitedUserId, 'member-1')
})

test('createTeam rejects duplicate active participant membership in the same competition', async () => {
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'ACTIVE' }
  const repository = {
    createSession,
    findCompetitionById: async () => ({
      _id: 'competition-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 5,
      maxTeams: 30
    }),
    countTeams: async () => 0,
    findUserById: async () => leader,
    findTeamByLeaderAndCompetition: async () => null,
    findTeamByCompetitionAndName: async () => null,
    findParticipantByCompetitionAndUser: async () => ({
      _id: 'participant-1',
      teamId: 'other-team',
      status: 'JOINED'
    }),
    findBlockingInvitation: async () => null
  }

  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({ competitionId: 'competition-1', name: 'New Team' }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'CONFLICT' &&
      error.errors.includes('User already belongs to another team in this competition')
  )
})

test('createTeam enforces competition max team size from invited members', async () => {
  const leader = { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader', status: 'ACTIVE' }
  const repository = {
    createSession,
    findCompetitionById: async () => ({
      _id: 'competition-1',
      title: 'SEAL Hackathon',
      status: 'OPEN_REGISTRATION',
      minTeamMembers: 3,
      maxTeamMembers: 3,
      maxTeams: 30
    }),
    countTeams: async () => 0,
    findUserById: async () => leader,
    findTeamByLeaderAndCompetition: async () => null,
    findTeamByCompetitionAndName: async () => null,
    findParticipantByCompetitionAndUser: async () => null,
    findBlockingInvitation: async () => null
  }

  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({
      competitionId: 'competition-1',
      name: 'New Team',
      invitedEmails: ['one@example.com', 'two@example.com', 'three@example.com']
    }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Too many invited members for this competition')
  )
})

test('createTeam auto-closes registration when confirmed team capacity is already reached', async () => {
  const competition = {
    _id: 'competition-1',
    title: 'SEAL Hackathon',
    status: 'OPEN_REGISTRATION',
    minTeamMembers: 3,
    maxTeamMembers: 5,
    maxTeams: 2
  }
  const updates = []
  const repository = {
    createSession,
    findCompetitionById: async () => competition,
    countTeams: async () => 2,
    updateCompetitionById: async (id, data) => {
      updates.push({ id, data })
      return { ...competition, ...data, _id: id }
    }
  }

  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.createTeam({ competitionId: 'competition-1', name: 'Late Team' }, { id: 'leader-1' }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Competition registration is not open')
  )

  assert.equal(updates.length, 1)
  assert.equal(updates[0].data.status, 'REGISTRATION_CLOSED')
  assert.equal(updates[0].data.registrationCloseReason, 'CAPACITY_REACHED')
})

test('rejectUnconfirmedTeamsForRegistrationClosure rejects open teams and cancels pending invites', async () => {
  const notifications = []
  const competition = {
    _id: '000000000000000000000301',
    title: 'SEAL Hackathon',
    status: 'REGISTRATION_CLOSED'
  }
  const leader = { _id: '000000000000000000000401', email: 'leader@example.com', fullName: 'Leader' }
  const member = { _id: '000000000000000000000402', email: 'member@example.com', fullName: 'Member' }
  const team = {
    _id: '000000000000000000000501',
    competitionId: competition,
    leaderId: leader,
    memberIds: [leader],
    name: 'Pending Team',
    status: 'WAITING_FOR_MEMBERS'
  }
  const updatedTeams = []
  const invitationUpdates = []
  const repository = {
    createSession,
    findTeams: async ({ filter }) => {
      assert.equal(filter.competitionId, competition._id)
      assert.deepEqual(filter.status.$in, ['WAITING_FOR_MEMBERS', 'WAITLISTED'])
      return [team]
    },
    updateTeamById: async (id, data) => {
      updatedTeams.push({ id, data })
      return { ...team, ...data, _id: id }
    },
    updateInvitations: async (filter, data) => {
      invitationUpdates.push({ filter, data })
      return { modifiedCount: 1 }
    },
    findParticipantsByTeam: async () => [{
      _id: 'participant-1',
      userId: member,
      teamRole: 'MEMBER',
      status: 'INVITED'
    }]
  }
  const service = createTeamService({
    repository,
    notificationService: {
      notifyUser: async (payload) => {
        notifications.push(payload)
        return { notification: null, email: null, errors: [] }
      }
    },
    logger: createLogger()
  })

  const result = await service.rejectUnconfirmedTeamsForRegistrationClosure({
    competition,
    reason: 'Registration has closed before this team was fully confirmed.'
  })

  assert.equal(result.rejectedCount, 1)
  assert.equal(updatedTeams.length, 1)
  assert.equal(updatedTeams[0].data.status, 'REJECTED')
  assert.equal(updatedTeams[0].data.rejectionReason, 'Registration has closed before this team was fully confirmed.')
  assert.equal(invitationUpdates.length, 1)
  assert.equal(invitationUpdates[0].filter.teamId, team._id)
  assert.equal(invitationUpdates[0].filter.status, 'PENDING')
  assert.equal(invitationUpdates[0].data.status, 'CANCELLED')
  assert.equal(notifications.length, 2)
  assert.equal(notifications[0].emailContext.rejectionReason, 'Registration has closed before this team was fully confirmed.')
})

test('updateTeamStatus confirms a team and auto-assigns the next available placement slot', async () => {
  const competition = {
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
    { _id: '000000000000000000000601', competitionId: '000000000000000000000501', code: 'A', name: 'Board A', maxTeams: 2, status: 'OPEN' },
    { _id: '000000000000000000000602', competitionId: '000000000000000000000501', code: 'B', name: 'Board B', maxTeams: 2, status: 'OPEN' }
  ]
  const teamMap = new Map([
    ['000000000000000000000701', {
      _id: '000000000000000000000701',
      competitionId: competition,
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
    findCompetitionById: async () => competition,
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
    findTracksByCompetition: async () => tracks,
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
  const competition = {
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
    { _id: '000000000000000000000901', competitionId: '000000000000000000000801', code: 'A', name: 'Board A', maxTeams: 1, status: 'OPEN' },
    { _id: '000000000000000000000902', competitionId: '000000000000000000000801', code: 'B', name: 'Board B', maxTeams: 1, status: 'OPEN' }
  ]
  const repository = {
    createSession,
    findTeamById: async () => ({
      _id: '000000000000000000000903',
      competitionId: competition,
      trackId: null,
      leaderId: { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader' },
      memberIds: [{ _id: 'leader-1' }, { _id: 'member-2' }, { _id: 'member-3' }],
      name: 'Code Wizards',
      status: 'CONFIRMED'
    }),
    findCompetitionById: async () => competition,
    countTeams: async (filter = {}) => {
      if (filter.trackId === '000000000000000000000901' && filter.status?.$in) return 1
      return 0
    },
    updateTeamById: async () => {
      throw new Error('should not update when capacity is full')
    },
    findTracksByCompetition: async () => tracks,
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
    competitionId: { _id: '000000000000000000000211', title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' },
    trackId: { _id: '000000000000000000000311', code: 'WEB', name: 'Web Experience', type: 'PRELIMINARY_GROUP', status: 'OPEN' },
    leaderId: { _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader One', status: 'ACTIVE' },
    memberIds: [{ _id: 'leader-1', email: 'leader@example.com', fullName: 'Leader One', status: 'ACTIVE' }],
    mentorIds: [{ _id: 'mentor-1', email: 'mentor@example.com', fullName: 'Mentor One', status: 'ACTIVE' }],
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
      assert.equal(filter.competitionId, '000000000000000000000211')
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
  const result = await service.listTeams({ competitionId: '000000000000000000000211' }, {
    id: 'mentor-1',
    roles: ['MENTOR']
  })

  assert.equal(result.teams.length, 1)
  assert.equal(result.teams[0].name, 'Assigned Team')
  assert.deepEqual(result.teams[0].mentorIds, ['mentor-1'])
})

test('assignMentorsByBoard updates every team in the selected board', async () => {
  const competitionId = '000000000000000000000211'
  const boardNumber = 2
  const mentorA = { _id: '000000000000000000000901', email: 'mentor.a@example.com', fullName: 'Mentor A', status: 'ACTIVE', roles: [{ name: 'MENTOR' }] }
  const mentorB = { _id: '000000000000000000000902', email: 'mentor.b@example.com', fullName: 'Mentor B', status: 'ACTIVE', roles: [{ name: 'MENTOR' }] }
  const participantsByTeam = {
    '000000000000000000000111': [
      {
        _id: '000000000000000000001111',
        competitionId,
        teamId: '000000000000000000000111',
        userId: { _id: '000000000000000000000301', email: 'leader1@example.com', fullName: 'Leader One', status: 'ACTIVE' },
        teamRole: 'LEADER',
        status: 'JOINED'
      },
      {
        _id: '000000000000000000001112',
        competitionId,
        teamId: '000000000000000000000111',
        userId: { _id: '000000000000000000000302', email: 'member1@example.com', fullName: 'Member One', status: 'ACTIVE' },
        teamRole: 'MEMBER',
        status: 'JOINED'
      }
    ],
    '000000000000000000000112': [
      {
        _id: '000000000000000000001113',
        competitionId,
        teamId: '000000000000000000000112',
        userId: { _id: '000000000000000000000303', email: 'leader2@example.com', fullName: 'Leader Two', status: 'ACTIVE' },
        teamRole: 'LEADER',
        status: 'JOINED'
      }
    ]
  }
  const teams = [
    {
      _id: '000000000000000000000111',
      competitionId: { _id: competitionId, title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' },
      trackId: null,
      leaderId: { _id: 'leader-1', email: 'leader1@example.com', fullName: 'Leader One', status: 'ACTIVE' },
      memberIds: [],
      mentorIds: [{ _id: '000000000000000000000903', email: 'legacy@example.com', fullName: 'Legacy Mentor', status: 'ACTIVE', roles: [{ name: 'MENTOR' }] }],
      name: 'Board Two Alpha',
      boardNumber,
      participants: [],
      invitations: [],
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: '000000000000000000000112',
      competitionId: { _id: competitionId, title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' },
      trackId: null,
      leaderId: { _id: 'leader-2', email: 'leader2@example.com', fullName: 'Leader Two', status: 'ACTIVE' },
      memberIds: [],
      mentorIds: [],
      name: 'Board Two Beta',
      boardNumber,
      participants: [],
      invitations: [],
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: '000000000000000000000113',
      competitionId: { _id: competitionId, title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' },
      trackId: null,
      leaderId: { _id: 'leader-3', email: 'leader3@example.com', fullName: 'Leader Three', status: 'ACTIVE' },
      memberIds: [],
      mentorIds: [],
      name: 'Cancelled Board Team',
      boardNumber,
      participants: [],
      invitations: [],
      status: 'CANCELLED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  const updatedTeamsById = new Map()
  const notifications = []
  const repository = {
    createSession,
    findCompetitionById: async (id) => id === competitionId ? { _id: competitionId, title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' } : null,
    findUsersByIds: async (ids) => ids.map((id) => (id === mentorA._id ? mentorA : mentorB)),
    findTeams: async ({ filter }) => {
      assert.equal(filter.competitionId, competitionId)
      assert.equal(filter.boardNumber, boardNumber)
      assert.equal(filter.status, 'CONFIRMED')
      return teams.filter((team) => team.status === filter.status)
    },
    updateTeamById: async (id, data) => {
      const source = teams.find((team) => team._id === id)
      const nextMentors = data.mentorIds.map((mentorId) => (mentorId === mentorA._id ? mentorA : mentorB))
      const updated = {
        ...source,
        mentorIds: nextMentors
      }
      updatedTeamsById.set(id, updated)
      return updated
    },
    findParticipantsByTeam: async (teamId) => participantsByTeam[teamId] || [],
    findInvitationsByTeam: async () => []
  }
  const notificationService = {
    notifyUser: async (payload) => {
      notifications.push(payload)
      return payload
    }
  }

  const service = createTeamService({
    repository,
    notificationService,
    assignmentNotificationsEnabled: true,
    logger: createLogger()
  })
  const result = await service.assignMentorsByBoard({
    competitionId,
    boardNumber,
    mentorIds: [mentorA._id, mentorB._id]
  }, {
    id: 'coord-1',
    permissions: ['TEAM_UPDATE']
  })

  assert.equal(result.updatedCount, 2)
  assert.deepEqual(result.mentorIds, [mentorA._id, mentorB._id])
  assert.deepEqual(result.teamIds, ['000000000000000000000111', '000000000000000000000112'])
  assert.equal(result.audit.teamDiffs.length, 2)
  assert.deepEqual(result.teams[0].mentorIds, [mentorA._id, mentorB._id])
  assert.deepEqual(result.teams[1].mentorIds, [mentorA._id, mentorB._id])
  assert.deepEqual(updatedTeamsById.get('000000000000000000000111').mentorIds.map((mentor) => mentor._id), [mentorA._id, mentorB._id])
  assert.equal(notifications.length, 5)
  assert.equal(notifications.filter(notification => notification.metadata.action === 'MENTOR_BOARD_ASSIGNED').length, 2)
  assert.equal(notifications.filter(notification => notification.metadata.action === 'TEAM_MENTORS_ASSIGNED').length, 3)
  assert.equal(new Set(notifications.map(notification => notification.dedupeKey)).size, notifications.length)
})

test('updateTeamMentors rejects teams that are not confirmed', async () => {
  const teamId = '000000000000000000000113'
  const repository = {
    createSession,
    findTeamById: async () => ({ _id: teamId, status: 'CANCELLED', mentorIds: [] })
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.updateTeamMentors(teamId, { mentorIds: [] }, {
      id: 'coord-1',
      permissions: ['TEAM_UPDATE']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Mentors can only be assigned to confirmed teams')
  )
})

test('mentor assignment rejects completed competitions', async () => {
  const teamId = '000000000000000000000113'
  const competitionId = '000000000000000000000211'
  const completedCompetition = { _id: competitionId, title: 'Completed Competition', status: 'COMPLETED' }
  const repository = {
    createSession,
    findCompetitionById: async () => completedCompetition,
    findTeamById: async () => ({
      _id: teamId,
      competitionId: completedCompetition,
      status: 'CONFIRMED',
      mentorIds: []
    }),
    findUsersByIds: async () => {
      throw new Error('should not validate mentors for a completed competition')
    }
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.updateTeamMentors(teamId, { mentorIds: [] }, {
      id: 'coord-1',
      permissions: ['TEAM_UPDATE']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Mentor assignments cannot be changed after the competition has been completed or archived')
  )

  await assert.rejects(
    service.assignMentorsByBoard({
      competitionId,
      boardNumber: 1,
      mentorIds: []
    }, {
      id: 'coord-1',
      permissions: ['TEAM_UPDATE']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Mentor assignments cannot be changed after the competition has been completed or archived')
  )
})

test('assignMentorsByBoard accepts active mentor accounts and rejects inaccessible statuses', async () => {
  const competitionId = '000000000000000000000211'
  const repository = {
    createSession,
    findCompetitionById: async () => ({ _id: competitionId, title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' }),
    findUsersByIds: async () => [{ _id: '000000000000000000000901', email: 'mentor@example.com', fullName: 'Mentor', status: 'SUSPENDED', roles: [{ name: 'MENTOR' }] }]
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.assignMentorsByBoard({
      competitionId,
      boardNumber: 1,
      mentorIds: ['000000000000000000000901']
    }, {
      id: 'coord-1',
      permissions: ['TEAM_UPDATE']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Mentor Mentor must be ACTIVE')
  )
})

test('assignMentorsByBoard rejects empty boards', async () => {
  const competitionId = '000000000000000000000211'
  const mentor = { _id: '000000000000000000000901', email: 'mentor@example.com', fullName: 'Mentor', status: 'ACTIVE', roles: [{ name: 'MENTOR' }] }
  const repository = {
    createSession,
    findCompetitionById: async () => ({ _id: competitionId, title: 'SEAL Runtime Sandbox', status: 'OPEN_REGISTRATION' }),
    findUsersByIds: async () => [mentor],
    findTeams: async () => []
  }
  const service = createTeamService({ repository, logger: createLogger() })

  await assert.rejects(
    service.assignMentorsByBoard({
      competitionId,
      boardNumber: 9,
      mentorIds: [mentor._id]
    }, {
      id: 'coord-1',
      permissions: ['TEAM_UPDATE']
    }),
    (error) => error instanceof ApiError &&
      error.code === 'NOT_FOUND' &&
      error.errors.includes('No teams found for board 9')
  )
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
