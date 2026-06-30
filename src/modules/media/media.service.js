import path from 'node:path'
import mongoose from 'mongoose'

import { MEDIA_REPOSITORY } from './media.repository.js'
import { CLOUDINARY_STORAGE, SUPABASE_STORAGE } from './media.storage.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { ENCRYPTION_UTILS } from '#utils/encryption.util.js'
import { LOGGER } from '#utils/logger.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'

const CONFIG_KEYS = {
  provider: 'media.storage_provider',
  supabaseUrl: 'media.supabase_url',
  serviceRoleKey: 'media.supabase_service_role_key_encrypted',
  bucket: 'media.supabase_bucket',
  cloudinaryCloudName: 'media.cloudinary_cloud_name',
  cloudinaryApiKey: 'media.cloudinary_api_key',
  cloudinaryApiSecret: 'media.cloudinary_api_secret_encrypted',
  cloudinaryFolder: 'media.cloudinary_folder',
  visibility: 'media.bucket_visibility',
  maxImageSizeMb: 'media.max_image_size_mb',
  maxVideoSizeMb: 'media.max_video_size_mb',
  maxDocumentSizeMb: 'media.max_document_size_mb',
  allowedImageTypes: 'media.allowed_image_types',
  allowedVideoTypes: 'media.allowed_video_types',
  allowedDocumentTypes: 'media.allowed_document_types'
}

const CONFIG_KEY_LIST = Object.values(CONFIG_KEYS)
const DEFAULT_CONFIG = {
  provider: 'CLOUDINARY',
  bucket: 'event-media',
  cloudinaryFolder: 'event-media',
  visibility: 'private',
  maxImageSizeMb: 10,
  maxVideoSizeMb: 200,
  maxDocumentSizeMb: 50,
  allowedImageTypes: ['jpg', 'jpeg', 'png', 'webp'],
  allowedVideoTypes: ['mp4', 'mov', 'webm'],
  allowedDocumentTypes: ['pdf', 'doc', 'docx', 'ppt', 'pptx']
}

const MEDIA_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']
const ACTIVE_PARTICIPANT_STATUSES = ['ACTIVE']
const UPLOAD_ENABLED_EVENT_STATUSES = ['OPEN_REGISTRATION', 'ONGOING', 'SCORING', 'COMPLETED']
const SIGNED_URL_EXPIRES_IN = 600
const DISALLOWED_EXTENSIONS = new Set(['exe', 'bat', 'sh', 'js'])
const FILE_FIELDS = ['eventId', 'teamId', 'title', 'description']
const STORAGE_PROVIDERS = ['SUPABASE', 'CLOUDINARY']

const EXTENSION_RULES = {
  jpg: { mediaType: 'IMAGE', mimeTypes: ['image/jpeg'] },
  jpeg: { mediaType: 'IMAGE', mimeTypes: ['image/jpeg'] },
  png: { mediaType: 'IMAGE', mimeTypes: ['image/png'] },
  webp: { mediaType: 'IMAGE', mimeTypes: ['image/webp'] },
  mp4: { mediaType: 'VIDEO', mimeTypes: ['video/mp4'] },
  mov: { mediaType: 'VIDEO', mimeTypes: ['video/quicktime'] },
  webm: { mediaType: 'VIDEO', mimeTypes: ['video/webm'] },
  pdf: { mediaType: 'DOCUMENT', mimeTypes: ['application/pdf'] },
  doc: { mediaType: 'DOCUMENT', mimeTypes: ['application/msword'] },
  docx: {
    mediaType: 'DOCUMENT',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  ppt: { mediaType: 'DOCUMENT', mimeTypes: ['application/vnd.ms-powerpoint'] },
  pptx: {
    mediaType: 'DOCUMENT',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation']
  }
}

const getId = (value) => value?._id?.toString?.() || value?.id || value?.toString?.()

const isSameId = (left, right) => {
  const leftId = getId(left)
  const rightId = getId(right)
  return Boolean(leftId && rightId && leftId === rightId)
}

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const normalizePermissionCodes = (actor = {}) => {
  return new Set((actor.permissions || []).map(permission => {
    if (typeof permission === 'string') return permission
    return permission?.code
  }).filter(Boolean))
}

const canModerateMedia = (actor = {}) => {
  return normalizePermissionCodes(actor).has(PERMISSIONS.EVENT_UPDATE)
}

const normalizeTypeList = (value, fallback = []) => {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '').split(',')

  const normalized = rawValues
    .map(item => String(item || '').trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)

  return normalized.length > 0 ? [...new Set(normalized)] : fallback
}

const normalizeProvider = (value) => {
  const normalized = String(value || '').trim().toUpperCase()
  return STORAGE_PROVIDERS.includes(normalized) ? normalized : undefined
}

const toNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const buildEnvMediaConfig = () => {
  const inferredProvider = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
    ? 'CLOUDINARY'
    : undefined
  const provider = normalizeProvider(process.env.MEDIA_STORAGE_PROVIDER)

  return {
    provider,
    inferredProvider,
    supabaseUrl: process.env.SUPABASE_URL || process.env.MEDIA_SUPABASE_URL,
    serviceRoleKeyPlain: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MEDIA_SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_BUCKET || process.env.MEDIA_SUPABASE_BUCKET,
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecretPlain: process.env.CLOUDINARY_API_SECRET,
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER
  }
}

const normalizeConfigRecords = (records = []) => {
  const configByKey = new Map(records.map(record => [record.key, record]))
  const getValue = (key) => configByKey.get(key)?.value
  const envConfig = buildEnvMediaConfig()
  const storedProvider = normalizeProvider(getValue(CONFIG_KEYS.provider))

  return {
    provider: storedProvider || envConfig.provider || envConfig.inferredProvider || DEFAULT_CONFIG.provider,
    supabaseUrl: envConfig.supabaseUrl || getValue(CONFIG_KEYS.supabaseUrl),
    serviceRoleKeyEncrypted: getValue(CONFIG_KEYS.serviceRoleKey),
    serviceRoleKeyPlain: envConfig.serviceRoleKeyPlain,
    bucket: envConfig.bucket || getValue(CONFIG_KEYS.bucket) || DEFAULT_CONFIG.bucket,
    cloudinaryCloudName: envConfig.cloudinaryCloudName || getValue(CONFIG_KEYS.cloudinaryCloudName),
    cloudinaryApiKey: envConfig.cloudinaryApiKey || getValue(CONFIG_KEYS.cloudinaryApiKey),
    cloudinaryApiSecretEncrypted: getValue(CONFIG_KEYS.cloudinaryApiSecret),
    cloudinaryApiSecretPlain: envConfig.cloudinaryApiSecretPlain,
    cloudinaryFolder: envConfig.cloudinaryFolder || getValue(CONFIG_KEYS.cloudinaryFolder) || DEFAULT_CONFIG.cloudinaryFolder,
    visibility: getValue(CONFIG_KEYS.visibility) || DEFAULT_CONFIG.visibility,
    maxImageSizeMb: toNumber(getValue(CONFIG_KEYS.maxImageSizeMb), DEFAULT_CONFIG.maxImageSizeMb),
    maxVideoSizeMb: toNumber(getValue(CONFIG_KEYS.maxVideoSizeMb), DEFAULT_CONFIG.maxVideoSizeMb),
    maxDocumentSizeMb: toNumber(getValue(CONFIG_KEYS.maxDocumentSizeMb), DEFAULT_CONFIG.maxDocumentSizeMb),
    allowedImageTypes: normalizeTypeList(getValue(CONFIG_KEYS.allowedImageTypes), DEFAULT_CONFIG.allowedImageTypes),
    allowedVideoTypes: normalizeTypeList(getValue(CONFIG_KEYS.allowedVideoTypes), DEFAULT_CONFIG.allowedVideoTypes),
    allowedDocumentTypes: normalizeTypeList(getValue(CONFIG_KEYS.allowedDocumentTypes), DEFAULT_CONFIG.allowedDocumentTypes)
  }
}

const normalizeSafeConfig = (config) => {
  return {
    provider: config.provider,
    bucket: config.provider === 'CLOUDINARY' ? config.cloudinaryFolder : config.bucket,
    visibility: config.visibility,
    hasSecret: Boolean(
      config.serviceRoleKeyEncrypted ||
      config.serviceRoleKeyPlain ||
      config.cloudinaryApiSecretEncrypted ||
      config.cloudinaryApiSecretPlain
    )
  }
}

const normalizeActorSummary = (value) => {
  if (!value) return null
  if (typeof value === 'string' || value instanceof mongoose.Types.ObjectId) return { id: value.toString() }

  return {
    id: getId(value),
    email: value.email,
    fullName: value.fullName
  }
}

const normalizeEventSummary = (event) => {
  if (!event) return null
  if (typeof event === 'string' || event instanceof mongoose.Types.ObjectId) return { id: event.toString() }

  return {
    id: getId(event),
    title: event.title,
    status: event.status
  }
}

const normalizeTeamSummary = (team) => {
  if (!team) return null
  if (typeof team === 'string' || team instanceof mongoose.Types.ObjectId) return { id: team.toString() }

  return {
    id: getId(team),
    name: team.name,
    status: team.status
  }
}

