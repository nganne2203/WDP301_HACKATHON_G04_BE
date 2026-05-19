class ApiError extends Error {
  constructor(errorCode, errors) {
    super(errorCode.message)
    this.statusCode = errorCode.statusCode
    this.code = errorCode.code
    this.errors = errors || []
    Error.captureStackTrace(this, this.constructor)
  }
}

export default ApiError