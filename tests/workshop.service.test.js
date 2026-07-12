import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { WORKSHOP_REPOSITORY } from '../src/modules/workshops/workshop.repository.js'
import { WORKSHOP_SERVICE } from '../src/modules/workshops/workshop.service.js'

const WORKSHOP_ID = '000000000000000000000101'
const AUTHOR_ID = '000000000000000000000201'
const EVENT_ID = '000000000000000000000501'
const OTHER_EVENT_ID = '000000000000000000000502'

const patchRepository = (overrides) => {
  const originals = {}
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = WORKSHOP_REPOSITORY[key]
    WORKSHOP_REPOSITORY[key] = value
  }

  return () => {
    for (const [key, value] of Object.entries(originals)) {
      WORKSHOP_REPOSITORY[key] = value
    }
  }
}

test('listWorkshops scopes participant visibility to joined or open-registration events and escapes search regex', async () => {
  let capturedFilter = null
  const restore = patchRepository({
    findEventIdsForParticipant: async (userId) => {
      assert.equal(userId, AUTHOR_ID)
      return [EVENT_ID]
    },
    findOpenRegistrationEventIds: async () => [OTHER_EVENT_ID],
    findWorkshops: async ({ filter }) => {
      capturedFilter = filter
      return [{
        _id: WORKSHOP_ID,
        eventId: { _id: EVENT_ID, title: 'Joined Event', status: 'ONGOING' },
        title: 'Regex Safety',
        status: 'SCHEDULED',
        startTime: new Date('2026-07-01T08:00:00.000Z'),
        endTime: new Date('2026-07-01T10:00:00.000Z')
      }]
    },
    countWorkshops: async () => 1
  })

  try {
    const result = await WORKSHOP_SERVICE.listWorkshops(
      { search: '[', page: 1, limit: 10 },
      { id: AUTHOR_ID, roles: ['PARTICIPANT'] }
    )

    assert.deepEqual(capturedFilter.eventId.$in, [EVENT_ID, OTHER_EVENT_ID])
    assert.equal(capturedFilter.$or[0].title.test('literal [ search'), true)
    assert.equal(result.workshops.length, 1)
  } finally {
    restore()
  }
})

test('getWorkshopById hides draft workshops from participants', async () => {
  const restore = patchRepository({
    findWorkshopById: async () => ({
      _id: WORKSHOP_ID,
      eventId: { _id: EVENT_ID, title: 'Draft Event', status: 'DRAFT' },
      title: 'Private Workshop',
      status: 'SCHEDULED',
      startTime: new Date('2026-07-01T08:00:00.000Z'),
      endTime: new Date('2026-07-01T10:00:00.000Z')
    })
  })

  try {
    await assert.rejects(
      () => WORKSHOP_SERVICE.getWorkshopById(WORKSHOP_ID, { id: AUTHOR_ID, roles: ['PARTICIPANT'] }),
      (error) => error instanceof ApiError && error.code === 'NOT_FOUND'
    )
  } finally {
    restore()
  }
})

test('createQuestion rejects users who are not joined participants of the workshop event', async () => {
  const restore = patchRepository({
    findWorkshopById: async () => ({
      _id: WORKSHOP_ID,
      eventId: { _id: EVENT_ID, title: 'Joined Event', status: 'ONGOING' },
      title: 'Testing Workshop',
      status: 'LIVE',
      startTime: new Date(Date.now() - 60 * 1000),
      endTime: new Date(Date.now() + 60 * 1000)
    }),
    findJoinedParticipant: async () => null,
    createQuestion: async () => {
      throw new Error('should not create question for an outsider')
    }
  })

  try {
    await assert.rejects(
      () => WORKSHOP_SERVICE.createQuestion(WORKSHOP_ID, { content: 'Can I join?' }, { id: AUTHOR_ID, roles: ['PARTICIPANT'] }),
      (error) => error instanceof ApiError && error.code === 'FORBIDDEN'
    )
  } finally {
    restore()
  }
})

