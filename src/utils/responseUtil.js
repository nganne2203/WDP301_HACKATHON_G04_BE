export const responseSuccess = ({
  data = null,
  message = 'Request was successful.',
  pagination = null
}) => {
  return {
    success: true,
    message,
    data,
    pagination
  }
}