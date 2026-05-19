export const pickSafeFields = (data, allowedFields = []) => {
  const safeData = {}

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      safeData[field] = data[field]
    }
  }

  return safeData
}
