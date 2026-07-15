import mongoose from 'mongoose'

import { RANKING_REPOSITORY } from './ranking.repository.js'
import { AUDIT_LOG_REPOSITORY } from '#modules/audit-logs/audit-log.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { LOGGER } from '#utils/logger.js'
import { isActiveJudge } from '#utils/domainAccessUtil.js'
import Event from '#models/event.model.js'
import Repository from '#models/repository.model.js'
import Round from '#models/round.model.js'
import Team from '#models/team.model.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'
import { env } from '#configs/environment.js'

const IN_APP_ONLY = ['IN_APP']

const normalizeRanking = (ranking) => {
  if (!ranking) return null
  const plainRanking = typeof ranking.toObject === 'function'
    ? ranking.toObject({ getters: true, virtuals: false })
    : ranking

  return {
    id: plainRanking._id?.toString() || plainRanking.id,
    eventId: plainRanking.eventId?._id?.toString?.() || plainRanking.eventId?.toString?.() || plainRanking.eventId,
    roundId: plainRanking.roundId?._id?.toString?.() || plainRanking.roundId?.toString?.() || plainRanking.roundId || null,
    trackId: plainRanking.trackId?._id?.toString?.() || plainRanking.trackId?.toString?.() || plainRanking.trackId || null,
    teamId: plainRanking.teamId?._id?.toString?.() || plainRanking.teamId?.toString?.() || plainRanking.teamId || null,
    rankingType: plainRanking.rankingType,
    event: plainRanking.eventId && typeof plainRanking.eventId === 'object'
      ? {
        id: plainRanking.eventId._id?.toString() || plainRanking.eventId.id,
        title: plainRanking.eventId.title,
        status: plainRanking.eventId.status
      }
      : null,
    round: plainRanking.roundId && typeof plainRanking.roundId === 'object'
      ? {
        id: plainRanking.roundId._id?.toString() || plainRanking.roundId.id,
        name: plainRanking.roundId.name,
        roundType: plainRanking.roundId.roundType,
        status: plainRanking.roundId.status
      }
      : null,
    track: plainRanking.trackId && typeof plainRanking.trackId === 'object'
      ? {
        id: plainRanking.trackId._id?.toString() || plainRanking.trackId.id,
        code: plainRanking.trackId.code,
        name: plainRanking.trackId.name
      }
      : null,
    team: plainRanking.teamId && typeof plainRanking.teamId === 'object'
      ? {
        id: plainRanking.teamId._id?.toString() || plainRanking.teamId.id,
        name: plainRanking.teamId.name,
        chapterName: plainRanking.teamId.chapterName,
        projectName: plainRanking.teamId.projectName,
        boardNumber: plainRanking.teamId.boardNumber
      }
      : null,
    score: plainRanking.score,
    rank: plainRanking.rank,
    tieBreakMethod: plainRanking.tieBreakMethod,
    tieBreakScore: plainRanking.tieBreakScore,
    penaltyScore: plainRanking.penaltyScore,
    miniTestScore: plainRanking.miniTestScore,
    tieBreakReason: plainRanking.tieBreakReason || null,
    tieBreakResolvedAt: plainRanking.tieBreakResolvedAt || null,
    tieBreakResolvedBy: plainRanking.tieBreakResolvedBy && typeof plainRanking.tieBreakResolvedBy === 'object'
      ? {
        id: plainRanking.tieBreakResolvedBy._id?.toString() || plainRanking.tieBreakResolvedBy.id,
        fullName: plainRanking.tieBreakResolvedBy.fullName,
        email: plainRanking.tieBreakResolvedBy.email
      }
      : plainRanking.tieBreakResolvedBy || null,
    rankSortScore: plainRanking.rankSortScore,
    calculationSource: plainRanking.calculationSource,
    calculationSummary: plainRanking.calculationSummary,
    calculatedAt: plainRanking.calculatedAt,
    isSelectedForFinal: plainRanking.isSelectedForFinal,
    selectionReason: plainRanking.selectionReason,
    note: plainRanking.note,
    publishedAt: plainRanking.publishedAt,
    publishedBy: plainRanking.publishedBy && typeof plainRanking.publishedBy === 'object'
      ? {
        id: plainRanking.publishedBy._id?.toString() || plainRanking.publishedBy.id,
        fullName: plainRanking.publishedBy.fullName,
        email: plainRanking.publishedBy.email
      }
      : null
  }
}

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const buildRankingFilter = (query = {}) => {
  const filter = {}
  if (query.eventId) filter.eventId = query.eventId
  if (query.roundId) filter.roundId = query.roundId
  if (query.trackId) filter.trackId = query.trackId
  if (query.teamId) filter.teamId = query.teamId
  filter.rankingType = query.rankingType || 'TEAM'
  return filter
}

