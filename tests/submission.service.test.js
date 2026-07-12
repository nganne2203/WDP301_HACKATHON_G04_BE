import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createSubmissionService } from '../src/modules/submissions/submission.service.js'

const ids = {
  event: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  round: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  team: 'cccccccccccccccccccccccc',
  repository: 'dddddddddddddddddddddddd',
  submission: 'eeeeeeeeeeeeeeeeeeeeeeee',
  leader: 'ffffffffffffffffffffffff',
  member: '999999999999999999999999',
  board: 'abababababababababababab'
}

const leaderActor = { id: ids.leader, roles: ['PARTICIPANT'] }
const memberActor = { id: ids.member, roles: ['PARTICIPANT'] }
const outsiderActor = { id: '111111111111111111111119', roles: ['PARTICIPANT'] }
const coordinatorActor = { id: '111111111111111111111118', roles: ['COORDINATOR'] }

const getId = (value) => value?._id?.toString?.() || value?.toString?.()

const matchesFilter = (item, filter = {}) => {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(option => matchesFilter(item, option))
    const itemValue = item[key]
    if (value && typeof value === 'object' && Array.isArray(value.$in)) {
      const allowedIds = value.$in.map(getId)
      return Array.isArray(itemValue)
        ? itemValue.some(entry => allowedIds.includes(getId(entry)))
        : allowedIds.includes(getId(itemValue))
    }
    return Array.isArray(itemValue)
      ? itemValue.some(entry => getId(entry) === getId(value))
      : getId(itemValue) === getId(value)
  })
}

const createModel = (items) => ({
  async findById(id) {
    return items.get(id) || null
  },
  async find(filter = {}) {
    return [...items.values()].filter(item => matchesFilter(item, filter))
  },
  async findOne(filter = {}) {
    return [...items.values()].find(item => matchesFilter(item, filter)) || null
  }
})

const createRepositoryModel = (items) => ({
  async findById(id) {
    return items.get(id) || null
  },
  async findOne(filter) {
    return [...items.values()].find(item => {
      return Object.entries(filter).every(([key, value]) => String(item[key]) === String(value))
    }) || null
  }
})

const createSubmissionFixture = ({
  deadlineOffsetMs = 60 * 60 * 1000,
  openOffsetMs = -60 * 60 * 1000,
  roundStatus = 'OPEN',
  assignedTeamIds = [ids.team],
  memberParticipantStatus = 'JOINED',
  notificationService = null
} = {}) => {
  const events = new Map([[ids.event, { _id: ids.event, status: 'ONGOING' }]])
  const rounds = new Map([[
    ids.round,
    {
      _id: ids.round,
      eventId: ids.event,
      status: roundStatus,
      assignedTeamIds,
      submissionOpenAt: new Date(Date.now() + openOffsetMs),
      submissionCloseAt: new Date(Date.now() + deadlineOffsetMs),
      submissionDeadline: new Date(Date.now() + deadlineOffsetMs)
    }
  ]])
  const teams = new Map([[ids.team, {
    _id: ids.team,
    eventId: ids.event,
    name: 'Team Alpha',
    status: 'CONFIRMED',
    leaderId: { _id: ids.leader, email: 'leader@example.com', fullName: 'Leader' },
    memberIds: [{ _id: ids.member, email: 'member@example.com', fullName: 'Member' }]
  }]])
  const participants = new Map([
    ['leader-participant', {
      _id: 'leader-participant',
      eventId: ids.event,
      teamId: ids.team,
      userId: ids.leader,
      status: 'JOINED',
      teamRole: 'LEADER'
    }],
    ['member-participant', {
      _id: 'member-participant',
      eventId: ids.event,
      teamId: ids.team,
      userId: ids.member,
      status: memberParticipantStatus,
      teamRole: 'MEMBER'
    }]
  ])
  const repositories = new Map([[
    ids.repository,
    {
      _id: ids.repository,
      eventId: ids.event,
      teamId: ids.team,
      repositoryFullName: 'seal/team-alpha'
    }
  ]])
  const submissions = new Map()
  const auditLogs = []

  const repository = {
    async findById(id) {
      return submissions.get(id) || null
    },
    async findByRoundAndTeam({ roundId, teamId }) {
      return [...submissions.values()].find(item => item.roundId === roundId && item.teamId === teamId) || null
    },
    async findAll({ filter = {} } = {}) {
      return [...submissions.values()].filter(item => matchesFilter(item, filter))
    },
    async count(filter = {}) {
      return [...submissions.values()].filter(item => matchesFilter(item, filter)).length
    },
    async create(data) {
      const created = { _id: ids.submission, ...data }
      submissions.set(created._id, created)
      return created
    },
    async updateById(id, data) {
      const updated = { ...submissions.get(id), ...data, _id: id }
      submissions.set(id, updated)
      return updated
    }
  }

  return {
    service: createSubmissionService({
      repository,
      auditLogRepository: {
        async create(entry) {
          auditLogs.push(entry)
          return entry
        }
      },
      eventModel: createModel(events),
      roundModel: createModel(rounds),
      teamModel: createModel(teams),
      repositoryModel: createRepositoryModel(repositories),
      boardModel: createModel(new Map()),
      participantModel: createModel(participants),
      notificationService
    }),
    stores: {
      submissions,
      auditLogs
    }
  }
}

