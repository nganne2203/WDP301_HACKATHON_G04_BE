import mongoose from 'mongoose'

import { RUBRIC_REPOSITORY } from './rubric.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import Event from '#models/event.model.js'
import Round from '#models/round.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'

const RUBRIC_FIELDS = [
  'eventId',
  'roundId',
  'title',
  'description',
  'totalScore',
  'version',
  'status'
]

const RUBRIC_UPDATE_FIELDS = [
  'title',
  'description',
  'version',
  'status'
]

const normalizeCriterion = (criterion) => {
  if (!criterion) return null
  const plainCriterion = typeof criterion.toObject === 'function'
    ? criterion.toObject({ getters: true, virtuals: false })
    : criterion

  return {
    id: plainCriterion._id?.toString() || plainCriterion.id,
    rubricId: plainCriterion.rubricId?._id?.toString?.() || plainCriterion.rubricId?.toString?.() || plainCriterion.rubricId,
    name: plainCriterion.name,
    description: plainCriterion.description,
    maxScore: plainCriterion.maxScore,
    weight: plainCriterion.weight,
    order: plainCriterion.order,
    judgeOnly: Boolean(plainCriterion.judgeOnly),
    aiSupportForAudit: plainCriterion.aiSupportForAudit !== false,
    aiInstruction: plainCriterion.aiInstruction || null,
    createdAt: plainCriterion.createdAt,
    updatedAt: plainCriterion.updatedAt
  }
}

const normalizeRubric = async (rubric, repository) => {
  if (!rubric) return null
  const plainRubric = typeof rubric.toObject === 'function'
    ? rubric.toObject({ getters: true, virtuals: false })
    : rubric
  const criteria = await repository.findCriteriaByRubricId(plainRubric._id || plainRubric.id)

  return {
    id: plainRubric._id?.toString() || plainRubric.id,
    eventId: plainRubric.eventId?._id?.toString?.() || plainRubric.eventId?.toString?.() || plainRubric.eventId,
    roundId: plainRubric.roundId?._id?.toString?.() || plainRubric.roundId?.toString?.() || plainRubric.roundId || null,
    event: plainRubric.eventId && typeof plainRubric.eventId === 'object'
      ? {
        id: plainRubric.eventId._id?.toString() || plainRubric.eventId.id,
        title: plainRubric.eventId.title,
        status: plainRubric.eventId.status
      }
      : null,
    round: plainRubric.roundId && typeof plainRubric.roundId === 'object'
      ? {
        id: plainRubric.roundId._id?.toString() || plainRubric.roundId.id,
        name: plainRubric.roundId.name,
        roundType: plainRubric.roundId.roundType,
        status: plainRubric.roundId.status
      }
      : null,
    title: plainRubric.title,
    description: plainRubric.description,
    totalScore: plainRubric.totalScore,
    version: plainRubric.version,
    status: plainRubric.status,
    criteria: criteria.map(normalizeCriterion),
    createdAt: plainRubric.createdAt,
    updatedAt: plainRubric.updatedAt
  }
}

const buildRubricFilter = (query = {}) => {
  const filter = {}
  if (query.eventId) filter.eventId = query.eventId
  if (query.roundId) filter.roundId = query.roundId
  if (query.status) filter.status = query.status
  return filter
}

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

