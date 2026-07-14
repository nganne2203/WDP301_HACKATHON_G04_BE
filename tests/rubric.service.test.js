import assert from 'node:assert/strict'
import test from 'node:test'

import { createRubricService } from '../src/modules/rubrics/rubric.service.js'

const ids = {
  event: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  round: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  rubric: 'cccccccccccccccccccccccc',
  criterion1: 'dddddddddddddddddddddddd',
  criterion2: 'eeeeeeeeeeeeeeeeeeeeeeee'
}

const createModel = (items) => ({
  async findById(id) {
    return items.get(id) || null
  }
})

const countModel = (value) => ({
  async countDocuments() {
    return value
  }
})

test('updateCriterion and deleteCriterion recompute criteria weight total without changing rubric scale', async () => {
  const rubrics = new Map([[
    ids.rubric,
    {
      _id: ids.rubric,
      eventId: ids.event,
      roundId: ids.round,
      title: 'Technical Rubric',
      totalScore: 100,
      status: 'DRAFT'
    }
  ]])
  const criteria = new Map([
    [ids.criterion1, { _id: ids.criterion1, rubricId: ids.rubric, name: 'Correctness', maxScore: 10, weight: 40, order: 1 }],
    [ids.criterion2, { _id: ids.criterion2, rubricId: ids.rubric, name: 'Architecture', maxScore: 20, weight: 60, order: 2 }]
  ])

  const repository = {
    async findRubricById(id) {
      return rubrics.get(id) || null
    },
    async updateRubricById(id, data) {
      const updated = { ...rubrics.get(id), ...data, _id: id }
      rubrics.set(id, updated)
      return updated
    },
    async findCriteriaByRubricId(rubricId) {
      return [...criteria.values()].filter(item => item.rubricId === rubricId).sort((a, b) => a.order - b.order)
    },
    async findCriterionById(id) {
      return criteria.get(id) || null
    },
    async updateCriterionById(id, data) {
      const updated = { ...criteria.get(id), ...data, _id: id }
      criteria.set(id, updated)
      return updated
    },
    async deleteCriterionById(id) {
      const deleted = criteria.get(id) || null
      criteria.delete(id)
      return deleted
    }
  }

  const service = createRubricService({
    repository,
    eventModel: createModel(new Map([[ids.event, { _id: ids.event }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, eventId: ids.event }]])),
    scoreSheetModel: countModel(0)
  })

  const updated = await service.updateCriterion(ids.rubric, ids.criterion2, {
    weight: 50
  })
  assert.equal(updated.rubric.totalScore, 100)
  assert.equal(updated.rubric.criteriaWeightTotal, 90)

  const deleted = await service.deleteCriterion(ids.rubric, ids.criterion1)
  assert.equal(deleted.rubric.totalScore, 100)
  assert.equal(deleted.rubric.criteriaWeightTotal, 50)
  assert.equal(deleted.deletedCriterionId, ids.criterion1)
})

test('active rubric requires criterion weights to match rubric scale', async () => {
  const rubrics = new Map([[
    ids.rubric,
    {
      _id: ids.rubric,
      eventId: ids.event,
      roundId: ids.round,
      title: 'Active Rubric',
      totalScore: 100,
      status: 'ACTIVE'
    }
  ]])
  const criteria = new Map([
    [ids.criterion1, { _id: ids.criterion1, rubricId: ids.rubric, name: 'Correctness', maxScore: 10, weight: 40, order: 1 }],
    [ids.criterion2, { _id: ids.criterion2, rubricId: ids.rubric, name: 'Architecture', maxScore: 20, weight: 60, order: 2 }]
  ])

  const repository = {
    async findRubricById(id) {
      return rubrics.get(id) || null
    },
    async updateRubricById(id, data) {
      const updated = { ...rubrics.get(id), ...data, _id: id }
      rubrics.set(id, updated)
      return updated
    },
    async findCriteriaByRubricId(rubricId) {
      return [...criteria.values()].filter(item => item.rubricId === rubricId).sort((a, b) => a.order - b.order)
    },
    async findCriterionById(id) {
      return criteria.get(id) || null
    },
    async updateCriterionById(id, data) {
      const updated = { ...criteria.get(id), ...data, _id: id }
      criteria.set(id, updated)
      return updated
    },
    async deleteCriterionById(id) {
      const deleted = criteria.get(id) || null
      criteria.delete(id)
      return deleted
    }
  }

  const service = createRubricService({
    repository,
    eventModel: createModel(new Map([[ids.event, { _id: ids.event }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, eventId: ids.event }]])),
    scoreSheetModel: countModel(0)
  })

  await assert.rejects(
    service.updateCriterion(ids.rubric, ids.criterion2, { weight: 50 }),
    error => error instanceof Error &&
      error.errors.includes('Total criterion weight must equal rubric scale 100')
  )
})

test('rubric cannot be created as active before criteria are configured', async () => {
  const repository = {
    async createRubric() {
      throw new Error('should not create active rubric')
    }
  }

  const service = createRubricService({
    repository,
    eventModel: createModel(new Map([[ids.event, { _id: ids.event }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, eventId: ids.event }]])),
    scoreSheetModel: countModel(0)
  })

  await assert.rejects(
    service.createRubric({
      eventId: ids.event,
      roundId: ids.round,
      title: 'Active Rubric',
      totalScore: 100,
      status: 'ACTIVE'
    }),
    error => error instanceof Error &&
      error.errors.includes('Rubric must be created as DRAFT and activated after criteria weights match the scale')
  )
})

test('rubric criteria cannot change after score sheets exist', async () => {
  const rubrics = new Map([[
    ids.rubric,
    {
      _id: ids.rubric,
      eventId: ids.event,
      roundId: ids.round,
      title: 'Locked Rubric',
      totalScore: 30,
      status: 'ACTIVE'
    }
  ]])
  const criteria = new Map([
    [ids.criterion1, { _id: ids.criterion1, rubricId: ids.rubric, name: 'Correctness', maxScore: 10, weight: 1, order: 1 }]
  ])

  const repository = {
    async findRubricById(id) {
      return rubrics.get(id) || null
    },
    async updateRubricById() {
      throw new Error('should not update locked rubric')
    },
    async findCriteriaByRubricId(rubricId) {
      return [...criteria.values()].filter(item => item.rubricId === rubricId)
    },
    async findCriterionById(id) {
      return criteria.get(id) || null
    },
    async updateCriterionById() {
      throw new Error('should not update locked criterion')
    },
    async deleteCriterionById() {
      throw new Error('should not delete locked criterion')
    }
  }

  const service = createRubricService({
    repository,
    eventModel: createModel(new Map([[ids.event, { _id: ids.event }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, eventId: ids.event }]])),
    scoreSheetModel: countModel(1)
  })

  await assert.rejects(
    service.updateCriterion(ids.rubric, ids.criterion1, { maxScore: 8 }),
    error => error instanceof Error &&
      error.errors.includes('Rubric cannot be changed after score sheets have been created; create a new rubric version instead')
  )

  await assert.rejects(
    service.deleteCriterion(ids.rubric, ids.criterion1),
    error => error instanceof Error &&
      error.errors.includes('Rubric cannot be changed after score sheets have been created; create a new rubric version instead')
  )
})