const normalizeMedia = (media) => {
  if (!media) return null
  const plainMedia = typeof media.toObject === 'function'
    ? media.toObject({ getters: true, virtuals: false })
    : media

  return {
    id: getId(plainMedia._id) || plainMedia.id,
    eventId: getId(plainMedia.eventId),
    event: normalizeEventSummary(plainMedia.eventId),
    uploadedBy: normalizeActorSummary(plainMedia.uploadedBy),
    uploadedById: getId(plainMedia.uploadedBy),
    teamId: getId(plainMedia.teamId),
    team: normalizeTeamSummary(plainMedia.teamId),
    title: plainMedia.title,
    description: plainMedia.description,
    mediaType: plainMedia.mediaType,
    storageProvider: plainMedia.storageProvider,
    bucketName: plainMedia.bucketName,
    storagePath: plainMedia.storagePath,
    fileUrl: plainMedia.fileUrl,
    originalFileName: plainMedia.originalFileName,
    mimeType: plainMedia.mimeType,
    fileSize: plainMedia.fileSize,
    fileExtension: plainMedia.fileExtension,
    tags: plainMedia.tags || [],
    status: plainMedia.status,
    reviewedBy: normalizeActorSummary(plainMedia.reviewedBy),
    reviewedById: getId(plainMedia.reviewedBy),
    reviewedAt: plainMedia.reviewedAt,
    rejectReason: plainMedia.rejectReason,
    uploadedAt: plainMedia.uploadedAt,
    createdAt: plainMedia.createdAt,
    updatedAt: plainMedia.updatedAt
  }
}

const normalizeTags = (value) => {
  const rawTags = Array.isArray(value)
    ? value
    : (() => {
      const text = String(value || '').trim()
      if (!text) return []
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // Fall back to comma-separated tags.
      }
      return text.split(',')
    })()

  const tags = rawTags
    .map(tag => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 20)

  return [...new Set(tags)]
}

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const buildDateRange = (query = {}, fieldName = 'uploadedAt') => {
  const filter = {}
  let fromDate = query.fromDate ? new Date(query.fromDate) : null
  let toDate = query.toDate ? new Date(query.toDate) : null

  if (query.year && query.month) {
    fromDate = new Date(Date.UTC(Number(query.year), Number(query.month) - 1, 1))
    toDate = new Date(Date.UTC(Number(query.year), Number(query.month), 1))
  } else if (query.year && query.week) {
    const firstDay = new Date(Date.UTC(Number(query.year), 0, 1))
    fromDate = new Date(firstDay.getTime() + ((Number(query.week) - 1) * 7 * 24 * 60 * 60 * 1000))
    toDate = new Date(fromDate.getTime() + (7 * 24 * 60 * 60 * 1000))
  } else if (query.year) {
    fromDate = new Date(Date.UTC(Number(query.year), 0, 1))
    toDate = new Date(Date.UTC(Number(query.year) + 1, 0, 1))
  }

  if (fromDate || toDate) {
    filter[fieldName] = {}
    if (fromDate) filter[fieldName].$gte = fromDate
    if (toDate) filter[fieldName].$lte = query.toDate ? toDate : new Date(toDate.getTime() - 1)
  }

  return filter
}

const buildMediaFilter = (query = {}) => {
  const filter = {
    ...buildDateRange(query)
  }

  if (query.eventId) filter.eventId = query.eventId
  if (query.uploadedBy) filter.uploadedBy = query.uploadedBy
  if (query.teamId) filter.teamId = query.teamId
  if (query.mediaType) filter.mediaType = query.mediaType
  if (query.status) filter.status = query.status

  const tags = normalizeTags(query.tags)
  if (tags.length > 0) {
    filter.tags = { $in: tags }
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [
      { title: pattern },
      { description: pattern },
      { tags: pattern }
    ]
  }

  return filter
}

const buildGalleryFilter = ({ eventId, query = {} }) => {
  const filter = {
    eventId,
    status: 'APPROVED'
  }

  if (query.mediaType) filter.mediaType = query.mediaType

  const tags = normalizeTags(query.tags)
  if (tags.length > 0) {
    filter.tags = { $in: tags }
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [
      { title: pattern },
      { description: pattern },
      { tags: pattern }
    ]
  }

  return filter
}

const getMaxSizeMb = (mediaType, config) => {
  if (mediaType === 'IMAGE') return config.maxImageSizeMb
  if (mediaType === 'VIDEO') return config.maxVideoSizeMb
  return config.maxDocumentSizeMb
}

const getAllowedTypes = (mediaType, config) => {
  if (mediaType === 'IMAGE') return config.allowedImageTypes
  if (mediaType === 'VIDEO') return config.allowedVideoTypes
  return config.allowedDocumentTypes
}

