import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import {
  getActorId,
  getIdString,
  isParticipantOnlyActor,
  isPrivilegedCompetitionActor
} from '#utils/domainAccessUtil.js'

const emptyScope = { $in: [] }

const ensureVisibilityRepository = (repository = {}) => {
  const requiredMethods = [
    'findCompetitionIdsForParticipant',
    'findOpenRegistrationCompetitionIds',
    'findNonDraftCompetitionIds'
  ]
  const missingMethod = requiredMethods.find(method => typeof repository[method] !== 'function')
  if (missingMethod) {
    throw new Error(`Competition visibility repository missing ${missingMethod}`)
  }
}

export const findVisibleCompetitionIdsForActor = async ({ actor = {}, repository }) => {
  if (isPrivilegedCompetitionActor(actor)) return null
  ensureVisibilityRepository(repository)

  const actorId = getActorId(actor)
  if (!actorId) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])
  }

  if (isParticipantOnlyActor(actor)) {
    const [participantCompetitionIds, openRegistrationCompetitionIds] = await Promise.all([
      repository.findCompetitionIdsForParticipant(actorId),
      repository.findOpenRegistrationCompetitionIds()
    ])

    return [...new Set([...participantCompetitionIds, ...openRegistrationCompetitionIds]
      .map(getIdString)
      .filter(Boolean))]
  }

  const nonDraftCompetitionIds = await repository.findNonDraftCompetitionIds()
  return nonDraftCompetitionIds.map(getIdString).filter(Boolean)
}

export const applyCompetitionVisibilityScope = async ({ filter = {}, actor = {}, repository }) => {
  const visibleCompetitionIds = await findVisibleCompetitionIdsForActor({ actor, repository })
  if (!visibleCompetitionIds) return filter

  if (filter.competitionId) {
    return visibleCompetitionIds.includes(getIdString(filter.competitionId))
      ? filter
      : { ...filter, competitionId: emptyScope }
  }

  return {
    ...filter,
    competitionId: { $in: visibleCompetitionIds }
  }
}

export const ensureCanViewCompetitionChild = async ({
  resource,
  actor = {},
  repository,
  notFoundMessage = 'Resource not found'
}) => {
  if (isPrivilegedCompetitionActor(actor)) return

  const competitionId = getIdString(resource?.competitionId)
  if (!competitionId) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, [notFoundMessage])
  }

  const visibleCompetitionIds = await findVisibleCompetitionIdsForActor({ actor, repository })
  if (!visibleCompetitionIds?.includes(competitionId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, [notFoundMessage])
  }
}
