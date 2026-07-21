export const ALLOWED_SCORING_COEFFICIENTS = [4, 10, 100]
export const ALLOWED_TOTAL_WEIGHTS = [10, 100]

export const roundToTwoDecimals = (value = 0) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.round((numericValue + Number.EPSILON) * 100) / 100
}

export const hasAtMostTwoDecimals = (value) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return false
  return Math.abs(numericValue - roundToTwoDecimals(numericValue)) < 1e-9
}

export const isAllowedScoringCoefficient = (value) => {
  return ALLOWED_SCORING_COEFFICIENTS.includes(Number(value))
}

export const sumCriterionWeights = (criteria = []) => {
  return roundToTwoDecimals(criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0))
}

export const isAllowedTotalWeight = (value) => {
  return ALLOWED_TOTAL_WEIGHTS.includes(Number(value))
}

export const getRubricTotalWeight = (rubric = {}) => {
  const totalWeight = Number(rubric.totalScore || 100)
  return isAllowedTotalWeight(totalWeight) ? totalWeight : null
}