const getId = (value) => {
  return value?._id?.toString?.() || value?.id || value?.toString?.()
}

const uniqueUsersFromTeam = (team = {}) => {
  const users = []
  const seen = new Set()
  const addUser = (user) => {
    const userId = getId(user)
    if (!userId || seen.has(userId)) return
    seen.add(userId)
    users.push(typeof user === 'object' ? user : { _id: userId })
  }

  addUser(team.leaderId)
  for (const member of team.memberIds || []) addUser(member)

  return users
}

const actorHasAnyPermission = (actor = {}, permissions = []) => {
  const actorPermissions = new Set([
    ...(actor.effectivePermissions || []),
    ...(actor.permissions || [])
  ].map(permission => {
    if (typeof permission === 'string') return permission
    return permission?.code
  }).filter(Boolean))

  return permissions.some(permission => actorPermissions.has(permission))
}

const canViewUnpublishedRankings = (actor = {}) => {
  return actorHasAnyPermission(actor, [
    PERMISSIONS.RANKING_GENERATE,
    PERMISSIONS.FINALIST_SELECT,
    PERMISSIONS.RESULT_PUBLISH
  ])
}

const applyPublishedVisibility = (filter, actor = {}) => {
  if (canViewUnpublishedRankings(actor)) return filter
  return {
    ...filter,
    publishedAt: { $ne: null }
  }
}

const sortTeamGroups = (groups = []) => {
  return [...groups].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.teamName.localeCompare(right.teamName)
  })
}

const buildTieNotes = ({ rankedTeams, tieBreakRule }) => {
  const scoreGroups = new Map()
  for (const team of rankedTeams) {
    const key = String(team.score)
    const current = scoreGroups.get(key) || []
    current.push(team)
    scoreGroups.set(key, current)
  }

  const tiedGroups = [...scoreGroups.values()].filter(group => group.length > 1)
  for (const tiedGroup of tiedGroups) {
    const teamNames = tiedGroup.map(team => team.teamName).join(', ')
    for (const team of tiedGroup) {
      team.note = `Manual tie-break trace required for teams: ${teamNames}. Rule: ${tieBreakRule || 'No tieBreakRule configured'}.`
    }
  }

  return tiedGroups.map(group => ({
    score: group[0].score,
    teamIds: group.map(item => item.teamId.toString()),
    teamNames: group.map(item => item.teamName)
  }))
}

const assignSharedRanks = (rankedTeams = []) => {
  let previousScore = null
  let previousRank = 0

  return rankedTeams.map((team, index) => {
    const rank = previousScore !== null && team.score === previousScore
      ? previousRank
      : index + 1
    previousScore = team.score
    previousRank = rank
    return { ...team, rank }
  })
}

const buildRankingTieGroups = (rankings = []) => {
  const groups = new Map()
  for (const ranking of rankings) {
    const key = String(Number(ranking.score || 0))
    const current = groups.get(key) || []
    current.push(ranking)
    groups.set(key, current)
  }

  return [...groups.values()].filter(group => group.length > 1)
}

const isTieBreakResolved = (ranking) => {
  return ranking.tieBreakMethod && ranking.tieBreakMethod !== 'NONE' && ranking.tieBreakResolvedAt
}

const ensureNoUnresolvedCutoffTie = ({ rankings = [], selectedTeamIds = [], action }) => {
  const selectedSet = new Set(selectedTeamIds.map(String))
  const unresolvedCutoffTie = buildRankingTieGroups(rankings).find(group => {
    const selectedCount = group.filter(ranking => selectedSet.has(getId(ranking.teamId))).length
    if (selectedCount === 0 || selectedCount === group.length) return false
    return group.some(ranking => !isTieBreakResolved(ranking))
  })

  if (unresolvedCutoffTie) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [
      `Resolve tie-break before ${action}`,
      `Tied score: ${unresolvedCutoffTie[0].score}`
    ])
  }
}

const ensureExactFinalistCount = ({ selectedCount, finalistCount, mode, exceptionReason = null }) => {
  if (!finalistCount) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['competitionConfig.finalistCount is required before selecting finalists'])
  }
  if (selectedCount === finalistCount) return
  if (exceptionReason?.trim()) return

  throw new ApiError(ERROR_CODES.BAD_REQUEST, [
    `Finalist selection must contain exactly ${finalistCount} teams`,
    `Current finalist count: ${selectedCount}`,
    `Selection mode: ${mode}`
  ])
}

const selectFixedPerBoard = ({ rankings, finalistsPerBoard }) => {
  const grouped = new Map()
  for (const ranking of rankings) {
    const boardKey = ranking.selectionGroupKey || ranking.boardNumber || 0
    const current = grouped.get(boardKey) || []
    current.push(ranking)
    grouped.set(boardKey, current)
  }

  return [...grouped.values()].flatMap(group => group.slice(0, finalistsPerBoard))
}

