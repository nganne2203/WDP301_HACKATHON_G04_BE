import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { createTimelineService } from '../src/modules/timelines/timeline.service.js'

const createRepository = () => {
  const records = new Map()
  let sequence = 1

  return {
    count: async () => records.size,
    findAll: async () => [...records.values()],
    findById: async (id) => records.get(id) || null,
    create: async (data) => {
      const id = String(sequence).padStart(24, '0')
      const record = { ...data, _id: id }
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
    deleteById: async (id) => {
      records.delete(id)
    }
  }
}

const eventService = {
  getRawEventById: async (id) => ({ _id: id, title: 'SEAL Event' })
}

test('createTimeline stores timeline for an existing event', async () => {
  const service = createTimelineService({
    repository: createRepository(),
    eventService
  })

  const timeline = await service.createTimeline({
    eventId: '000000000000000000000101',
    title: 'Registration Window',
    eventType: 'CHECK_IN',
    startTime: '2026-06-01T00:00:00.000Z',
    endTime: '2026-06-02T00:00:00.000Z'
  })

  assert.equal(timeline.title, 'Registration Window')
  assert.equal(timeline.eventId, '000000000000000000000101')
  assert.equal(timeline.eventType, 'CHECK_IN')
})

test('updateTimeline rejects invalid date range', async () => {
  const repository = createRepository()
  const service = createTimelineService({ repository, eventService })

  const created = await service.createTimeline({
    eventId: '000000000000000000000101',
    title: 'Opening Ceremony'
  })

  await assert.rejects(
    service.updateTimeline(created.id, {
      startTime: '2026-06-03T10:00:00.000Z',
      endTime: '2026-06-03T09:00:00.000Z'
    }),
    (error) => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('startTime must be before or equal to endTime')
  )
})