export const createRubricService = ({
  repository = RUBRIC_REPOSITORY,
  eventModel = Event,
  roundModel = Round,
  scoreSheetModel = ScoreSheet
} = {}) => {
  const ensureRubricExists = async (id) => {
    ensureObjectId(id, 'rubric id')
    const rubric = await repository.findRubricById(id)
    if (!rubric) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Rubric not found'])
    return rubric
  }

  const ensureCriterionExists = async (id) => {
    ensureObjectId(id, 'criterion id')
    const criterion = await repository.findCriterionById(id)
    if (!criterion) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Criterion not found'])
    return criterion
  }

  const ensureContext = async ({ eventId, roundId = null }) => {
    ensureObjectId(eventId, 'event id')
    const event = await eventModel.findById(eventId)
    if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])

    if (!roundId) return { event, round: null }

    ensureObjectId(roundId, 'round id')
    const round = await roundModel.findById(roundId)
    if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
    if (round.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified event'])
    }

    return { event, round }
  }

  const countScoreSheetsForRubric = async (rubricId) => {
    if (!scoreSheetModel?.countDocuments) return 0
    return await scoreSheetModel.countDocuments({ rubricId })
  }

  const ensureRubricMutable = async (rubric) => {
    const scoreSheetCount = await countScoreSheetsForRubric(rubric._id || rubric.id)
    if (scoreSheetCount > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rubric cannot be changed after score sheets have been created; create a new rubric version instead'])
    }
  }

  const listRubrics = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = buildRubricFilter(query)

    const [rubrics, totalItems] = await Promise.all([
      repository.findRubrics({ filter, skip, limit }),
      repository.countRubrics(filter)
    ])

    return {
      rubrics: await Promise.all(rubrics.map(rubric => normalizeRubric(rubric, repository))),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getRubricById = async (id) => {
    return await normalizeRubric(await ensureRubricExists(id), repository)
  }

  const createRubric = async (payload = {}, actor = {}) => {
    const safePayload = pickSafeFields(payload, RUBRIC_FIELDS)
    await ensureContext({
      eventId: safePayload.eventId,
      roundId: safePayload.roundId
    })

    const rubric = await repository.createRubric({
      ...safePayload,
      createdBy: actor.id || null
    })

    return await normalizeRubric(await repository.findRubricById(rubric._id), repository)
  }

  const updateRubric = async (id, payload = {}) => {
    const existingRubric = await ensureRubricExists(id)
    await ensureRubricMutable(existingRubric)
    const safePayload = pickSafeFields(payload, RUBRIC_UPDATE_FIELDS)

    const updatedRubric = await repository.updateRubricById(existingRubric._id, safePayload)
    return await normalizeRubric(updatedRubric, repository)
  }

  const addCriterion = async (rubricId, payload = {}) => {
    const rubric = await ensureRubricExists(rubricId)
    await ensureRubricMutable(rubric)
    const criteria = await repository.findCriteriaByRubricId(rubricId)
    const criterion = await repository.createCriterion({
      rubricId,
      name: payload.name,
      description: payload.description,
      maxScore: payload.maxScore,
      weight: payload.weight,
      order: payload.order || (criteria.length + 1),
      judgeOnly: Boolean(payload.judgeOnly),
      aiSupportForAudit: payload.aiSupportForAudit !== false,
      aiInstruction: payload.aiInstruction || null
    })

    const updatedCriteria = [...criteria, criterion]
    const totalScore = updatedCriteria.reduce((sum, item) => sum + (item.maxScore || 0), 0)
    await repository.updateRubricById(rubricId, { totalScore })

    return {
      criterion: normalizeCriterion(criterion),
      rubric: await normalizeRubric(await repository.findRubricById(rubricId), repository)
    }
  }

  const updateCriterion = async (rubricId, criterionId, payload = {}) => {
    const rubric = await ensureRubricExists(rubricId)
    await ensureRubricMutable(rubric)
    const criterion = await ensureCriterionExists(criterionId)
    if (criterion.rubricId?.toString() !== rubricId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Criterion does not belong to the specified rubric'])
    }

    const updatedCriterion = await repository.updateCriterionById(criterionId, {
      name: payload.name ?? criterion.name,
      description: payload.description ?? criterion.description,
      maxScore: payload.maxScore ?? criterion.maxScore,
      weight: payload.weight ?? criterion.weight,
      order: payload.order ?? criterion.order,
      judgeOnly: payload.judgeOnly ?? criterion.judgeOnly,
      aiSupportForAudit: payload.aiSupportForAudit ?? criterion.aiSupportForAudit,
      aiInstruction: payload.aiInstruction ?? criterion.aiInstruction
    })

    const criteria = await repository.findCriteriaByRubricId(rubricId)
    const totalScore = criteria.reduce((sum, item) => sum + (item.maxScore || 0), 0)
    await repository.updateRubricById(rubricId, { totalScore })

    return {
      criterion: normalizeCriterion(updatedCriterion),
      rubric: await normalizeRubric(await repository.findRubricById(rubricId), repository)
    }
  }

  const deleteCriterion = async (rubricId, criterionId) => {
    const rubric = await ensureRubricExists(rubricId)
    await ensureRubricMutable(rubric)
    const criterion = await ensureCriterionExists(criterionId)
    if (criterion.rubricId?.toString() !== rubricId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Criterion does not belong to the specified rubric'])
    }

    await repository.deleteCriterionById(criterionId)
    const criteria = await repository.findCriteriaByRubricId(rubricId)
    const totalScore = criteria.reduce((sum, item) => sum + (item.maxScore || 0), 0)
    await repository.updateRubricById(rubricId, { totalScore })

    return {
      deletedCriterionId: criterionId,
      rubric: await normalizeRubric(await repository.findRubricById(rubricId), repository)
    }
  }

  return {
    listRubrics,
    getRubricById,
    createRubric,
    updateRubric,
    addCriterion,
    updateCriterion,
    deleteCriterion
  }
}

export const RUBRIC_SERVICE = {
  ...createRubricService()
}