const validateRankingCompleteness = async ({ repository, eventId, roundId, scoreSheets = [] }) => {
  if (!repository.findBoardsForRanking) return

  const boards = await repository.findBoardsForRanking({ eventId, roundId })
  if (boards.length === 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Judging boards with assigned teams and judges are required before ranking generation'])
  }

  const lockedSheetPairs = new Set(scoreSheets.map(scoreSheet => {
    const teamId = getId(scoreSheet.teamId)
    const judgeId = getId(scoreSheet.judgeId)
    return teamId && judgeId ? `${teamId}:${judgeId}` : null
  }).filter(Boolean))
  const missingPairs = []
  const inactiveJudges = []

  for (const board of boards) {
    const boardNumber = board.boardNumber || null
    const teamIds = (board.teamIds || []).map(getId).filter(Boolean)
    const judges = board.judgeIds || []
    const judgeIds = judges.map(getId).filter(Boolean)

    for (const judge of judges) {
      if (judge && typeof judge === 'object' && (judge.status || Array.isArray(judge.roles)) && !isActiveJudge(judge)) {
        inactiveJudges.push(getId(judge))
      }
    }

    for (const teamId of teamIds) {
      for (const judgeId of judgeIds) {
        if (!lockedSheetPairs.has(`${teamId}:${judgeId}`)) {
          missingPairs.push({ boardNumber, teamId, judgeId })
        }
      }
    }
  }

  if (inactiveJudges.length > 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['All ranking judges must have ACTIVE accounts and the JUDGE role'])
  }

  if (missingPairs.length > 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [
      'Official ranking requires locked score sheets from every assigned judge for every team',
      `Missing score sheets: ${missingPairs.length}`
    ])
  }
}

