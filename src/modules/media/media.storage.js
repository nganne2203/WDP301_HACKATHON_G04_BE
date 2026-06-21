import crypto from 'node:crypto'

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

const createBadRequest = (message) => {
  return new ApiError(ERROR_CODES.BAD_REQUEST, [message])
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
      throw createBadRequest(`Supabase Storage error (${response.status}): ${getStorageError(data, response.statusText)}`)
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
      fileUrl: `${trimTrailingSlash(supabaseUrl)}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(storagePath)}`,
      storagePath
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
      throw createBadRequest('Supabase did not return a signed URL')
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

const CLOUDINARY_RESOURCE_TYPE_MAP = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'raw'
}

const createCloudinarySignature = (params, apiSecret) => {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return crypto
    .createHash('sha1')
    .update(`${payload}${apiSecret}`)
    .digest('hex')
}

export const createCloudinaryStorageClient = ({ fetchImpl = globalThis.fetch } = {}) => {
  if (!fetchImpl) {
    throw new Error('Fetch API is not available in this Node.js runtime')
  }

  const uploadObject = async ({
    cloudName,
    apiKey,
    apiSecret,
    folder,
    storagePath,
    buffer,
    mimeType,
    mediaType
  }) => {
    const timestamp = Math.floor(Date.now() / 1000)
    const publicId = storagePath.replace(/\.[^.]+$/, '')
    const resourceType = CLOUDINARY_RESOURCE_TYPE_MAP[mediaType] || 'raw'
    const paramsToSign = {
      folder,
      public_id: publicId,
      timestamp
    }
    const signature = createCloudinarySignature(paramsToSign, apiSecret)
    const form = new FormData()

    form.set('file', new Blob([buffer], { type: mimeType }))
    form.set('api_key', apiKey)
    form.set('timestamp', String(timestamp))
    form.set('signature', signature)
    form.set('public_id', publicId)
    if (folder) form.set('folder', folder)

    const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: form
    })

    const data = await parseResponseBody(response)
    if (!response.ok) {
      throw createBadRequest(`Cloudinary upload error (${response.status}): ${getStorageError(data, response.statusText)}`)
    }

    if (!data?.secure_url || !data?.public_id) {
      throw createBadRequest('Cloudinary did not return an uploaded file URL')
    }

    return {
      fileUrl: data.secure_url,
      storagePath: data.public_id,
      resourceType: data.resource_type || resourceType
    }
  }

  const createSignedUrl = async ({ fileUrl, expiresIn }) => {
    if (!fileUrl) {
      throw createBadRequest('Cloudinary file URL is not available for this media item')
    }

    return {
      signedUrl: fileUrl,
      expiresIn
    }
  }

  const deleteObject = async ({
    cloudName,
    apiKey,
    apiSecret,
    storagePath,
    mediaType
  }) => {
    const timestamp = Math.floor(Date.now() / 1000)
    const resourceType = CLOUDINARY_RESOURCE_TYPE_MAP[mediaType] || 'raw'
    const paramsToSign = {
      invalidate: true,
      public_id: storagePath,
      timestamp
    }
    const signature = createCloudinarySignature(paramsToSign, apiSecret)
    const form = new FormData()

    form.set('public_id', storagePath)
    form.set('api_key', apiKey)
    form.set('timestamp', String(timestamp))
    form.set('signature', signature)
    form.set('invalidate', 'true')

    const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: 'POST',
      body: form
    })

    const data = await parseResponseBody(response)
    if (!response.ok) {
      throw createBadRequest(`Cloudinary delete error (${response.status}): ${getStorageError(data, response.statusText)}`)
    }

    return data
  }

  return {
    uploadObject,
    createSignedUrl,
    deleteObject
  }
}

export const SUPABASE_STORAGE = createSupabaseStorageClient()
export const CLOUDINARY_STORAGE = createCloudinaryStorageClient()
