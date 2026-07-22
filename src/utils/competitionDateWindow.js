const COMPETITION_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export const formatCompetitionDateKey = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: COMPETITION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

const formatCompetitionBoundaryDateKey = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10)
}

export const isWithinCompetitionDateWindow = ({ competition, value }) => {
  if (!value) return true
  const dateKey = formatCompetitionDateKey(value)
  if (!dateKey) return false

  const startKey = formatCompetitionBoundaryDateKey(competition?.startDate)
  const endKey = formatCompetitionBoundaryDateKey(competition?.endDate)
  return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey)
}
