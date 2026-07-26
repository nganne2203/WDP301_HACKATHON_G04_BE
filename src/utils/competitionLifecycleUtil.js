import { ERROR_CODES } from '#constants/errorCode.js'
import ApiError from '#utils/ApiError.js'

export const LOCKED_COMPETITION_MUTATION_STATUSES = new Set(['COMPLETED', 'ARCHIVED'])

export const ensureCompetitionAllowsChildMutations = (competition, resourceLabel = 'Resource') => {
  const status = String(competition?.status || '').toUpperCase()
  if (!LOCKED_COMPETITION_MUTATION_STATUSES.has(status)) return

  throw new ApiError(
    ERROR_CODES.BAD_REQUEST,
    [`${resourceLabel} cannot be changed after the competition has been completed or archived`]
  )
}
