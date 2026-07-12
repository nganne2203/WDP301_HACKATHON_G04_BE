import mongoose from 'mongoose'

import { SCORE_SHEET_REPOSITORY } from './score-sheet.repository.js'
import { AUDIT_LOG_REPOSITORY } from '#modules/audit-logs/audit-log.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import {
  actorHasRole,
  getActorId,
  getIdString,
  idsEqual,
  isPrivilegedEventActor
} from '#utils/domainAccessUtil.js'
import Event from '#models/event.model.js'
import JudgingBoard from '#models/judgingBoard.model.js'
import Round from '#models/round.model.js'
import Submission from '#models/submission.model.js'
import Team from '#models/team.model.js'
import User from '#models/user.model.js'
import { RUBRIC_REPOSITORY } from '#modules/rubrics/rubric.repository.js'

const normalizeScore = (score) => {
  if (!score) return null
  const plainScore = typeof score.toObject === 'function'
    ? score.toObject({ getters: true, virtuals: false })
    : score

  return {
    id: plainScore._id?.toString() || plainScore.id,
    criterionId: plainScore.criterionId?._id?.toString?.() || plainScore.criterionId?.toString?.() || plainScore.criterionId,
    criterion: plainScore.criterionId && typeof plainScore.criterionId === 'object'
      ? {
        id: plainScore.criterionId._id?.toString() || plainScore.criterionId.id,
        name: plainScore.criterionId.name,
        maxScore: plainScore.criterionId.maxScore,
        weight: plainScore.criterionId.weight,
        order: plainScore.criterionId.order
      }
      : null,
    judgeId: plainScore.judgeId?._id?.toString?.() || plainScore.judgeId?.toString?.() || plainScore.judgeId,
    scoreValue: plainScore.scoreValue,
    comment: plainScore.comment,
    isOverridden: plainScore.isOverridden,
    overrideReason: plainScore.overrideReason
  }
}

const normalizeScoreSheet = (scoreSheet) => {
  if (!scoreSheet) return null
  const plainScoreSheet = typeof scoreSheet.toObject === 'function'
    ? scoreSheet.toObject({ getters: true, virtuals: false })
    : scoreSheet

  return {
    id: plainScoreSheet._id?.toString() || plainScoreSheet.id,
    eventId: plainScoreSheet.eventId?._id?.toString?.() || plainScoreSheet.eventId?.toString?.() || plainScoreSheet.eventId,
    roundId: plainScoreSheet.roundId?._id?.toString?.() || plainScoreSheet.roundId?.toString?.() || plainScoreSheet.roundId,
    boardId: plainScoreSheet.boardId?._id?.toString?.() || plainScoreSheet.boardId?.toString?.() || plainScoreSheet.boardId || null,
    teamId: plainScoreSheet.teamId?._id?.toString?.() || plainScoreSheet.teamId?.toString?.() || plainScoreSheet.teamId,
    submissionId: plainScoreSheet.submissionId?._id?.toString?.() || plainScoreSheet.submissionId?.toString?.() || plainScoreSheet.submissionId,
    judgeId: plainScoreSheet.judgeId?._id?.toString?.() || plainScoreSheet.judgeId?.toString?.() || plainScoreSheet.judgeId,
    rubricId: plainScoreSheet.rubricId?._id?.toString?.() || plainScoreSheet.rubricId?.toString?.() || plainScoreSheet.rubricId || null,
    team: plainScoreSheet.teamId && typeof plainScoreSheet.teamId === 'object'
      ? {
        id: plainScoreSheet.teamId._id?.toString() || plainScoreSheet.teamId.id,
        name: plainScoreSheet.teamId.name,
        chapterName: plainScoreSheet.teamId.chapterName,
        boardNumber: plainScoreSheet.teamId.boardNumber
      }
      : null,
    judge: plainScoreSheet.judgeId && typeof plainScoreSheet.judgeId === 'object'
      ? {
        id: plainScoreSheet.judgeId._id?.toString() || plainScoreSheet.judgeId.id,
        fullName: plainScoreSheet.judgeId.fullName,
        email: plainScoreSheet.judgeId.email,
        githubUsername: plainScoreSheet.judgeId.githubUsername
      }
      : null,
    board: plainScoreSheet.boardId && typeof plainScoreSheet.boardId === 'object'
      ? {
        id: plainScoreSheet.boardId._id?.toString() || plainScoreSheet.boardId.id,
        name: plainScoreSheet.boardId.name,
        boardNumber: plainScoreSheet.boardId.boardNumber
      }
      : null,
    rubric: plainScoreSheet.rubricId && typeof plainScoreSheet.rubricId === 'object'
      ? {
        id: plainScoreSheet.rubricId._id?.toString() || plainScoreSheet.rubricId.id,
        title: plainScoreSheet.rubricId.title,
        totalScore: plainScoreSheet.rubricId.totalScore
      }
      : null,
    scores: (plainScoreSheet.scoreIds || []).map(normalizeScore),
    totalScore: plainScoreSheet.totalScore,
    weightedScore: plainScoreSheet.weightedScore,
    finalScore: plainScoreSheet.finalScore,
    generalComment: plainScoreSheet.generalComment,
    status: plainScoreSheet.status,
    submittedAt: plainScoreSheet.submittedAt,
    lockedAt: plainScoreSheet.lockedAt,
    createdAt: plainScoreSheet.createdAt,
    updatedAt: plainScoreSheet.updatedAt
  }
}

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const buildScoreSheetFilter = (query = {}) => {
  const filter = {}
  if (query.eventId) filter.eventId = query.eventId
  if (query.roundId) filter.roundId = query.roundId
  if (query.teamId) filter.teamId = query.teamId
  if (query.judgeId) filter.judgeId = query.judgeId
  if (query.status) filter.status = query.status
  return filter
}

