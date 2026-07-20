import assert from 'node:assert/strict'
import test from 'node:test'

import { createRubricService } from '../src/modules/rubrics/rubric.service.js'

const ids = {
  competition: 'aaaaaaaaaaaaaaaaaaaaaaaa',
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

test('updateCriterion and deleteCriterion recompute total weight without changing the configured total', async () => {
  const rubrics = new Map([[
    ids.rubric,
    {
      _id: ids.rubric,
      competitionId: ids.competition,
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
    competitionModel: createModel(new Map([[ids.competition, { _id: ids.competition }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, competitionId: ids.competition }]])),
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

test('active rubric requires criterion weights to match total weight', async () => {
  const rubrics = new Map([[
    ids.rubric,
    {
      _id: ids.rubric,
      competitionId: ids.competition,
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
    competitionModel: createModel(new Map([[ids.competition, { _id: ids.competition }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, competitionId: ids.competition }]])),
    scoreSheetModel: countModel(0)
  })

  await assert.rejects(
    service.updateCriterion(ids.rubric, ids.criterion2, { weight: 50 }),
    error => error instanceof Error &&
      error.errors.includes('Total weight must equal 100')
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
    competitionModel: createModel(new Map([[ids.competition, { _id: ids.competition }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, competitionId: ids.competition }]])),
    scoreSheetModel: countModel(0)
  })

  await assert.rejects(
    service.createRubric({
      competitionId: ids.competition,
      roundId: ids.round,
      title: 'Active Rubric',
      totalScore: 100,
      status: 'ACTIVE'
    }),
    error => error instanceof Error &&
      error.errors.includes('Rubric must be created as DRAFT; configure criterion coefficients before changing its status')
  )
})

test('rubric cannot leave draft until criterion weights equal the total weight', async () => {
  const rubric = {
    _id: ids.rubric,
    competitionId: ids.competition,
    title: 'Incomplete Rubric',
    totalScore: 100,
    criterionMaxScore: 10,
    status: 'DRAFT'
  }
  const repository = {
    async findRubricById() { return rubric },
    async findCriteriaByRubricId() {
      return [{ _id: ids.criterion1, rubricId: ids.rubric, name: 'Correctness', maxScore: 10, weight: 90, order: 1 }]
    },
    async updateRubricById() { throw new Error('should not update an incomplete rubric') }
  }
  const service = createRubricService({ repository, scoreSheetModel: countModel(0) })

  await assert.rejects(
    service.updateRubric(ids.rubric, { status: 'ARCHIVED' }),
    error => error instanceof Error && error.errors.includes('Total weight must equal 100')
  )
})

test('rubric criteria cannot change after score sheets exist', async () => {
  const rubrics = new Map([[
    ids.rubric,
    {
      _id: ids.rubric,
      competitionId: ids.competition,
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
    competitionModel: createModel(new Map([[ids.competition, { _id: ids.competition }]])),
    roundModel: createModel(new Map([[ids.round, { _id: ids.round, competitionId: ids.competition }]])),
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
