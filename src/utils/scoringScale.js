export const ALLOWED_SCORE_SCALES = [4, 10, 100]

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

export const isAllowedScoreScale = (value) => {
  return ALLOWED_SCORE_SCALES.includes(Number(value))
}

export const sumCriterionWeights = (criteria = []) => {
  return roundToTwoDecimals(criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0))
}

export const getRubricScale = (rubric = {}) => {
  const scale = Number(rubric.totalScore || 100)
  return isAllowedScoreScale(scale) ? scale : null
}