export const createRankingService = ({
  repository = RANKING_REPOSITORY,
  auditLogRepository = AUDIT_LOG_REPOSITORY,
  eventModel = Event,
  roundModel = Round,
  teamModel = Team,
  notificationService = null,
  repositoryModel = Repository,
  relaxedWorkflow = false
} = {}) => {
  const ensureEventRoundContext = async ({ eventId, roundId }) => {
    ensureObjectId(eventId, 'event id')
    ensureObjectId(roundId, 'round id')

    const [event, round] = await Promise.all([
      eventModel.findById(eventId),
      roundModel.findById(roundId)
    ])

    if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    if (!round) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Round not found'])
    if (round.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Round does not belong to the specified event'])
    }

    return { event, round }
  }

  const listRankings = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = applyPublishedVisibility(buildRankingFilter(query), actor)

    const [rankings, totalItems] = await Promise.all([
      repository.findRankings({ filter, skip, limit }),
      repository.countRankings(filter)
    ])

    return {
      rankings: rankings.map(normalizeRanking),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const generateRankings = async ({ eventId, roundId, rankingType = 'TEAM' }, actor = {}) => {
    if (rankingType !== 'TEAM') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Phase 9 supports official TEAM ranking generation only'])
    }

    const { event, round } = await ensureEventRoundContext({ eventId, roundId })
    if (round.roundType !== 'FINAL') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Rankings can only be generated for the final round'])
    }
    const scoreSheets = await repository.findScoreSheetsForRanking({ eventId, roundId })
    if (scoreSheets.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['No submitted score sheets found for ranking generation'])
    }
    if (!relaxedWorkflow) {
      await validateRankingCompleteness({
        repository,
        eventId,
        roundId,
        scoreSheets
      })
    }

    const roundPlacements = repository.findRoundTeamPlacements
      ? await repository.findRoundTeamPlacements({ eventId, roundId })
      : []
    const placementsByTeamId = new Map((roundPlacements || []).map(placement => [
      getId(placement.teamId),
      placement
    ]))

    const teamGroups = new Map()
    for (const scoreSheet of scoreSheets) {
      const teamId = scoreSheet.teamId?._id?.toString?.() || scoreSheet.teamId?.toString?.()
      const placement = placementsByTeamId.get(teamId)
      const current = teamGroups.get(teamId) || {
        teamId,
        teamName: scoreSheet.teamId?.name || 'Unknown Team',
        chapterName: scoreSheet.teamId?.chapterName || null,
        boardNumber: placement?.boardNumber || scoreSheet.teamId?.boardNumber || scoreSheet.boardId?.boardNumber || null,
        trackId: scoreSheet.teamId?.trackId || null,
        scores: [],
        judgeIds: []
      }

      current.scores.push(Number(scoreSheet.finalScore || 0))
      current.judgeIds.push(scoreSheet.judgeId?._id?.toString?.() || scoreSheet.judgeId?.toString?.() || null)
      teamGroups.set(teamId, current)
    }

    const rankedTeams = assignSharedRanks(sortTeamGroups([...teamGroups.values()].map(team => ({
      ...team,
      score: Number((team.scores.reduce((sum, value) => sum + value, 0) / team.scores.length).toFixed(4)),
      note: null
    }))))

    const tiedGroups = buildTieNotes({
      rankedTeams,
      tieBreakRule: round.tieBreakRule || event.competitionConfig?.tieBreakRule
    })

    const calculatedAt = new Date()
    const rankingDocuments = rankedTeams.map(team => ({
      eventId,
      roundId,
      rankingType,
      teamId: team.teamId,
      trackId: team.trackId || null,
      score: team.score,
      rankSortScore: team.score,
      rank: team.rank,
      tieBreakMethod: team.note ? 'NONE' : 'NONE',
      tieBreakScore: 0,
      calculationSource: 'OFFICIAL_JUDGE_SCORES_ONLY',
      calculationSummary: {
        judgeCount: team.judgeIds.filter(Boolean).length,
        source: 'LOCKED_SCORE_SHEETS_ONLY',
        aiReviewUsed: false,
        boardNumber: team.boardNumber || null
      },
      calculatedAt,
      isSelectedForFinal: false,
      selectionReason: null,
      note: team.note
    }))

    await repository.deleteRankings({ eventId, roundId, rankingType })
    const createdRankings = await repository.createManyRankings(rankingDocuments)

    await auditLogRepository.create({
      userId: actor.id || null,
      action: 'RANKING_GENERATED',
      resourceType: 'Ranking',
      metadata: {
        eventId,
        roundId,
        rankingType,
        generatedCount: createdRankings.length,
        source: 'OFFICIAL_JUDGE_SCORES_ONLY',
        aiReviewUsed: false,
        tieBreakRule: round.tieBreakRule || event.competitionConfig?.tieBreakRule || null,
        tiedGroups
      }
    })

    return {
      rankings: createdRankings.map(normalizeRanking),
      summary: {
        generatedCount: createdRankings.length,
        source: 'OFFICIAL_JUDGE_SCORES_ONLY',
        aiReviewUsed: false,
        tiedGroups
      }
    }
  }

  const resolveTieBreak = async ({ eventId, roundId, decisions = [] }, actor = {}) => {
    await ensureEventRoundContext({ eventId, roundId })

    if (!Array.isArray(decisions) || decisions.length < 2) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Tie-break resolution requires at least two team decisions'])
    }

    const teamIds = [...new Set(decisions.map(item => item.teamId?.toString()).filter(Boolean))]
    if (teamIds.length !== decisions.length) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Tie-break team decisions must contain unique teamIds'])
    }

    const rankings = await repository.findRankings({
      filter: { eventId, roundId, rankingType: 'TEAM' },
      limit: 500
    })
    const rankingsByTeamId = new Map(rankings.map(ranking => [getId(ranking.teamId), ranking]))
    const targetRankings = teamIds.map(teamId => rankingsByTeamId.get(teamId))
    if (targetRankings.some(ranking => !ranking)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Tie-break teams must exist in generated rankings for this round'])
    }

    const tiedScores = new Set(targetRankings.map(ranking => Number(ranking.score || 0)))
    if (tiedScores.size !== 1) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Tie-break decisions must target teams with the same score'])
    }

    const resolvedAt = new Date()
    const updatedRankings = []
    for (const decision of decisions) {
      const ranking = rankingsByTeamId.get(decision.teamId.toString())
      const method = decision.tieBreakMethod
      const tieBreakScore = Number(decision.tieBreakScore ?? decision.miniTestScore ?? decision.penaltyScore ?? 0)
      if (!['PENALTY_EVALUATION', 'MINI_TEST'].includes(method)) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['tieBreakMethod must be PENALTY_EVALUATION or MINI_TEST'])
      }
      if (!decision.tieBreakReason?.trim()) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['tieBreakReason is required for tie-break resolution'])
      }

      updatedRankings.push(await repository.updateRankingById(ranking._id, {
        tieBreakMethod: method,
        tieBreakScore,
        penaltyScore: Number(decision.penaltyScore ?? (method === 'PENALTY_EVALUATION' ? tieBreakScore : ranking.penaltyScore || 0)),
        miniTestScore: Number(decision.miniTestScore ?? (method === 'MINI_TEST' ? tieBreakScore : ranking.miniTestScore || 0)),
        rankSortScore: Number(ranking.score || 0) + (tieBreakScore / 1000000),
        tieBreakReason: decision.tieBreakReason.trim(),
        tieBreakResolvedAt: resolvedAt,
        tieBreakResolvedBy: actor.id || null,
        note: null
      }))
    }

    await auditLogRepository.create({
      userId: actor.id || null,
      action: 'RANKING_TIE_BREAK_RESOLVED',
      resourceType: 'Ranking',
      metadata: {
        eventId,
        roundId,
        teamIds,
        decisions: decisions.map(item => ({
          teamId: item.teamId,
          tieBreakMethod: item.tieBreakMethod,
          tieBreakScore: Number(item.tieBreakScore ?? item.miniTestScore ?? item.penaltyScore ?? 0)
        }))
      }
    })

    return {
      rankings: updatedRankings.map(normalizeRanking),
      summary: {
        resolvedCount: updatedRankings.length,
        teamIds
      }
    }
  }

  const selectFinalists = async ({ eventId, roundId }, actor = {}) => {
    const { event, round } = await ensureEventRoundContext({ eventId, roundId })
    const config = event.competitionConfig || {}
    const mode = config.finalistSelectionMode || 'OVERALL_SCORE'
    const selectAcrossPreliminaryStage = round.roundType === 'PRELIMINARY' &&
      ['FIXED_PER_BOARD', 'TOP_PER_BOARD_WITH_WILDCARD'].includes(mode)

    const scopedRounds = selectAcrossPreliminaryStage
      ? await roundModel.find({ eventId, roundType: 'PRELIMINARY' }).select('_id')
      : [round]
    const scopedRoundIds = scopedRounds.map(item => item._id?.toString?.() || item.id || item.toString())
    const rankings = await repository.findRankings({
      filter: {
        eventId,
        roundId: selectAcrossPreliminaryStage ? { $in: scopedRoundIds } : roundId,
        rankingType: 'TEAM'
      },
      limit: 500
    })
    if (rankings.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Generate rankings before selecting finalists'])
    }

    const finalistCount = Number(config.finalistCount || 0)
    const finalistsPerBoard = Number(config.finalistsPerBoard || 0)
    const normalizedRankings = rankings.map(item => ({
      ranking: item,
      teamId: item.teamId?._id?.toString?.() || item.teamId?.toString?.(),
      teamName: item.teamId?.name || 'Unknown Team',
      roundId: item.roundId?._id?.toString?.() || item.roundId?.toString?.(),
      boardNumber: item.calculationSummary?.boardNumber || item.teamId?.boardNumber || 0,
      selectionGroupKey: selectAcrossPreliminaryStage
        ? `${item.roundId?._id?.toString?.() || item.roundId?.toString?.()}:${item.calculationSummary?.boardNumber || item.teamId?.boardNumber || 0}`
        : String(item.calculationSummary?.boardNumber || item.teamId?.boardNumber || 0),
      score: item.score,
      rank: item.rank,
      rankSortScore: item.rankSortScore ?? item.score
    })).sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank
      if (right.rankSortScore !== left.rankSortScore) return right.rankSortScore - left.rankSortScore
      return left.teamName.localeCompare(right.teamName)
    })

    let selected = []
    if (mode === 'FIXED_PER_BOARD') {
      selected = selectFixedPerBoard({
        rankings: normalizedRankings,
        finalistsPerBoard
      })
    } else if (mode === 'TOP_PER_BOARD_WITH_WILDCARD') {
      selected = selectFixedPerBoard({
        rankings: normalizedRankings,
        finalistsPerBoard
      })
      const remainingIds = new Set(selected.map(item => item.teamId))
      for (const ranking of normalizedRankings) {
        if (selected.length >= finalistCount) break
        if (!remainingIds.has(ranking.teamId)) {
          selected.push(ranking)
          remainingIds.add(ranking.teamId)
        }
      }
    } else if (mode === 'CUSTOM') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['CUSTOM finalist selection requires the manual finalist endpoint'])
    } else {
      selected = normalizedRankings.slice(0, finalistCount)
    }

    if (config.fillRemainingFinalistsByOverallScore && selected.length < finalistCount) {
      const selectedIds = new Set(selected.map(item => item.teamId))
      for (const ranking of normalizedRankings) {
        if (selected.length >= finalistCount) break
        if (!selectedIds.has(ranking.teamId)) {
          selected.push(ranking)
          selectedIds.add(ranking.teamId)
        }
      }
    }

    ensureExactFinalistCount({
      selectedCount: selected.length,
      finalistCount,
      mode
    })
    ensureNoUnresolvedCutoffTie({
      rankings,
      selectedTeamIds: selected.map(item => item.teamId),
      action: 'selecting finalists'
    })

    await repository.updateManyRankings(
      {
        eventId,
        roundId: selectAcrossPreliminaryStage ? { $in: scopedRoundIds } : roundId,
        rankingType: 'TEAM'
      },
      { isSelectedForFinal: false, selectionReason: null }
    )

    const selectedIds = new Set(selected.map(item => item.teamId))
    const updatedSelections = []
    const promotedTeamIdsByRound = new Map(scopedRoundIds.map(id => [id, []]))
    for (const ranking of rankings) {
      const teamId = ranking.teamId?._id?.toString?.() || ranking.teamId?.toString?.()
      if (!selectedIds.has(teamId)) continue
      const selectedEntry = selected.find(item => item.teamId === teamId)
      const rankingRoundId = ranking.roundId?._id?.toString?.() || ranking.roundId?.toString?.()
      const promotedTeamIds = promotedTeamIdsByRound.get(rankingRoundId) || []
      promotedTeamIds.push(teamId)
      promotedTeamIdsByRound.set(rankingRoundId, promotedTeamIds)
      updatedSelections.push(await repository.updateRankingById(ranking._id, {
        isSelectedForFinal: true,
        selectionReason: selectedEntry.customReason
          || `Selected by ${mode} using official judge scores only`
      }))
    }

    await Promise.all([...promotedTeamIdsByRound.entries()].map(([scopedRoundId, promotedTeamIds]) =>
      roundModel.findByIdAndUpdate(scopedRoundId, { promotedTeamIds })
    ))

    const promotedTeamIds = [...new Set([...promotedTeamIdsByRound.values()].flat())]

    await auditLogRepository.create({
      userId: actor.id || null,
      action: 'FINALISTS_SELECTED',
      resourceType: 'Ranking',
      metadata: {
        eventId,
        roundId,
        scopedRoundIds,
        finalistSelectionMode: mode,
        finalistCount: updatedSelections.length,
        promotedTeamIds,
        source: 'OFFICIAL_JUDGE_SCORES_ONLY',
        aiReviewUsed: false
      }
    })

    return {
      finalists: updatedSelections.map(normalizeRanking),
      summary: {
        finalistSelectionMode: mode,
        finalistCount: updatedSelections.length,
        promotedTeamIds,
        source: 'OFFICIAL_JUDGE_SCORES_ONLY'
      }
    }
  }

  const listFinalists = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = applyPublishedVisibility({
      ...buildRankingFilter(query),
      isSelectedForFinal: true
    }, actor)

    const [rankings, totalItems] = await Promise.all([
      repository.findRankings({ filter, skip, limit }),
      repository.countRankings(filter)
    ])

    return {
      finalists: rankings.map(normalizeRanking),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const selectManualFinalists = async ({ eventId, roundId, teamIds = [], selectionReason }, actor = {}) => {
    const { event } = await ensureEventRoundContext({ eventId, roundId })

    const requestedTeamIds = [...new Set(teamIds.map(teamId => teamId.toString()))]
    const rankings = await repository.findRankings({
      filter: { eventId, roundId, rankingType: 'TEAM' },
      limit: 500
    })
    if (rankings.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Generate rankings before selecting finalists'])
    }

    const rankingTeamIds = new Set(rankings
      .map(item => item.teamId?._id?.toString?.() || item.teamId?.toString?.())
      .filter(Boolean))
    const missingTeamIds = requestedTeamIds.filter(teamId => !rankingTeamIds.has(teamId))
    if (missingTeamIds.length > 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Selected teams must exist in the generated rankings for this round'])
    }

    const finalistCount = Number(event.competitionConfig?.finalistCount || 0)
    const reason = selectionReason?.trim() || ''
    ensureExactFinalistCount({
      selectedCount: requestedTeamIds.length,
      finalistCount,
      mode: 'CUSTOM',
      exceptionReason: reason
    })
    ensureNoUnresolvedCutoffTie({
      rankings,
      selectedTeamIds: requestedTeamIds,
      action: 'manual finalist selection'
    })

    await repository.updateManyRankings(
      { eventId, roundId, rankingType: 'TEAM' },
      { isSelectedForFinal: false, selectionReason: null }
    )

    const finalReason = reason || 'Manually selected by organizer review'
    for (const ranking of rankings) {
      const teamId = ranking.teamId?._id?.toString?.() || ranking.teamId?.toString?.()
      if (!requestedTeamIds.includes(teamId)) continue

      await repository.updateRankingById(ranking._id, {
        isSelectedForFinal: true,
        selectionReason: finalReason
      })
    }

    await roundModel.findByIdAndUpdate(roundId, {
      promotedTeamIds: requestedTeamIds
    })

    await auditLogRepository.create({
      userId: actor.id || null,
      action: 'FINALISTS_SELECTED_MANUALLY',
      resourceType: 'Ranking',
      metadata: {
        eventId,
        roundId,
        finalistSelectionMode: 'CUSTOM',
        finalistCount: requestedTeamIds.length,
        promotedTeamIds: requestedTeamIds,
        expectedFinalistCount: finalistCount,
        selectionExceptionReason: requestedTeamIds.length === finalistCount ? null : finalReason,
        source: 'OFFICIAL_JUDGE_SCORES_ONLY',
        aiReviewUsed: false
      }
    })

    const updatedFinalists = await repository.findRankings({
      filter: {
        eventId,
        roundId,
        rankingType: 'TEAM',
        isSelectedForFinal: true
      },
      limit: 500
    })

    return {
      finalists: updatedFinalists.map(normalizeRanking),
      summary: {
        finalistSelectionMode: 'CUSTOM',
        finalistCount: updatedFinalists.length,
        promotedTeamIds: requestedTeamIds,
        source: 'OFFICIAL_JUDGE_SCORES_ONLY'
      }
    }
  }

  const applyRepositoryAccessAction = async ({ eventId, roundId, teamIds = [], action, publishedAt }, actor = {}) => {
    if (action === 'NONE' || teamIds.length === 0) {
      return {
        action: 'NONE',
        affectedRepositories: 0
      }
    }

    const filter = {
      eventId,
      teamId: { $in: teamIds }
    }

    const update = action === 'REVOKE'
      ? {
        accessState: 'REVOKE_PENDING',
        accessRevokeRequestedAt: publishedAt,
        lastAccessRevokeError: null,
        roundId
      }
      : {
        status: 'DISCONNECTED',
        roundId
      }

    const result = await repositoryModel.updateMany(filter, update)
    const updateRepositoryRevokeState = async (repo, data) => {
      const repoId = repo._id || repo.id
      if (!repoId) return
      if (typeof repositoryModel.updateOne === 'function') {
        await repositoryModel.updateOne({ _id: repoId }, data)
        return
      }
      await repositoryModel.updateMany({ _id: repoId }, data)
    }

    const summary = {
      action,
      affectedRepositories: result.modifiedCount || result.matchedCount || 0,
      pendingRepositories: action === 'REVOKE' ? (result.modifiedCount || result.matchedCount || 0) : 0,
      revokedRepositories: 0,
      failedRepositories: 0
    }

    if (action === 'REVOKE' && typeof repositoryModel.find === 'function') {
      try {
        const repos = await repositoryModel.find(filter)
        const { GITHUB_REPOSITORY } = await import('#modules/github/github.repository.js')
        const { GITHUB_SERVICE } = await import('#modules/github/github.service.js')

        for (const repo of repos) {
          const repoName = repo.repoName || repo.githubRepo
          if (!repoName) continue
          const errors = []

          try {
            const usernames = await GITHUB_REPOSITORY.findTeamMembersGithubUsernames(repo.teamId)
            for (const username of usernames) {
              try {
                await GITHUB_SERVICE.revokeCollaborator({
                  eventId,
                  repoName,
                  username
                }, actor)
              } catch (err) {
                errors.push(`${username}: ${err.message}`)
                LOGGER.warn('Failed to revoke collaborator on GitHub during result publication', {
                  repoName,
                  username,
                  error: err.message
                })
              }
            }
          } catch (err) {
            errors.push(err.message)
            LOGGER.error('Failed to resolve usernames or revoke collaborators for repository', {
              repoId: repo._id,
              error: err.message
            })
          }

          if (errors.length > 0) {
            await updateRepositoryRevokeState(repo, {
              accessState: 'REVOKE_FAILED',
              lastAccessRevokeError: errors.join('; ').slice(0, 500),
              roundId
            })
            summary.failedRepositories += 1
          } else {
            await updateRepositoryRevokeState(repo, {
              accessState: 'REVOKED',
              accessRevokedAt: publishedAt,
              lastAccessRevokeError: null,
              status: 'ARCHIVED',
              roundId
            })
            summary.revokedRepositories += 1
          }
        }
      } catch (importErr) {
        LOGGER.error('Failed to import GitHub modules for collaborator revocation', {
          error: importErr.message
        })
      }
    }

    summary.pendingRepositories = Math.max(0, summary.pendingRepositories - summary.revokedRepositories - summary.failedRepositories)
    return summary
  }

  const publishResults = async ({ eventId, roundId, repositoryAccessAction = 'NONE' }, actor = {}) => {
    const { event, round } = await ensureEventRoundContext({ eventId, roundId })
    const rankings = await repository.findRankings({
      filter: { eventId, roundId, rankingType: 'TEAM' },
      limit: 500
    })
    if (rankings.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['No rankings available to publish'])
    }

    const selectedRankings = rankings.filter(item => item.isSelectedForFinal)
    const selectedTeamIds = selectedRankings
      .map(item => item.teamId?._id?.toString?.() || item.teamId?.toString?.())
      .filter(Boolean)
    const finalistCount = Number(event.competitionConfig?.finalistCount || 0)
    const selectionExceptionReason = selectedRankings.find(item => item.selectionReason)?.selectionReason || null
    ensureExactFinalistCount({
      selectedCount: selectedRankings.length,
      finalistCount,
      mode: event.competitionConfig?.finalistSelectionMode || 'OVERALL_SCORE',
      exceptionReason: selectionExceptionReason
    })
    ensureNoUnresolvedCutoffTie({
      rankings,
      selectedTeamIds,
      action: 'publishing results'
    })

    const publishedAt = new Date()
    const teamIds = rankings
      .map(item => item.teamId?._id?.toString?.() || item.teamId?.toString?.())
      .filter(Boolean)
    await repository.updateManyRankings(
      { eventId, roundId, rankingType: 'TEAM' },
      { publishedAt, publishedBy: actor.id || null }
    )
    await roundModel.findByIdAndUpdate(roundId, {
      status: 'COMPLETED',
      publishTime: publishedAt,
      promotedTeamIds: selectedTeamIds
    })
    const repositoryActionSummary = await applyRepositoryAccessAction({
      eventId,
      roundId,
      teamIds,
      action: repositoryAccessAction,
      publishedAt
    }, actor)

    await auditLogRepository.create({
      userId: actor.id || null,
      action: 'RESULTS_PUBLISHED',
      resourceType: 'Ranking',
      metadata: {
        eventId,
        roundId,
        publishedCount: rankings.length,
        source: 'OFFICIAL_JUDGE_SCORES_ONLY',
        aiReviewUsed: false,
        repositoryAccessAction: repositoryActionSummary.action,
        affectedRepositories: repositoryActionSummary.affectedRepositories,
        pendingRepositories: repositoryActionSummary.pendingRepositories,
        revokedRepositories: repositoryActionSummary.revokedRepositories,
        failedRepositories: repositoryActionSummary.failedRepositories
      }
    })

    let eventCompleted = false
    if (round.roundType === 'FINAL' && ['ONGOING', 'SCORING'].includes(event.status) && typeof eventModel.findByIdAndUpdate === 'function') {
      await eventModel.findByIdAndUpdate(eventId, { status: 'COMPLETED' })
      eventCompleted = true
      await auditLogRepository.create({
        userId: actor.id || null,
        action: 'EVENT_COMPLETED_AFTER_FINAL_RESULTS',
        resourceType: 'Event',
        resourceId: eventId,
        metadata: {
          eventId,
          roundId,
          fromStatus: event.status,
          toStatus: 'COMPLETED'
        }
      })
    }

    const publishedRankings = await repository.findRankings({
      filter: { eventId, roundId, rankingType: 'TEAM' },
      limit: 500
    })

    await notifyResultsPublished({
      eventId,
      roundId,
      event,
      round,
      rankings: publishedRankings
    })

    return {
      publishedAt,
      rankings: publishedRankings.map(normalizeRanking),
      repositoryAccessAction: repositoryActionSummary,
      eventCompleted
    }
  }

  const findTeamForNotification = async (teamId) => {
    if (!teamId || !teamModel?.findById) return null

    const query = teamModel.findById(teamId)
    if (query && typeof query.populate === 'function') {
      return await query.populate([
        { path: 'leaderId', select: 'email fullName status' },
        { path: 'memberIds', select: 'email fullName status' }
      ])
    }

    return await query
  }

  const notifyResultsPublished = async ({ eventId, roundId, event, round, rankings = [] }) => {
    if (!notificationService?.notifyUser) return

    const teamIds = [...new Set(rankings.map(item => getId(item.teamId)).filter(Boolean))]
    const jobs = []

    for (const teamId of teamIds) {
      const team = await findTeamForNotification(teamId)
      const users = uniqueUsersFromTeam(team)
      const ranking = rankings.find(item => getId(item.teamId) === teamId)
      const teamName = team?.name || ranking?.teamId?.name || 'your team'
      const roundName = round?.name || ranking?.roundId?.name || 'the round'
      const eventTitle = event?.title || ranking?.eventId?.title || 'the event'
      const rank = ranking?.rank ? ` Rank: #${ranking.rank}.` : ''

      for (const user of users) {
        jobs.push(notificationService.notifyUser({
          user,
          title: 'Results published',
          message: `${eventTitle} results for ${roundName} are now available for ${teamName}.${rank}`,
          type: 'RESULT',
          dedupeKey: `results-published:${eventId}:${roundId}:${teamId}:${getId(user)}`,
          metadata: {
            action: 'RESULTS_PUBLISHED',
            eventId,
            roundId,
            teamId,
            rankingId: getId(ranking),
            targetPath: '/participant/results'
          },
          channels: IN_APP_ONLY
        }))
      }
    }

    await Promise.all(jobs)
  }

  return {
    listRankings,
    generateRankings,
    resolveTieBreak,
    selectFinalists,
    selectManualFinalists,
    listFinalists,
    publishResults
  }
}

export const RANKING_SERVICE = {
  ...createRankingService({
    notificationService: NOTIFICATION_SERVICE,
    relaxedWorkflow: env.workflow.relaxedDemoRules
  }),
  normalizeRanking
}
