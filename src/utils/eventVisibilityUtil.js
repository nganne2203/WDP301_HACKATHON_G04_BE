import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import {
  getActorId,
  getIdString,
  isParticipantOnlyActor,
  isPrivilegedEventActor
} from '#utils/domainAccessUtil.js'

const emptyScope = { $in: [] }

const ensureVisibilityRepository = (repository = {}) => {
  const requiredMethods = [
    'findEventIdsForParticipant',
    'findOpenRegistrationEventIds',
    'findNonDraftEventIds'
  ]
  const missingMethod = requiredMethods.find(method => typeof repository[method] !== 'function')
  if (missingMethod) {
    throw new Error(`Event visibility repository missing ${missingMethod}`)
  }
}

export const findVisibleEventIdsForActor = async ({ actor = {}, repository }) => {
  if (isPrivilegedEventActor(actor)) return null
  ensureVisibilityRepository(repository)

  const actorId = getActorId(actor)
  if (!actorId) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])
  }

  if (isParticipantOnlyActor(actor)) {
    const [participantEventIds, openRegistrationEventIds] = await Promise.all([
      repository.findEventIdsForParticipant(actorId),
      repository.findOpenRegistrationEventIds()
    ])

    return [...new Set([...participantEventIds, ...openRegistrationEventIds]
      .map(getIdString)
      .filter(Boolean))]
  }

  const nonDraftEventIds = await repository.findNonDraftEventIds()
  return nonDraftEventIds.map(getIdString).filter(Boolean)
}

export const applyEventVisibilityScope = async ({ filter = {}, actor = {}, repository }) => {
  const visibleEventIds = await findVisibleEventIdsForActor({ actor, repository })
  if (!visibleEventIds) return filter

  if (filter.eventId) {
    return visibleEventIds.includes(getIdString(filter.eventId))
      ? filter
      : { ...filter, eventId: emptyScope }
  }

  return {
    ...filter,
    eventId: { $in: visibleEventIds }
  }
}

export const ensureCanViewEventChild = async ({
  resource,
  actor = {},
  repository,
  notFoundMessage = 'Resource not found'
}) => {
  if (isPrivilegedEventActor(actor)) return

  const eventId = getIdString(resource?.eventId)
  if (!eventId) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, [notFoundMessage])
  }

  const visibleEventIds = await findVisibleEventIdsForActor({ actor, repository })
  if (!visibleEventIds?.includes(eventId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, [notFoundMessage])
  }
}
