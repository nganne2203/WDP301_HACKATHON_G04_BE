import assert from 'node:assert/strict'
import test from 'node:test'

import { WORKSHOP_REPOSITORY } from '../src/modules/workshops/workshop.repository.js'
import { WORKSHOP_SERVICE } from '../src/modules/workshops/workshop.service.js'

const WORKSHOP_ID = '000000000000000000000101'
const AUTHOR_ID = '000000000000000000000201'

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
