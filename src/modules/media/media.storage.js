import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '')

const encodeStoragePath = (path) => {
  return String(path || '')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

const parseResponseBody = async (response) => {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const getStorageError = (data, fallback) => {
  if (!data) return fallback
  if (typeof data === 'string') return data
  return data.message || data.error || fallback
}

export const createSupabaseStorageClient = ({ fetchImpl = globalThis.fetch } = {}) => {
  if (!fetchImpl) {
    throw new Error('Fetch API is not available in this Node.js runtime')
  }

  const request = async ({ method, supabaseUrl, serviceRoleKey, path, contentType, body }) => {
    const response = await fetchImpl(`${trimTrailingSlash(supabaseUrl)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        ...(contentType ? { 'Content-Type': contentType } : {}),
        ...(method === 'POST' || method === 'DELETE' ? { 'x-upsert': 'false' } : {})
      },
      body
    })

    const data = await parseResponseBody(response)
    if (!response.ok) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [
        `Supabase Storage error (${response.status}): ${getStorageError(data, response.statusText)}`
      ])
    }

    return { data, status: response.status }
  }

  const uploadObject = async ({ supabaseUrl, serviceRoleKey, bucket, storagePath, buffer, mimeType }) => {
    await request({
      method: 'POST',
      supabaseUrl,
      serviceRoleKey,
      path: `/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(storagePath)}`,
      contentType: mimeType,
      body: buffer
    })

    return {
      fileUrl: `${trimTrailingSlash(supabaseUrl)}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(storagePath)}`
    }
  }

  const createSignedUrl = async ({ supabaseUrl, serviceRoleKey, bucket, storagePath, expiresIn }) => {
    const { data } = await request({
      method: 'POST',
      supabaseUrl,
      serviceRoleKey,
      path: `/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeStoragePath(storagePath)}`,
      contentType: 'application/json',
      body: JSON.stringify({ expiresIn })
    })

    const signedPath = data?.signedURL || data?.signedUrl || data?.url
    if (!signedPath) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Supabase did not return a signed URL'])
    }

    const signedUrl = String(signedPath).startsWith('http')
      ? signedPath
      : `${trimTrailingSlash(supabaseUrl)}${String(signedPath).startsWith('/') ? '' : '/storage/v1'}${signedPath}`

    return {
      signedUrl,
      expiresIn
    }
  }

  const deleteObject = async ({ supabaseUrl, serviceRoleKey, bucket, storagePath }) => {
    return await request({
      method: 'DELETE',
      supabaseUrl,
      serviceRoleKey,
      path: `/storage/v1/object/${encodeURIComponent(bucket)}`,
      contentType: 'application/json',
      body: JSON.stringify({ prefixes: [storagePath] })
    })
  }

  return {
    uploadObject,
    createSignedUrl,
    deleteObject
  }
}

export const SUPABASE_STORAGE = createSupabaseStorageClient()