export const validateMediaFile = ({ file, config }) => {
  if (!file?.buffer || !file.originalFileName) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['file is required'])
  }

  const originalFileName = path.basename(String(file.originalFileName).replace(/\0/g, '')).trim()
  const extension = path.extname(originalFileName).replace('.', '').toLowerCase()
  const mimeType = String(file.mimeType || '').split(';')[0].trim().toLowerCase()

  if (!originalFileName || !extension) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['File extension is required'])
  }

  if (DISALLOWED_EXTENSIONS.has(extension)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['File type is not allowed'])
  }

  const rule = EXTENSION_RULES[extension]
  if (!rule) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['File type is not allowed'])
  }

  const allowedTypes = getAllowedTypes(rule.mediaType, config)
  if (!allowedTypes.includes(extension)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`${extension} files are not allowed by media configuration`])
  }

  if (!rule.mimeTypes.includes(mimeType)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['File MIME type does not match its extension'])
  }

  const maxSizeBytes = getMaxSizeMb(rule.mediaType, config) * 1024 * 1024
  if (Number(file.size) > maxSizeBytes) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`${rule.mediaType.toLowerCase()} files must be ${getMaxSizeMb(rule.mediaType, config)}MB or smaller`])
  }

  if (Number(file.size) <= 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['File must not be empty'])
  }

  return {
    originalFileName,
    mimeType,
    fileExtension: extension,
    fileSize: Number(file.size),
    mediaType: rule.mediaType
  }
}

const sanitizeFileName = (originalFileName) => {
  const safeName = path.basename(originalFileName)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return safeName || `media-${Date.now()}`
}

const buildStoragePath = ({ eventId, userId, originalFileName }) => {
  return `events/${eventId}/users/${userId}/${Date.now()}-${sanitizeFileName(originalFileName)}`
}

const createPagination = ({ page, limit, totalItems }) => {
  return {
    currentPage: page,
    totalPages: Math.ceil(totalItems / limit) || 1,
    pageSize: limit,
    totalItems
  }
}

