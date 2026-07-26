import mongoose from 'mongoose'

import { RUBRIC_REPOSITORY } from './rubric.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import Competition from '#models/competition.model.js'
import Round from '#models/round.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'
import {
  ALLOWED_SCORING_COEFFICIENTS,
  ALLOWED_TOTAL_WEIGHTS,
  getRubricTotalWeight,
  isAllowedScoringCoefficient,
  roundToTwoDecimals,
  sumCriterionWeights
} from '#utils/scoringScale.js'

const RUBRIC_FIELDS = [
  'competitionId',
  'roundId',
  'title',
  'description',
  'totalScore',
  'criterionMaxScore',
  'status'
]

const RUBRIC_UPDATE_FIELDS = [
  'title',
  'description',
  'totalScore',
  'criterionMaxScore',
  'status'
]

const RUBRIC_LOCKED_COMPETITION_STATUSES = new Set(['COMPLETED', 'ARCHIVED'])

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
    maxScore: roundToTwoDecimals(plainCriterion.maxScore),
    weight: roundToTwoDecimals(plainCriterion.weight),
    order: plainCriterion.order,
    judgeOnly: Boolean(plainCriterion.judgeOnly),
    aiSupportForAudit: Boolean(plainCriterion.aiSupportForAudit),
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
    competitionId: plainRubric.competitionId?._id?.toString?.() || plainRubric.competitionId?.toString?.() || plainRubric.competitionId,
    roundId: plainRubric.roundId?._id?.toString?.() || plainRubric.roundId?.toString?.() || plainRubric.roundId || null,
    competition: plainRubric.competitionId && typeof plainRubric.competitionId === 'object'
      ? {
        id: plainRubric.competitionId._id?.toString() || plainRubric.competitionId.id,
        title: plainRubric.competitionId.title,
        status: plainRubric.competitionId.status
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
    criterionMaxScore: plainRubric.criterionMaxScore || 10,
    criteriaWeightTotal: sumCriterionWeights(criteria),
    status: plainRubric.status,
    criteria: criteria.map(normalizeCriterion),
    createdAt: plainRubric.createdAt,
    updatedAt: plainRubric.updatedAt
  }
}