test('createSubmission auto-links team repository and submitSubmission sets SUBMITTED', async () => {
  const { service, stores } = createSubmissionFixture()

  const created = await service.createSubmission({
    eventId: ids.event,
    roundId: ids.round,
    teamId: ids.team,
    demoUrl: 'https://example.com/demo'
  }, leaderActor)

  assert.equal(created.repositoryId, ids.repository)
  assert.equal(created.status, 'DRAFT')

  const submitted = await service.submitSubmission(created.id, memberActor)
  assert.equal(submitted.status, 'SUBMITTED')
  assert.equal(Boolean(submitted.submittedAt), true)
  assert.deepEqual(stores.auditLogs.map(item => item.action), [
    'SUBMISSION_CREATED',
    'SUBMISSION_SUBMITTED'
  ])
})

test('submission writes require a JOINED participant membership, not only Team.memberIds', async () => {
  const { service } = createSubmissionFixture({
    memberParticipantStatus: 'WITHDRAWN'
  })

  await assert.rejects(
    () => service.createSubmission({
      eventId: ids.event,
      roundId: ids.round,
      teamId: ids.team,
      demoUrl: 'https://example.com/demo'
    }, memberActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )
})

test('createSubmission rejects when round submission window is not open', async () => {
  const { service } = createSubmissionFixture({
    openOffsetMs: 60 * 1000
  })

  await assert.rejects(
    () => service.createSubmission({
      eventId: ids.event,
      roundId: ids.round,
      teamId: ids.team,
      demoUrl: 'https://example.com/demo'
    }, leaderActor),
    (error) => error instanceof ApiError && error.errors.includes('Submission window has not opened')
  )
})

test('createSubmission rejects when round submission window has closed', async () => {
  const { service } = createSubmissionFixture({
    deadlineOffsetMs: -60 * 1000
  })

  await assert.rejects(
    () => service.createSubmission({
      eventId: ids.event,
      roundId: ids.round,
      teamId: ids.team,
      demoUrl: 'https://example.com/demo'
    }, leaderActor),
    (error) => error instanceof ApiError && error.errors.includes('Submission window has closed')
  )
})

test('createSubmission rejects when round has no assigned teams', async () => {
  const { service } = createSubmissionFixture({
    assignedTeamIds: []
  })

  await assert.rejects(
    () => service.createSubmission({
      eventId: ids.event,
      roundId: ids.round,
      teamId: ids.team,
      demoUrl: 'https://example.com/demo'
    }, leaderActor),
    (error) => error instanceof ApiError && error.errors.includes('Round has no assigned teams')
  )
})

test('participant cannot create or read another team submission', async () => {
  const { service } = createSubmissionFixture()

  await assert.rejects(
    () => service.createSubmission({
      eventId: ids.event,
      roundId: ids.round,
      teamId: ids.team,
      demoUrl: 'https://example.com/demo'
    }, outsiderActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )

  const created = await service.createSubmission({
    eventId: ids.event,
    roundId: ids.round,
    teamId: ids.team,
    demoUrl: 'https://example.com/demo'
  }, leaderActor)

  await assert.rejects(
    () => service.getSubmissionById(created.id, outsiderActor),
    (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
  )
})

test('listSubmissions scopes participant results to their own team', async () => {
  const { service, stores } = createSubmissionFixture()

  stores.submissions.set(ids.submission, {
    _id: ids.submission,
    eventId: ids.event,
    roundId: ids.round,
    teamId: ids.team,
    status: 'SUBMITTED'
  })
  stores.submissions.set('eeeeeeeeeeeeeeeeeeeeeeef', {
    _id: 'eeeeeeeeeeeeeeeeeeeeeeef',
    eventId: ids.event,
    roundId: ids.round,
    teamId: '111111111111111111111117',
    status: 'SUBMITTED'
  })

  const { submissions, pagination } = await service.listSubmissions({ eventId: ids.event }, leaderActor)

  assert.equal(submissions.length, 1)
  assert.equal(submissions[0].teamId, ids.team)
  assert.equal(pagination.totalItems, 1)
})

test('updateSubmissionStatus notifies team when submission is reviewed', async () => {
  const notifications = []
  const { service } = createSubmissionFixture({
    notificationService: {
      notifyUser: async (payload) => {
        notifications.push(payload)
        return { notification: { id: `notification-${notifications.length}` }, email: null, errors: [] }
      }
    }
  })

  const created = await service.createSubmission({
    eventId: ids.event,
    roundId: ids.round,
    teamId: ids.team,
    demoUrl: 'https://example.com/demo',
    status: 'SUBMITTED'
  }, leaderActor)

  const reviewed = await service.updateSubmissionStatus(created.id, 'ACCEPTED', coordinatorActor)

  assert.equal(reviewed.status, 'ACCEPTED')
  assert.equal(notifications.length, 2)
  assert.deepEqual(notifications.map(item => item.user._id), [ids.leader, ids.member])
  assert.equal(notifications[0].type, 'FEEDBACK')
  assert.equal(notifications[0].channels[0], 'IN_APP')
  assert.equal(notifications[0].metadata.targetPath, '/participant/submissions')
})
