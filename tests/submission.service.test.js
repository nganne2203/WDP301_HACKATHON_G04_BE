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
  member: '999999999999999999999999'
}

const createModel = (items) => ({
  async findById(id) {
    return items.get(id) || null
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

const createSubmissionFixture = ({ deadlineOffsetMs = 60 * 60 * 1000, roundStatus = 'OPEN', notificationService = null } = {}) => {
  const events = new Map([[ids.event, { _id: ids.event, status: 'ONGOING' }]])
  const rounds = new Map([[
    ids.round,
    {
      _id: ids.round,
      eventId: ids.event,
      status: roundStatus,
      submissionDeadline: new Date(Date.now() + deadlineOffsetMs)
    }
  ]])
  const teams = new Map([[ids.team, {
    _id: ids.team,
    eventId: ids.event,
    name: 'Team Alpha',
    leaderId: { _id: ids.leader, email: 'leader@example.com', fullName: 'Leader' },
    memberIds: [{ _id: ids.member, email: 'member@example.com', fullName: 'Member' }]
  }]])
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
    async findAll() {
      return [...submissions.values()]
    },
    async count() {
      return submissions.size
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
  })

  assert.equal(created.repositoryId, ids.repository)
  assert.equal(created.status, 'DRAFT')

  const submitted = await service.submitSubmission(created.id)
  assert.equal(submitted.status, 'SUBMITTED')
  assert.equal(Boolean(submitted.submittedAt), true)
  assert.deepEqual(stores.auditLogs.map(item => item.action), [
    'SUBMISSION_CREATED',
    'SUBMISSION_SUBMITTED'
  ])
})

test('submitSubmission rejects when round deadline has passed', async () => {
  const { service } = createSubmissionFixture({
    deadlineOffsetMs: -60 * 1000
  })

  const created = await service.createSubmission({
    eventId: ids.event,
    roundId: ids.round,
    teamId: ids.team,
    demoUrl: 'https://example.com/demo'
  })

  await assert.rejects(
    () => service.submitSubmission(created.id),
    (error) => error instanceof ApiError && error.errors.includes('Submission deadline has passed')
  )
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
  })

  const reviewed = await service.updateSubmissionStatus(created.id, 'ACCEPTED')

  assert.equal(reviewed.status, 'ACCEPTED')
  assert.equal(notifications.length, 2)
  assert.deepEqual(notifications.map(item => item.user._id), [ids.leader, ids.member])
  assert.equal(notifications[0].type, 'FEEDBACK')
  assert.equal(notifications[0].channels[0], 'IN_APP')
  assert.equal(notifications[0].metadata.targetPath, '/participant/submissions')
})
