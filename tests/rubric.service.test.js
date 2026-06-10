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

test('updateCriterion and deleteCriterion recompute rubric totalScore', async () => {
  const rubrics = new Map([[
    ids.rubric,
    {
      _id: ids.rubric,
      eventId: ids.event,
      roundId: ids.round,
      title: 'Technical Rubric',
      totalScore: 30,
      status: 'DRAFT'
    }
  ]])
  const criteria = new Map([
    [ids.criterion1, { _id: ids.criterion1, rubricId: ids.rubric, name: 'Correctness', maxScore: 10, weight: 1, order: 1 }],
    [ids.criterion2, { _id: ids.criterion2, rubricId: ids.rubric, name: 'Architecture', maxScore: 20, weight: 1, order: 2 }]
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
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, eventId: ids.event }]]))
  })

  const updated = await service.updateCriterion(ids.rubric, ids.criterion2, {
    maxScore: 15
  })
  assert.equal(updated.rubric.totalScore, 25)

  const deleted = await service.deleteCriterion(ids.rubric, ids.criterion1)
  assert.equal(deleted.rubric.totalScore, 15)
  assert.equal(deleted.deletedCriterionId, ids.criterion1)
})
