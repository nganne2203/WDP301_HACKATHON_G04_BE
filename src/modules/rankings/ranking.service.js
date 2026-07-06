import mongoose from 'mongoose'

import { RANKING_REPOSITORY } from './ranking.repository.js'
import { AUDIT_LOG_REPOSITORY } from '#modules/audit-logs/audit-log.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { LOGGER } from '#utils/logger.js'
import Event from '#models/event.model.js'
import Repository from '#models/repository.model.js'
import Round from '#models/round.model.js'

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

const selectFixedPerBoard = ({ rankings, finalistsPerBoard }) => {
  const grouped = new Map()
  for (const ranking of rankings) {
    const boardNumber = ranking.boardNumber || 0
    const current = grouped.get(boardNumber) || []
    current.push(ranking)
    grouped.set(boardNumber, current)
  }

  return [...grouped.values()].flatMap(group => group.slice(0, finalistsPerBoard))
}

export const createRankingService = ({
  repository = RANKING_REPOSITORY,
  auditLogRepository = AUDIT_LOG_REPOSITORY,
  eventModel = Event,
  roundModel = Round,
  repositoryModel = Repository
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

  const listRankings = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = buildRankingFilter(query)

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
    const scoreSheets = await repository.findScoreSheetsForRanking({ eventId, roundId })
    if (scoreSheets.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['No submitted score sheets found for ranking generation'])
    }

    const teamGroups = new Map()
    for (const scoreSheet of scoreSheets) {
      const teamId = scoreSheet.teamId?._id?.toString?.() || scoreSheet.teamId?.toString?.()
      const current = teamGroups.get(teamId) || {
        teamId,
        teamName: scoreSheet.teamId?.name || 'Unknown Team',
        chapterName: scoreSheet.teamId?.chapterName || null,
        boardNumber: scoreSheet.teamId?.boardNumber || scoreSheet.boardId?.boardNumber || null,
        trackId: scoreSheet.teamId?.trackId || null,
        scores: [],
        judgeIds: []
      }

      current.scores.push(Number(scoreSheet.finalScore || 0))
      current.judgeIds.push(scoreSheet.judgeId?._id?.toString?.() || scoreSheet.judgeId?.toString?.() || null)
      teamGroups.set(teamId, current)
    }

    const rankedTeams = sortTeamGroups([...teamGroups.values()].map(team => ({
      ...team,
      score: Number((team.scores.reduce((sum, value) => sum + value, 0) / team.scores.length).toFixed(4)),
      note: null
    })))

    const tiedGroups = buildTieNotes({
      rankedTeams,
      tieBreakRule: round.tieBreakRule || event.competitionConfig?.tieBreakRule
    })

    const calculatedAt = new Date()
    const rankingDocuments = rankedTeams.map((team, index) => ({
      eventId,
      roundId,
      rankingType,
      teamId: team.teamId,
      trackId: team.trackId || null,
      score: team.score,
      rankSortScore: team.score,
      rank: index + 1,
      tieBreakMethod: team.note ? 'NONE' : 'NONE',
      tieBreakScore: 0,
      calculationSource: 'OFFICIAL_JUDGE_SCORES_ONLY',
      calculationSummary: {
        judgeCount: team.judgeIds.filter(Boolean).length,
        source: 'LOCKED_SCORE_SHEETS_ONLY',
        aiReviewUsed: false
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

  const selectFinalists = async ({ eventId, roundId }, actor = {}) => {
    const { event } = await ensureEventRoundContext({ eventId, roundId })
    const rankings = await repository.findRankings({
      filter: { eventId, roundId, rankingType: 'TEAM' },
      limit: 500
    })
    if (rankings.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Generate rankings before selecting finalists'])
    }

    const config = event.competitionConfig || {}
    const finalistCount = Number(config.finalistCount || 0)
    const finalistsPerBoard = Number(config.finalistsPerBoard || 0)
    const mode = config.finalistSelectionMode || 'OVERALL_SCORE'
    const normalizedRankings = rankings.map(item => ({
      ranking: item,
      teamId: item.teamId?._id?.toString?.() || item.teamId?.toString?.(),
      teamName: item.teamId?.name || 'Unknown Team',
      boardNumber: item.teamId?.boardNumber || 0,
      score: item.score
    }))

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
      selected = normalizedRankings.slice(0, finalistCount).map(item => ({
        ...item,
        customReason: 'CUSTOM mode requires coordinator review; provisional finalists selected by current overall ranking.'
      }))
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

    await repository.updateManyRankings(
      { eventId, roundId, rankingType: 'TEAM' },
      { isSelectedForFinal: false, selectionReason: null }
    )

    const selectedIds = new Set(selected.map(item => item.teamId))
    const updatedSelections = []
    const promotedTeamIds = []
    for (const ranking of rankings) {
      const teamId = ranking.teamId?._id?.toString?.() || ranking.teamId?.toString?.()
      if (!selectedIds.has(teamId)) continue
      const selectedEntry = selected.find(item => item.teamId === teamId)
      promotedTeamIds.push(teamId)
      updatedSelections.push(await repository.updateRankingById(ranking._id, {
        isSelectedForFinal: true,
        selectionReason: selectedEntry.customReason
          || `Selected by ${mode} using official judge scores only`
      }))
    }

    await roundModel.findByIdAndUpdate(roundId, {
      promotedTeamIds
    })

    await auditLogRepository.create({
      userId: actor.id || null,
      action: 'FINALISTS_SELECTED',
      resourceType: 'Ranking',
      metadata: {
        eventId,
        roundId,
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

  const listFinalists = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const skip = (page - 1) * limit
    const filter = {
      ...buildRankingFilter(query),
      isSelectedForFinal: true
    }

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
    await ensureEventRoundContext({ eventId, roundId })

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

    await repository.updateManyRankings(
      { eventId, roundId, rankingType: 'TEAM' },
      { isSelectedForFinal: false, selectionReason: null }
    )

    const reason = selectionReason?.trim() || 'Manually selected by organizer review'
    for (const ranking of rankings) {
      const teamId = ranking.teamId?._id?.toString?.() || ranking.teamId?.toString?.()
      if (!requestedTeamIds.includes(teamId)) continue

      await repository.updateRankingById(ranking._id, {
        isSelectedForFinal: true,
        selectionReason: reason
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
        accessState: 'REVOKED',
        accessRevokedAt: publishedAt,
        status: 'ARCHIVED',
        roundId
      }
      : {
        status: 'DISCONNECTED',
        roundId
      }

    const result = await repositoryModel.updateMany(filter, update)

    if (action === 'REVOKE' && typeof repositoryModel.find === 'function') {
      try {
        const repos = await repositoryModel.find(filter)
        const { GITHUB_REPOSITORY } = await import('#modules/github/github.repository.js')
        const { GITHUB_SERVICE } = await import('#modules/github/github.service.js')

        for (const repo of repos) {
          const repoName = repo.repoName || repo.githubRepo
          if (!repoName) continue

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
                LOGGER.warn('Failed to revoke collaborator on GitHub during result publication', {
                  repoName,
                  username,
                  error: err.message
                })
              }
            }
          } catch (err) {
            LOGGER.error('Failed to resolve usernames or revoke collaborators for repository', {
              repoId: repo._id,
              error: err.message
            })
          }
        }
      } catch (importErr) {
        LOGGER.error('Failed to import GitHub modules for collaborator revocation', {
          error: importErr.message
        })
      }
    }

    return {
      action,
      affectedRepositories: result.modifiedCount || result.matchedCount || 0
    }
  }

  const publishResults = async ({ eventId, roundId, repositoryAccessAction = 'NONE' }, actor = {}) => {
    await ensureEventRoundContext({ eventId, roundId })
    const rankings = await repository.findRankings({
      filter: { eventId, roundId, rankingType: 'TEAM' },
      limit: 500
    })
    if (rankings.length === 0) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['No rankings available to publish'])
    }

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
      promotedTeamIds: rankings
        .filter(item => item.isSelectedForFinal)
        .map(item => item.teamId?._id?.toString?.() || item.teamId?.toString?.())
        .filter(Boolean)
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
        affectedRepositories: repositoryActionSummary.affectedRepositories
      }
    })

    const publishedRankings = await repository.findRankings({
      filter: { eventId, roundId, rankingType: 'TEAM' },
      limit: 500
    })

    return {
      publishedAt,
      rankings: publishedRankings.map(normalizeRanking),
      repositoryAccessAction: repositoryActionSummary
    }
  }

  return {
    listRankings,
    generateRankings,
    selectFinalists,
    selectManualFinalists,
    listFinalists,
    publishResults
  }
}

export const RANKING_SERVICE = {
  ...createRankingService(),
  normalizeRanking
}