export const createMediaService = ({
  repository = MEDIA_REPOSITORY,
  storage,
  storageClients = {
    SUPABASE: SUPABASE_STORAGE,
    CLOUDINARY: CLOUDINARY_STORAGE
  },
  encryption = ENCRYPTION_UTILS,
  logger = LOGGER
} = {}) => {
  const resolvedStorageClients = storage
    ? {
      SUPABASE: storage,
      CLOUDINARY: storage
    }
    : storageClients

  const audit = async ({ actor, action, resourceType = 'Media', resourceId, metadata = {} }) => {
    try {
      await repository.createAuditLog({
        userId: actor?.id,
        action,
        resourceType,
        resourceId,
        metadata
      })
    } catch (error) {
      logger.error('Media audit log creation failed', {
        action,
        error: error.message
      })
    }
  }

  const loadStoredConfig = async () => {
    return normalizeConfigRecords(await repository.findConfigsByKeys(CONFIG_KEY_LIST))
  }

  const loadOperationalConfig = async () => {
    const config = await loadStoredConfig()

    if (config.provider === 'SUPABASE') {
      if (!config.supabaseUrl) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Supabase URL is not configured'])
      }

      let serviceRoleKey = config.serviceRoleKeyPlain
      if (!serviceRoleKey) {
        if (!config.serviceRoleKeyEncrypted) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Supabase service role key is not configured'])
        }

        try {
          serviceRoleKey = encryption.decrypt(config.serviceRoleKeyEncrypted)
        } catch (error) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, [
            `Could not decrypt Supabase service role key: ${error.message}`
          ])
        }
      }

      return {
        ...config,
        serviceRoleKey
      }
    }

    if (config.provider === 'CLOUDINARY') {
      if (!config.cloudinaryCloudName) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cloudinary cloud name is not configured'])
      }

      if (!config.cloudinaryApiKey) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cloudinary API key is not configured'])
      }

      let cloudinaryApiSecret = config.cloudinaryApiSecretPlain
      if (!cloudinaryApiSecret) {
        if (!config.cloudinaryApiSecretEncrypted) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Cloudinary API secret is not configured'])
        }

        try {
          cloudinaryApiSecret = encryption.decrypt(config.cloudinaryApiSecretEncrypted)
        } catch (error) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, [
            `Could not decrypt Cloudinary API secret: ${error.message}`
          ])
        }
      }

      return {
        ...config,
        cloudinaryApiSecret
      }
    }

    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Media storage provider is not supported'])
  }

  const getStorageConfig = async () => {
    return normalizeSafeConfig(await loadStoredConfig())
  }

  const saveStorageConfig = async (payload = {}, actor = {}) => {
    const existingConfig = await loadStoredConfig()
    const provider = normalizeProvider(payload.provider) || existingConfig.provider || DEFAULT_CONFIG.provider
    const configUpdates = [
      { key: CONFIG_KEYS.provider, value: provider, isEncrypted: false },
      { key: CONFIG_KEYS.supabaseUrl, value: payload.supabaseUrl || '', isEncrypted: false },
      { key: CONFIG_KEYS.bucket, value: payload.bucket || DEFAULT_CONFIG.bucket, isEncrypted: false },
      { key: CONFIG_KEYS.cloudinaryCloudName, value: payload.cloudinaryCloudName || '', isEncrypted: false },
      { key: CONFIG_KEYS.cloudinaryApiKey, value: payload.cloudinaryApiKey || '', isEncrypted: false },
      { key: CONFIG_KEYS.cloudinaryFolder, value: payload.cloudinaryFolder || DEFAULT_CONFIG.cloudinaryFolder, isEncrypted: false },
      { key: CONFIG_KEYS.visibility, value: payload.visibility || DEFAULT_CONFIG.visibility, isEncrypted: false },
      { key: CONFIG_KEYS.maxImageSizeMb, value: payload.maxImageSizeMb || DEFAULT_CONFIG.maxImageSizeMb, isEncrypted: false },
      { key: CONFIG_KEYS.maxVideoSizeMb, value: payload.maxVideoSizeMb || DEFAULT_CONFIG.maxVideoSizeMb, isEncrypted: false },
      { key: CONFIG_KEYS.maxDocumentSizeMb, value: payload.maxDocumentSizeMb || DEFAULT_CONFIG.maxDocumentSizeMb, isEncrypted: false },
      { key: CONFIG_KEYS.allowedImageTypes, value: payload.allowedImageTypes || DEFAULT_CONFIG.allowedImageTypes, isEncrypted: false },
      { key: CONFIG_KEYS.allowedVideoTypes, value: payload.allowedVideoTypes || DEFAULT_CONFIG.allowedVideoTypes, isEncrypted: false },
      { key: CONFIG_KEYS.allowedDocumentTypes, value: payload.allowedDocumentTypes || DEFAULT_CONFIG.allowedDocumentTypes, isEncrypted: false }
    ]

    if (payload.serviceRoleKey) {
      let encryptedServiceRoleKey
      try {
        encryptedServiceRoleKey = encryption.encrypt(payload.serviceRoleKey)
      } catch (error) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, [
          `Could not encrypt Supabase service role key: ${error.message}`
        ])
      }

      configUpdates.push({
        key: CONFIG_KEYS.serviceRoleKey,
        value: encryptedServiceRoleKey,
        isEncrypted: true
      })
    }

    if (payload.cloudinaryApiSecret) {
      let encryptedCloudinaryApiSecret
      try {
        encryptedCloudinaryApiSecret = encryption.encrypt(payload.cloudinaryApiSecret)
      } catch (error) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, [
          `Could not encrypt Cloudinary API secret: ${error.message}`
        ])
      }

      configUpdates.push({
        key: CONFIG_KEYS.cloudinaryApiSecret,
        value: encryptedCloudinaryApiSecret,
        isEncrypted: true
      })
    }

    await Promise.all(configUpdates.map(update => repository.upsertConfig({
      ...update,
      updatedBy: actor.id
    })))

    await audit({
      actor,
      action: 'MEDIA_CONFIG_UPDATED',
      resourceType: 'SystemConfiguration',
      metadata: {
        provider,
        bucket: provider === 'CLOUDINARY'
          ? (payload.cloudinaryFolder || DEFAULT_CONFIG.cloudinaryFolder)
          : (payload.bucket || DEFAULT_CONFIG.bucket),
        visibility: payload.visibility || DEFAULT_CONFIG.visibility,
        secretUpdated: Boolean(payload.serviceRoleKey || payload.cloudinaryApiSecret),
        hadSecretBeforeUpdate: Boolean(
          existingConfig.serviceRoleKeyEncrypted ||
          existingConfig.serviceRoleKeyPlain ||
          existingConfig.cloudinaryApiSecretEncrypted ||
          existingConfig.cloudinaryApiSecretPlain
        )
      }
    })

    return await getStorageConfig()
  }

  const ensureEventExists = async (eventId) => {
    ensureObjectId(eventId, 'event id')
    const event = await repository.findEventById(eventId)
    if (!event) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }

    return event
  }

  const ensureParticipantJoinedEvent = async ({ eventId, userId }) => {
    const participant = await repository.findParticipantByEventAndUser({ eventId, userId })
    if (!participant || !ACTIVE_PARTICIPANT_STATUSES.includes(participant.status)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You must join this event before uploading media'])
    }

    return participant
  }

  const ensureUploadsEnabled = (event) => {
    if (!UPLOAD_ENABLED_EVENT_STATUSES.includes(event.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Media uploads are not enabled for this event status'])
    }
  }

  const resolveTeamId = async ({ payloadTeamId, participant, eventId }) => {
    const participantTeamId = getId(participant?.teamId)
    const requestedTeamId = payloadTeamId || participantTeamId

    if (!requestedTeamId) return undefined

    ensureObjectId(requestedTeamId, 'team id')
    const team = await repository.findTeamById(requestedTeamId)
    if (!team || !isSameId(team.eventId, eventId)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team does not belong to this event'])
    }

    if (participant && (!participantTeamId || participantTeamId !== requestedTeamId)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You can upload media only for your own team'])
    }

    return requestedTeamId
  }

  const uploadMedia = async (payload = {}, file, actor = {}) => {
    const safePayload = pickSafeFields(payload, FILE_FIELDS)
    const event = await ensureEventExists(safePayload.eventId)
    ensureUploadsEnabled(event)
    const canUploadForEvent = canModerateMedia(actor)

    const participant = canUploadForEvent
      ? null
      : await ensureParticipantJoinedEvent({
        eventId: safePayload.eventId,
        userId: actor.id
      })
    const teamId = canUploadForEvent && !safePayload.teamId
      ? undefined
      : await resolveTeamId({
        payloadTeamId: safePayload.teamId,
        participant,
        eventId: safePayload.eventId
      })
    const config = await loadOperationalConfig()
    const fileMetadata = validateMediaFile({ file, config })
    const storagePath = buildStoragePath({
      eventId: safePayload.eventId,
      userId: actor.id,
      originalFileName: fileMetadata.originalFileName
    })
    const storageClient = resolvedStorageClients[config.provider]
    if (!storageClient) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Unsupported media storage provider: ${config.provider}`])
    }

    const uploadResult = config.provider === 'CLOUDINARY'
      ? await storageClient.uploadObject({
        cloudName: config.cloudinaryCloudName,
        apiKey: config.cloudinaryApiKey,
        apiSecret: config.cloudinaryApiSecret,
        folder: config.cloudinaryFolder,
        storagePath,
        buffer: file.buffer,
        mimeType: fileMetadata.mimeType,
        mediaType: fileMetadata.mediaType
      })
      : await storageClient.uploadObject({
        supabaseUrl: config.supabaseUrl,
        serviceRoleKey: config.serviceRoleKey,
        bucket: config.bucket,
        storagePath,
        buffer: file.buffer,
        mimeType: fileMetadata.mimeType
      })

    let media
    try {
      media = await repository.createMedia({
        eventId: safePayload.eventId,
        uploadedBy: actor.id,
        teamId,
        title: safePayload.title,
        description: safePayload.description,
        mediaType: fileMetadata.mediaType,
        storageProvider: config.provider,
        bucketName: config.provider === 'CLOUDINARY' ? config.cloudinaryFolder : config.bucket,
        storagePath: uploadResult.storagePath || storagePath,
        fileUrl: uploadResult.fileUrl,
        originalFileName: fileMetadata.originalFileName,
        mimeType: fileMetadata.mimeType,
        fileSize: fileMetadata.fileSize,
        fileExtension: fileMetadata.fileExtension,
        tags: normalizeTags(payload.tags),
        status: 'PENDING',
        uploadedAt: new Date()
      })
    } catch (error) {
      const uploadedStoragePath = uploadResult.storagePath || storagePath
      const cleanupPromise = config.provider === 'CLOUDINARY'
        ? storageClient.deleteObject({
          cloudName: config.cloudinaryCloudName,
          apiKey: config.cloudinaryApiKey,
          apiSecret: config.cloudinaryApiSecret,
          storagePath: uploadedStoragePath,
          mediaType: fileMetadata.mediaType
        })
        : storageClient.deleteObject({
          supabaseUrl: config.supabaseUrl,
          serviceRoleKey: config.serviceRoleKey,
          bucket: config.bucket,
          storagePath: uploadedStoragePath
        })

      await cleanupPromise.catch(cleanupError => logger.warn('Could not clean up uploaded media after media save failure', {
        storagePath: uploadedStoragePath,
        error: cleanupError.message
      }))
      throw error
    }

    await repository.createActivity({
      mediaId: media._id,
      eventId: media.eventId,
      userId: actor.id,
      action: 'UPLOAD',
      metadata: {
        storagePath: uploadResult.storagePath || storagePath,
        mediaType: media.mediaType,
        fileSize: media.fileSize
      }
    })

    await audit({
      actor,
      action: 'MEDIA_UPLOADED',
      resourceId: media._id,
      metadata: {
        eventId: getId(media.eventId),
        teamId,
        mediaType: media.mediaType,
        fileSize: media.fileSize
      }
    })

    return normalizeMedia(await repository.findMediaById(media._id))
  }

  const listMyHistory = async (query = {}, actor = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = {
      ...buildMediaFilter(query),
      uploadedBy: actor.id
    }
    const skip = (page - 1) * limit
    const [media, totalItems] = await Promise.all([
      repository.findMedia({ filter, skip, limit }),
      repository.countMedia(filter)
    ])

    return {
      media: media.map(normalizeMedia),
      pagination: createPagination({ page, limit, totalItems })
    }
  }

  const listAdminMedia = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildMediaFilter(query)
    const skip = (page - 1) * limit
    const [media, totalItems] = await Promise.all([
      repository.findMedia({ filter, skip, limit }),
      repository.countMedia(filter)
    ])

    return {
      media: media.map(normalizeMedia),
      pagination: createPagination({ page, limit, totalItems })
    }
  }

  const getEventGallery = async (eventId, query = {}) => {
    await ensureEventExists(eventId)

    const filter = buildGalleryFilter({ eventId, query })
    const media = await repository.findMedia({
      filter,
      skip: 0,
      limit: 100,
      sort: { uploadedAt: -1, createdAt: -1 }
    })
    const normalizedMedia = media.map(normalizeMedia)
    const statistics = {
      totalUploads: normalizedMedia.length,
      totalImages: normalizedMedia.filter(item => item.mediaType === 'IMAGE').length,
      totalVideos: normalizedMedia.filter(item => item.mediaType === 'VIDEO').length,
      totalDocuments: normalizedMedia.filter(item => item.mediaType === 'DOCUMENT').length
    }

    return {
      images: normalizedMedia.filter(item => item.mediaType === 'IMAGE'),
      videos: normalizedMedia.filter(item => item.mediaType === 'VIDEO'),
      documents: normalizedMedia.filter(item => item.mediaType === 'DOCUMENT'),
      statistics
    }
  }

  const ensureMediaExists = async (mediaId) => {
    ensureObjectId(mediaId, 'media id')
    const media = await repository.findMediaById(mediaId)
    if (!media) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Media not found'])
    }

    return media
  }

  const ensureCanAccessMedia = (media, actor = {}) => {
    if (canModerateMedia(actor)) return
    if (isSameId(media.uploadedBy, actor.id)) return
    if (media.status === 'APPROVED') return

    throw new ApiError(ERROR_CODES.FORBIDDEN, ['You cannot access this media item'])
  }

  const getSignedUrl = async (mediaId, actor = {}) => {
    const media = await ensureMediaExists(mediaId)
    ensureCanAccessMedia(media, actor)
    await ensureEventExists(getId(media.eventId))

    const config = await loadOperationalConfig()
    const storageClient = resolvedStorageClients[config.provider]
    if (!storageClient) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Unsupported media storage provider: ${config.provider}`])
    }

    const result = config.provider === 'CLOUDINARY'
      ? await storageClient.createSignedUrl({
        fileUrl: media.fileUrl,
        expiresIn: SIGNED_URL_EXPIRES_IN
      })
      : await storageClient.createSignedUrl({
        supabaseUrl: config.supabaseUrl,
        serviceRoleKey: config.serviceRoleKey,
        bucket: media.bucketName || config.bucket,
        storagePath: media.storagePath,
        expiresIn: SIGNED_URL_EXPIRES_IN
      })

    await repository.createActivity({
      mediaId: media._id,
      eventId: media.eventId,
      userId: actor.id,
      action: 'VIEW',
      metadata: {
        expiresIn: SIGNED_URL_EXPIRES_IN
      }
    })

    await audit({
      actor,
      action: 'MEDIA_VIEWED',
      resourceId: media._id,
      metadata: {
        eventId: getId(media.eventId),
        expiresIn: SIGNED_URL_EXPIRES_IN
      }
    })

    return result
  }

  const ensureCanDeleteMedia = (media, actor = {}) => {
    if (canModerateMedia(actor)) return

    if (isSameId(media.uploadedBy, actor.id) && media.status === 'PENDING') return

    throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only your own pending media can be deleted'])
  }

  const deleteMedia = async (mediaId, actor = {}) => {
    const media = await ensureMediaExists(mediaId)
    ensureCanDeleteMedia(media, actor)
    const config = await loadOperationalConfig()
    const storageClient = resolvedStorageClients[config.provider]
    if (!storageClient) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Unsupported media storage provider: ${config.provider}`])
    }

    if (config.provider === 'CLOUDINARY') {
      await storageClient.deleteObject({
        cloudName: config.cloudinaryCloudName,
        apiKey: config.cloudinaryApiKey,
        apiSecret: config.cloudinaryApiSecret,
        storagePath: media.storagePath,
        mediaType: media.mediaType
      })
    } else {
      await storageClient.deleteObject({
        supabaseUrl: config.supabaseUrl,
        serviceRoleKey: config.serviceRoleKey,
        bucket: media.bucketName || config.bucket,
        storagePath: media.storagePath
      })
    }

    await repository.createActivity({
      mediaId: media._id,
      eventId: media.eventId,
      userId: actor.id,
      action: 'DELETE',
      metadata: {
        statusBeforeDelete: media.status,
        storagePath: media.storagePath
      }
    })

    await repository.deleteMediaById(media._id)

    await audit({
      actor,
      action: 'MEDIA_DELETED',
      resourceId: media._id,
      metadata: {
        eventId: getId(media.eventId),
        storagePath: media.storagePath,
        statusBeforeDelete: media.status
      }
    })
  }

  const approveMedia = async (mediaId, actor = {}) => {
    const media = await ensureMediaExists(mediaId)
    const updatedMedia = await repository.updateMediaById(media._id, {
      status: 'APPROVED',
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      rejectReason: undefined
    })

    await repository.createActivity({
      mediaId: media._id,
      eventId: media.eventId,
      userId: actor.id,
      action: 'APPROVE',
      metadata: {}
    })

    await audit({
      actor,
      action: 'MEDIA_APPROVED',
      resourceId: media._id,
      metadata: {
        eventId: getId(media.eventId)
      }
    })

    return normalizeMedia(updatedMedia)
  }

  const rejectMedia = async (mediaId, reason, actor = {}) => {
    const media = await ensureMediaExists(mediaId)
    const updatedMedia = await repository.updateMediaById(media._id, {
      status: 'REJECTED',
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      rejectReason: reason
    })

    await repository.createActivity({
      mediaId: media._id,
      eventId: media.eventId,
      userId: actor.id,
      action: 'REJECT',
      metadata: { reason }
    })

    await audit({
      actor,
      action: 'MEDIA_REJECTED',
      resourceId: media._id,
      metadata: {
        eventId: getId(media.eventId),
        reason
      }
    })

    return normalizeMedia(updatedMedia)
  }

  const aggregateCounts = async ({ filter, groupField }) => {
    return await repository.aggregateMedia([
      { $match: filter },
      { $group: { _id: `$${groupField}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  }

  const aggregateDateCounts = async ({ filter, format }) => {
    return await repository.aggregateMedia([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format, date: '$uploadedAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  }

  const getStatistics = async (query = {}) => {
    const filter = {
      ...buildDateRange(query)
    }
    if (query.eventId) filter.eventId = new mongoose.Types.ObjectId(query.eventId)

    const activityFilter = {
      action: 'VIEW',
      ...buildDateRange(query, 'createdAt')
    }
    if (query.eventId) activityFilter.eventId = new mongoose.Types.ObjectId(query.eventId)

    const [
      totalUploads,
      byStatus,
      byEvent,
      byTeam,
      byParticipant,
      byMediaType,
      byDay,
      byWeek,
      byMonth,
      mostViewedMedia
    ] = await Promise.all([
      repository.countMedia(filter),
      aggregateCounts({ filter, groupField: 'status' }),
      aggregateCounts({ filter, groupField: 'eventId' }),
      aggregateCounts({ filter: { ...filter, teamId: { $exists: true, $ne: null } }, groupField: 'teamId' }),
      aggregateCounts({ filter, groupField: 'uploadedBy' }),
      aggregateCounts({ filter, groupField: 'mediaType' }),
      aggregateDateCounts({ filter, format: '%Y-%m-%d' }),
      aggregateDateCounts({ filter, format: '%Y-%U' }),
      aggregateDateCounts({ filter, format: '%Y-%m' }),
      repository.aggregateActivity([
        { $match: activityFilter },
        { $group: { _id: '$mediaId', views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 }
      ])
    ])

    const statusCounts = Object.fromEntries(MEDIA_STATUSES.map(status => [status, 0]))
    for (const item of byStatus) {
      if (item._id) statusCounts[item._id] = item.count
    }

    return {
      totalUploads,
      pending: statusCounts.PENDING,
      approved: statusCounts.APPROVED,
      rejected: statusCounts.REJECTED,
      uploadsByEvent: byEvent.map(item => ({ eventId: getId(item._id), count: item.count })),
      uploadsByTeam: byTeam.map(item => ({ teamId: getId(item._id), count: item.count })),
      uploadsByParticipant: byParticipant.map(item => ({ participantId: getId(item._id), count: item.count })),
      uploadsByDay: byDay.map(item => ({ day: item._id, count: item.count })),
      uploadsByWeek: byWeek.map(item => ({ week: item._id, count: item.count })),
      uploadsByMonth: byMonth.map(item => ({ month: item._id, count: item.count })),
      uploadsByMediaType: byMediaType.map(item => ({ mediaType: item._id, count: item.count })),
      mostActiveParticipants: byParticipant.slice(0, 10).map(item => ({ participantId: getId(item._id), uploads: item.count })),
      mostViewedMedia: mostViewedMedia.map(item => ({ mediaId: getId(item._id), views: item.views }))
    }
  }

  return {
    getStorageConfig,
    saveStorageConfig,
    uploadMedia,
    listMyHistory,
    listAdminMedia,
    getEventGallery,
    getSignedUrl,
    deleteMedia,
    approveMedia,
    rejectMedia,
    getStatistics
  }
}

export const MEDIA_SERVICE = createMediaService()
