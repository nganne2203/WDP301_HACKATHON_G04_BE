export const mapMongoosePagination = (result) => {
  return {
    currentPage: result.page,
    totalPages: result.totalPages,
    pageSize: result.limit,
    totalItems: result.totalDocs
  }
}

export const normalizePaginationQuery = (query) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10))

  return { page, limit }
}