const buildRubricFilter = (query = {}) => {
  const filter = {}
  if (query.competitionId) filter.competitionId = query.competitionId
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
  competitionModel = Competition,
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

  const ensureContext = async ({ competitionId, roundId = null }) => {
    ensureObjectId(competitionId, 'competition id')
    const competition = await competitionModel.findById(competitionId)
    if (!competition) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
    if (RUBRIC_LOCKED_COMPETITION_STATUSES.has(String(competition.status || '').toUpperCase())) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rubrics cannot be changed after the competition has been completed'])
    }

    if (!roundId) return { competition, round: null }

    ensureObjectId(roundId, 'round id')
    const round = await roundModel.findById(roundId)
    if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
    if (round.competitionId?.toString() !== competitionId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified competition'])
    }

    return { competition, round }
  }

  const countScoreSheetsForRubric = async (rubricId) => {
    if (!scoreSheetModel?.countDocuments) return 0
    return await scoreSheetModel.countDocuments({ rubricId })
  }

  const getRubricCompetitionStatus = async (rubric) => {
    const competitionRef = rubric?.competitionId
    if (competitionRef && typeof competitionRef === 'object' && competitionRef.status) {
      return competitionRef.status
    }

    const competitionId = competitionRef?._id?.toString?.() || competitionRef?.toString?.()
    if (!competitionId || !competitionModel?.findById) return null

    const query = competitionModel.findById(competitionId)
    const competition = typeof query?.select === 'function'
      ? await query.select('status')
      : await query
    return competition?.status || null
  }

  const ensureRubricMutable = async (rubric) => {
    const competitionStatus = await getRubricCompetitionStatus(rubric)
    if (RUBRIC_LOCKED_COMPETITION_STATUSES.has(String(competitionStatus || '').toUpperCase())) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rubrics cannot be changed after the competition has been completed'])
    }

    const scoreSheetCount = await countScoreSheetsForRubric(rubric._id || rubric.id)
    if (scoreSheetCount > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rubric cannot be changed after score sheets have been created; create a new rubric instead'])
    }
  }

  const ensureCriterionNumbers = (criterion = {}) => {
    const maxScore = Number(criterion.maxScore)
    const weight = Number(criterion.weight)

    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Criterion maxScore must be greater than zero'])
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Criterion weight must be greater than zero'])
    }
    if (!Number.isInteger(maxScore) || !Number.isInteger(weight)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Criterion scoring coefficient and weight must be integers'])
    }
  }

  const ensureRubricScale = (rubric = {}) => {
    const scale = getRubricTotalWeight(rubric)
    if (!scale) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Rubric totalScore must be one of ${ALLOWED_TOTAL_WEIGHTS.join(', ')}`])
    }
    return scale
  }

  const ensureScoringCoefficient = (value) => {
    if (!isAllowedScoringCoefficient(value)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Rubric criterionMaxScore must be one of ${ALLOWED_SCORING_COEFFICIENTS.join(', ')}`])
    }
  }

  const ensureCriteriaFitRubricScale = ({ rubric, criteria = [], requireExact = false }) => {
    const scale = ensureRubricScale(rubric)
    const totalWeight = sumCriterionWeights(criteria)

    if (totalWeight > scale) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Total weight cannot exceed ${scale}`])
    }

    if (requireExact && totalWeight !== scale) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Total weight must equal ${scale}`])
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
    safePayload.totalScore = safePayload.totalScore ?? 100
    safePayload.criterionMaxScore = safePayload.criterionMaxScore ?? 10
    ensureRubricScale({ totalScore: safePayload.totalScore })
    ensureScoringCoefficient(safePayload.criterionMaxScore)
    if (safePayload.status !== 'DRAFT') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rubric must be created as DRAFT; configure criterion coefficients before changing its status'])
    }
    await ensureContext({
      competitionId: safePayload.competitionId,
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
    const existingRubricPlain = typeof existingRubric.toObject === 'function'
      ? existingRubric.toObject({ getters: true, virtuals: false })
      : existingRubric
    const candidateRubric = {
      ...existingRubricPlain,
      ...safePayload
    }
    ensureScoringCoefficient(candidateRubric.criterionMaxScore)
    ensureCriteriaFitRubricScale({
      rubric: candidateRubric,
      criteria: await repository.findCriteriaByRubricId(existingRubric._id || existingRubric.id),
      requireExact: candidateRubric.status !== 'DRAFT'
    })

    const updatedRubric = await repository.updateRubricById(existingRubric._id, safePayload)
    if (safePayload.criterionMaxScore !== undefined) {
      await repository.updateCriteriaMaxScoreByRubricId(existingRubric._id || existingRubric.id, safePayload.criterionMaxScore)
    }
    return await normalizeRubric(updatedRubric, repository)
  }

  const addCriterion = async (rubricId, payload = {}) => {
    const rubric = await ensureRubricExists(rubricId)
    await ensureRubricMutable(rubric)
    const criteria = await repository.findCriteriaByRubricId(rubricId)
    const nextCriterion = {
      ...payload,
      weight: Number(payload.weight),
      maxScore: roundToTwoDecimals(rubric.criterionMaxScore || 10)
    }
    ensureCriterionNumbers(nextCriterion)
    ensureCriteriaFitRubricScale({
      rubric,
      criteria: [...criteria, nextCriterion],
      requireExact: rubric.status === 'ACTIVE'
    })
    const criterion = await repository.createCriterion({
      rubricId,
      name: payload.name,
      description: payload.description,
      maxScore: roundToTwoDecimals(rubric.criterionMaxScore || 10),
      weight: nextCriterion.weight,
      order: payload.order || (criteria.length + 1),
      judgeOnly: Boolean(payload.judgeOnly),
      aiSupportForAudit: Boolean(payload.aiSupportForAudit),
      aiInstruction: payload.aiInstruction || null
    })

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

    const nextCriterion = {
      name: payload.name ?? criterion.name,
      description: payload.description ?? criterion.description,
      maxScore: roundToTwoDecimals(rubric.criterionMaxScore || 10),
      weight: Number(payload.weight ?? criterion.weight),
      order: payload.order ?? criterion.order,
      judgeOnly: payload.judgeOnly ?? criterion.judgeOnly,
      aiSupportForAudit: payload.aiSupportForAudit ?? criterion.aiSupportForAudit,
      aiInstruction: payload.aiInstruction ?? criterion.aiInstruction
    }
    const criteria = await repository.findCriteriaByRubricId(rubricId)
    const nextCriteria = criteria.map(item => item._id?.toString() === criterionId.toString() ? { ...item, ...nextCriterion } : item)
    ensureCriterionNumbers(nextCriterion)
    ensureCriteriaFitRubricScale({
      rubric,
      criteria: nextCriteria,
      requireExact: rubric.status === 'ACTIVE'
    })

    const updatedCriterion = await repository.updateCriterionById(criterionId, nextCriterion)

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

    const criteria = await repository.findCriteriaByRubricId(rubricId)
    const nextCriteria = criteria.filter(item => item._id?.toString() !== criterionId.toString())
    ensureCriteriaFitRubricScale({
      rubric,
      criteria: nextCriteria,
      requireExact: rubric.status === 'ACTIVE'
    })
    await repository.deleteCriterionById(criterionId)

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