test('voteQuestion rejects votes after question window closes', async () => {
  const restore = patchRepository({
    findQuestionById: async () => ({
      _id: '000000000000000000000601',
      workshopId: WORKSHOP_ID,
      authorId: AUTHOR_ID,
      content: 'Old question',
      voteCount: 0
    }),
    findWorkshopById: async () => ({
      _id: WORKSHOP_ID,
      eventId: { _id: EVENT_ID, title: 'Joined Event', status: 'ONGOING' },
      title: 'Testing Workshop',
      status: 'COMPLETED',
      startTime: new Date('2026-07-01T08:00:00.000Z'),
      endTime: new Date('2026-07-01T10:00:00.000Z')
    }),
    findJoinedParticipant: async () => ({ _id: '000000000000000000000701', eventId: EVENT_ID, userId: AUTHOR_ID, status: 'JOINED' }),
    voteQuestion: async () => {
      throw new Error('should not vote after workshop question window closes')
    }
  })

  try {
    await assert.rejects(
      () => WORKSHOP_SERVICE.voteQuestion('000000000000000000000601', { id: AUTHOR_ID, roles: ['PARTICIPANT'] }),
      (error) => error instanceof ApiError && error.errors.includes('Questions can only be voted before or during the workshop')
    )
  } finally {
    restore()
  }
})

test('listRatings with mine=true returns only the actor rating without insight permission', async () => {
  let capturedFilter = null
  const restore = patchRepository({
    findWorkshopById: async () => ({
      _id: WORKSHOP_ID,
      title: 'Testing Workshop',
      status: 'COMPLETED',
      startTime: new Date('2026-07-01T08:00:00.000Z'),
      endTime: new Date('2026-07-01T10:00:00.000Z')
    }),
    findRatings: async ({ filter }) => {
      capturedFilter = filter
      return [{
        _id: '000000000000000000000301',
        workshopId: WORKSHOP_ID,
        authorId: { _id: AUTHOR_ID, fullName: 'Participant User', email: 'participant@example.com' },
        rating: 5,
        createdAt: new Date('2026-07-01T11:00:00.000Z'),
        updatedAt: new Date('2026-07-01T11:00:00.000Z')
      }]
    },
    countRatings: async () => 1,
    getRatingStats: async () => {
      throw new Error('should not read global rating stats for mine=true')
    }
  })

  try {
    const result = await WORKSHOP_SERVICE.listRatings(
      WORKSHOP_ID,
      { mine: true, page: 1, limit: 10 },
      { id: AUTHOR_ID, permissions: [] }
    )

    assert.deepEqual(capturedFilter, { workshopId: WORKSHOP_ID, authorId: AUTHOR_ID })
    assert.equal(result.ratings.length, 1)
    assert.equal(result.ratings[0].rating, 5)
    assert.deepEqual(result.stats, { averageRating: 5, totalRatings: 1 })
  } finally {
    restore()
  }
})

test('listFeedback with mine=true returns only the actor feedback without insight permission', async () => {
  let capturedFilter = null
  const restore = patchRepository({
    findWorkshopById: async () => ({
      _id: WORKSHOP_ID,
      title: 'Testing Workshop',
      status: 'COMPLETED',
      startTime: new Date('2026-07-01T08:00:00.000Z'),
      endTime: new Date('2026-07-01T10:00:00.000Z')
    }),
    findFeedback: async ({ filter }) => {
      capturedFilter = filter
      return [{
        _id: '000000000000000000000401',
        workshopId: WORKSHOP_ID,
        authorId: { _id: AUTHOR_ID, fullName: 'Participant User', email: 'participant@example.com' },
        comment: 'Great workshop',
        createdAt: new Date('2026-07-01T11:00:00.000Z'),
        updatedAt: new Date('2026-07-01T11:00:00.000Z')
      }]
    },
    countFeedback: async () => 1
  })

  try {
    const result = await WORKSHOP_SERVICE.listFeedback(
      WORKSHOP_ID,
      { mine: true, page: 1, limit: 10 },
      { id: AUTHOR_ID, permissions: [] }
    )

    assert.deepEqual(capturedFilter, { workshopId: WORKSHOP_ID, authorId: AUTHOR_ID })
    assert.equal(result.feedback.length, 1)
    assert.equal(result.feedback[0].comment, 'Great workshop')
  } finally {
    restore()
  }
})