const getScoreCriterionId = (score = {}) => {
  return getIdString(score.criterionId)
}

const mergeJudgeScope = (filter = {}, actor = {}) => {
  if (isPrivilegedEventActor(actor)) return filter

  const actorId = getActorId(actor)
  if (!actorId) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authenticated actor is required'])
  }

  if (!actorHasRole(actor, 'JUDGE')) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['Raw score sheets are only available to coordinators, admins, and assigned judges'])
  }

  if (filter.judgeId && getIdString(filter.judgeId) !== actorId) {
    return { ...filter, judgeId: { $in: [] } }
  }

  return {
    ...filter,
    judgeId: actorId
  }
}

const buildScoreSheetTotals = ({ scores = [], criteriaById = new Map() }) => {
  const totalScore = scores.reduce((sum, score) => sum + Number(score.scoreValue || 0), 0)
  const weightedScore = scores.reduce((sum, score) => {
    const criterion = criteriaById.get(getScoreCriterionId(score))
    const weight = Number(criterion?.weight || 1)
    return sum + (Number(score.scoreValue || 0) * weight)
  }, 0)

  return {
    totalScore,
    weightedScore,
    finalScore: weightedScore
  }
}

export const createScoreSheetService = ({
  repository = SCORE_SHEET_REPOSITORY,
  auditLogRepository = AUDIT_LOG_REPOSITORY,
  eventModel = Event,
  roundModel = Round,
  boardModel = JudgingBoard,
  teamModel = Team,
  submissionModel = Submission,
  userModel = User,
  rubricRepository = RUBRIC_REPOSITORY
} = {}) => {
  const ensureScoreSheetExists = async (id) => {
    ensureObjectId(id, 'score sheet id')
    const scoreSheet = await repository.findScoreSheetById(id)
    if (!scoreSheet) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Score sheet not found'])
    return scoreSheet
  }

  const ensureJudgeContext = async ({
    eventId,
    roundId,
    boardId,
    teamId,
    submissionId,
    judgeId,
    rubricId = null
  }) => {
    const [event, round, board, team, submission, judge] = await Promise.all([
      eventModel.findById(eventId),
      roundModel.findById(roundId),
      boardModel.findById(boardId),
      teamModel.findById(teamId),
      submissionModel.findById(submissionId),
      userModel.findById(judgeId)
    ])

    if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
    if (!board) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Judging board not found'])
    if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])
    if (!submission) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Submission not found'])
    if (!judge) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Judge not found'])

    if (round.status !== 'SCORING') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round must be in SCORING status before judges can score'])
    }
    if (board.status !== 'SCORING') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Judging board must be in SCORING status before judges can score'])
    }
    if (team.status !== 'CONFIRMED') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only confirmed teams can be scored'])
    }
    if (!['SUBMITTED', 'ACCEPTED'].includes(submission.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only submitted or accepted submissions can be scored'])
    }
    if (judge.status !== 'ACTIVE') {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Judge account must be ACTIVE to score'])
    }

    if (round.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified event'])
    }
    if (board.eventId?.toString() !== eventId.toString() || board.roundId?.toString() !== roundId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Judging board does not belong to the specified event round'])
    }
    if (team.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team does not belong to the specified event'])
    }
    if (submission.eventId?.toString() !== eventId.toString() ||
      submission.roundId?.toString() !== roundId.toString() ||
      submission.teamId?.toString() !== teamId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Submission does not match the scoring context'])
    }

    const boardTeamIds = (board.teamIds || []).map(value => value.toString())
    if (!boardTeamIds.includes(teamId.toString())) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Judge cannot score a team outside their assigned judging board'])
    }

    const boardJudgeIds = (board.judgeIds || []).map(value => value.toString())
    if (!boardJudgeIds.includes(judgeId.toString())) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Judge is not assigned to this judging board'])
    }

    const resolvedRubricId = rubricId || round.rubricId?.toString()
    if (!resolvedRubricId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round rubric is required before official scoring'])
    }

    const rubric = await rubricRepository.findRubricById(resolvedRubricId)
    if (!rubric) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Rubric not found'])

    return {
      event,
      round,
      board,
      team,
      submission,
      judge,
      rubric
    }
  }

  const validateScores = async ({ rubricId, scores = [] }) => {
    const criteria = await rubricRepository.findCriteriaByRubricId(rubricId)
    if (criteria.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rubric must contain at least one criterion before scoring'])
    }

    const criteriaById = new Map(criteria.map(criterion => [criterion._id.toString(), criterion]))
    for (const score of scores) {
      const criterion = criteriaById.get(getScoreCriterionId(score))
      if (!criterion) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Score criterion does not belong to the selected rubric'])
      }
      if (Number(score.scoreValue) > Number(criterion.maxScore)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, [`scoreValue cannot exceed criterion maxScore for ${criterion.name}`])
      }
      if (Number(score.scoreValue) < 0) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['scoreValue must be greater than or equal to zero'])
      }
    }

    return { criteria, criteriaById }
  }

  const validateCompleteScores = async ({ rubricId, scores = [] }) => {
    const { criteria } = await validateScores({ rubricId, scores })
    const requiredCriterionIds = criteria.map(criterion => criterion._id.toString())
    const submittedCriterionIds = scores.map(getScoreCriterionId).filter(Boolean)
    const uniqueSubmittedCriterionIds = new Set(submittedCriterionIds)

    if (submittedCriterionIds.length !== scores.length || uniqueSubmittedCriterionIds.size !== submittedCriterionIds.length) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Score sheet must contain exactly one score for each rubric criterion'])
    }

    const missingCriterionIds = requiredCriterionIds.filter(criterionId => !uniqueSubmittedCriterionIds.has(criterionId))
    const unexpectedCriterionIds = submittedCriterionIds.filter(criterionId => !requiredCriterionIds.includes(criterionId))

    if (missingCriterionIds.length > 0 || unexpectedCriterionIds.length > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Score sheet must contain exactly one score for each rubric criterion'])
    }
  }

  const ensureExistingScoreSheetCanBeChanged = async (scoreSheet) => {
    const eventId = getIdString(scoreSheet.eventId)
    const roundId = getIdString(scoreSheet.roundId)
    const boardId = getIdString(scoreSheet.boardId)
    const teamId = getIdString(scoreSheet.teamId)
    const submissionId = getIdString(scoreSheet.submissionId)
    const judgeId = getIdString(scoreSheet.judgeId)
    const rubricId = getIdString(scoreSheet.rubricId)

    return await ensureJudgeContext({
      eventId,
      roundId,
      boardId,
      teamId,
      submissionId,
      judgeId,
      rubricId
    })
  }

  const replaceSheetScores = async ({
    scoreSheetId,
    submissionId,
    judgeId,
    scores = []
  }) => {
    await repository.deleteScoresByScoreSheetId(scoreSheetId)
    if (scores.length === 0) return []

    return await repository.createScores(scores.map(score => ({
      submissionId,
      scoreSheetId,
      judgeId,
      criterionId: score.criterionId,
      scoreValue: Number(score.scoreValue),
      comment: score.comment,
      isOverridden: false,
      overrideReason: null
    })))
  }

  const listScoreSheets = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = mergeJudgeScope(buildScoreSheetFilter(query), actor)

    const [scoreSheets, totalItems] = await Promise.all([
      repository.findScoreSheets({ filter, skip, limit }),
      repository.countScoreSheets(filter)
    ])

    return {
      scoreSheets: scoreSheets.map(normalizeScoreSheet),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getScoreSheetById = async (id, actor = {}) => {
    const scoreSheet = await ensureScoreSheetExists(id)
    if (!isPrivilegedEventActor(actor) && (!actorHasRole(actor, 'JUDGE') || !idsEqual(scoreSheet.judgeId, getActorId(actor)))) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You cannot access another judge score sheet'])
    }
    return normalizeScoreSheet(scoreSheet)
  }

  const createScoreSheet = async (payload = {}, actor = {}) => {
    ensureObjectId(actor.id, 'judge id')
    const context = await ensureJudgeContext({
      eventId: payload.eventId,
      roundId: payload.roundId,
      boardId: payload.boardId,
      teamId: payload.teamId,
      submissionId: payload.submissionId,
      judgeId: actor.id,
      rubricId: payload.rubricId
    })
    const existingScoreSheet = await repository.findScoreSheetByRoundTeamJudge({
      roundId: payload.roundId,
      teamId: payload.teamId,
      judgeId: actor.id
    })
    if (existingScoreSheet) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Score sheet already exists for this judge, round, and team'])
    }

    const scores = payload.scores || []
    const { criteriaById } = await validateScores({
      rubricId: context.rubric._id.toString(),
      scores
    })

    const scoreSheet = await repository.createScoreSheet({
      eventId: payload.eventId,
      roundId: payload.roundId,
      boardId: payload.boardId,
      teamId: payload.teamId,
      submissionId: payload.submissionId,
      judgeId: actor.id,
      rubricId: context.rubric._id,
      scoreIds: [],
      generalComment: payload.generalComment,
      status: 'DRAFT'
    })

    const createdScores = await replaceSheetScores({
      scoreSheetId: scoreSheet._id,
      submissionId: payload.submissionId,
      judgeId: actor.id,
      scores
    })
    const totals = buildScoreSheetTotals({
      scores: createdScores.map(item => ({
        criterionId: item.criterionId,
        scoreValue: item.scoreValue
      })),
      criteriaById
    })

    await repository.updateScoreSheetById(scoreSheet._id, {
      scoreIds: createdScores.map(item => item._id),
      ...totals
    })

    return normalizeScoreSheet(await repository.findScoreSheetById(scoreSheet._id))
  }

  const updateScoreSheet = async (id, payload = {}, actor = {}) => {
    ensureObjectId(actor.id, 'judge id')
    const existingScoreSheet = await ensureScoreSheetExists(id)
    if (existingScoreSheet.status === 'LOCKED' || existingScoreSheet.status === 'SUBMITTED') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Submitted score sheet is locked and cannot be changed'])
    }

    if (existingScoreSheet.judgeId?._id?.toString?.() !== actor.id && existingScoreSheet.judgeId?.toString?.() !== actor.id) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only the assigned judge can update this score sheet'])
    }

    await ensureExistingScoreSheetCanBeChanged(existingScoreSheet)

    const rubricId = existingScoreSheet.rubricId?._id?.toString?.() || existingScoreSheet.rubricId?.toString?.()
    const scoreInput = payload.scores || []
    const { criteriaById } = await validateScores({ rubricId, scores: scoreInput })
    const createdScores = await replaceSheetScores({
      scoreSheetId: id,
      submissionId: existingScoreSheet.submissionId?._id?.toString?.() || existingScoreSheet.submissionId?.toString?.(),
      judgeId: actor.id,
      scores: scoreInput
    })
    const totals = buildScoreSheetTotals({
      scores: createdScores.map(item => ({
        criterionId: item.criterionId,
        scoreValue: item.scoreValue
      })),
      criteriaById
    })

    const updatedScoreSheet = await repository.updateScoreSheetById(id, {
      scoreIds: createdScores.map(item => item._id),
      generalComment: payload.generalComment ?? existingScoreSheet.generalComment,
      status: 'DRAFT',
      ...totals
    })

    return normalizeScoreSheet(updatedScoreSheet)
  }

  const submitScoreSheet = async (id, actor = {}) => {
    ensureObjectId(actor.id, 'judge id')
    const scoreSheet = await ensureScoreSheetExists(id)

    if (scoreSheet.judgeId?._id?.toString?.() !== actor.id && scoreSheet.judgeId?.toString?.() !== actor.id) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only the assigned judge can submit this score sheet'])
    }

    if ((scoreSheet.scoreIds || []).length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Score sheet must contain at least one score before submission'])
    }

    const context = await ensureExistingScoreSheetCanBeChanged(scoreSheet)
    await validateCompleteScores({
      rubricId: context.rubric._id.toString(),
      scores: scoreSheet.scoreIds || []
    })

    const submittedAt = new Date()
    const updatedScoreSheet = await repository.updateScoreSheetById(id, {
      status: 'LOCKED',
      submittedAt,
      lockedAt: submittedAt
    })

    await auditLogRepository.create({
      userId: actor.id,
      action: 'SCORE_SHEET_SUBMITTED_AND_LOCKED',
      resourceType: 'ScoreSheet',
      resourceId: updatedScoreSheet._id,
      metadata: {
        eventId: updatedScoreSheet.eventId?._id || updatedScoreSheet.eventId,
        roundId: updatedScoreSheet.roundId?._id || updatedScoreSheet.roundId,
        teamId: updatedScoreSheet.teamId?._id || updatedScoreSheet.teamId,
        judgeId: updatedScoreSheet.judgeId?._id || updatedScoreSheet.judgeId,
        scoreSource: 'JUDGE_ENTERED_ONLY',
        aiInfluence: false
      }
    })

    return normalizeScoreSheet(updatedScoreSheet)
  }

  return {
    listScoreSheets,
    getScoreSheetById,
    createScoreSheet,
    updateScoreSheet,
    submitScoreSheet
  }
}

export const SCORE_SHEET_SERVICE = {
  ...createScoreSheetService(),
  normalizeScoreSheet
}
