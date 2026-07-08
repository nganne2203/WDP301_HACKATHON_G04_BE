import assert from 'node:assert/strict'
import test from 'node:test'

import { createMediaService, validateMediaFile } from '../src/modules/media/media.service.js'
import { PERMISSIONS } from '../src/constants/permissions.js'
import ApiError from '../src/utils/ApiError.js'

const EVENT_ID = '664c3f6a3a6d4a5f3f93c101'
const USER_ID = '664c3f6a3a6d4a5f3f93c102'
const TEAM_ID = '664c3f6a3a6d4a5f3f93c103'
const MEDIA_ID = '664c3f6a3a6d4a5f3f93c104'

const createLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {}
})

const createEncryption = () => ({
  encrypt: (value) => `encrypted:${value}`,
  decrypt: (value) => String(value).replace(/^encrypted:/, '')
})

const createBaseConfigRecords = () => ([
  { key: 'media.storage_provider', value: 'SUPABASE' },
  { key: 'media.supabase_url', value: 'https://project.supabase.co' },
  { key: 'media.supabase_service_role_key_encrypted', value: 'encrypted:service-role-secret', isEncrypted: true },
  { key: 'media.supabase_bucket', value: 'event-media' },
  { key: 'media.bucket_visibility', value: 'private' },
  { key: 'media.max_image_size_mb', value: 10 },
  { key: 'media.max_video_size_mb', value: 200 },
  { key: 'media.max_document_size_mb', value: 50 },
  { key: 'media.allowed_image_types', value: ['jpg', 'jpeg', 'png', 'webp'] },
  { key: 'media.allowed_video_types', value: ['mp4', 'mov', 'webm'] },
  { key: 'media.allowed_document_types', value: ['pdf', 'doc', 'docx', 'ppt', 'pptx'] }
])

const buildRepository = (overrides = {}) => {
  const configs = new Map(createBaseConfigRecords().map(record => [record.key, record]))
  const mediaRecords = new Map()
  const activities = []
  const auditLogs = []

  const repository = {
    configs,
    mediaRecords,
    activities,
    auditLogs,
    findConfigsByKeys: async (keys) => keys.map(key => configs.get(key)).filter(Boolean),
    upsertConfig: async ({ key, value, isEncrypted, updatedBy }) => {
      const record = { key, value, isEncrypted, updatedBy }
      configs.set(key, record)
      return record
    },
    findEventById: async () => ({
      _id: EVENT_ID,
      title: 'SEAL Hackathon',
      status: 'ONGOING'
    }),
    findParticipantByEventAndUser: async () => ({
      _id: 'participant-1',
      eventId: EVENT_ID,
      userId: USER_ID,
      teamId: TEAM_ID,
      status: 'JOINED'
    }),
    findTeamById: async () => ({
      _id: TEAM_ID,
      eventId: EVENT_ID,
      name: 'Team Alpha'
    }),
    createMedia: async (payload) => {
      const media = {
        _id: MEDIA_ID,
        ...payload,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T00:00:00.000Z')
      }
      mediaRecords.set(MEDIA_ID, media)
      return media
    },
    findMediaById: async (id) => mediaRecords.get(String(id)) || null,
    updateMediaById: async (id, payload) => {
      const current = mediaRecords.get(String(id))
      const next = { ...current, ...payload }
      mediaRecords.set(String(id), next)
      return next
    },
    deleteMediaById: async (id) => {
      const current = mediaRecords.get(String(id))
      mediaRecords.delete(String(id))
      return current
    },
    countMedia: async () => mediaRecords.size,
    findMedia: async () => [...mediaRecords.values()],
    createActivity: async (payload) => {
      activities.push(payload)
      return payload
    },
    createAuditLog: async (payload) => {
      auditLogs.push(payload)
      return payload
    },
    aggregateMedia: async () => [],
    aggregateActivity: async () => [],
    ...overrides
  }

  return repository
}

const createStorage = () => {
  const uploaded = []
  const deleted = []

  return {
    uploaded,
    deleted,
    uploadObject: async (payload) => {
      uploaded.push(payload)
      return {
        fileUrl: `${payload.supabaseUrl}/storage/v1/object/${payload.bucket}/${payload.storagePath}`
      }
    },
    createSignedUrl: async (payload) => ({
      signedUrl: `${payload.supabaseUrl}/signed/${payload.storagePath}`,
      expiresIn: payload.expiresIn
    }),
    deleteObject: async (payload) => {
      deleted.push(payload)
      return { status: 200 }
    }
  }
}

test('media storage config is stored safely and never exposes service role key', async () => {
  const repository = buildRepository()
  const service = createMediaService({
    repository,
    storage: createStorage(),
    encryption: createEncryption(),
    logger: createLogger()
  })

  const saved = await service.saveStorageConfig({
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'new-secret',
    bucket: 'event-media',
    visibility: 'private',
    maxImageSizeMb: 10,
    maxVideoSizeMb: 200,
    maxDocumentSizeMb: 50,
    allowedImageTypes: ['jpg', 'jpeg', 'png', 'webp'],
    allowedVideoTypes: ['mp4', 'mov', 'webm'],
    allowedDocumentTypes: ['pdf', 'doc', 'docx', 'ppt', 'pptx']
  }, { id: USER_ID })

  assert.deepEqual(saved, {
    provider: 'SUPABASE',
    bucket: 'event-media',
    visibility: 'private',
    hasSecret: true
  })
  assert.equal(repository.configs.get('media.supabase_service_role_key_encrypted').value, 'encrypted:new-secret')
  assert.equal(repository.configs.get('media.supabase_service_role_key_encrypted').isEncrypted, true)
  assert.equal(Object.hasOwn(saved, 'serviceRoleKey'), false)
})

test('validateMediaFile rejects mismatched MIME types and blocked extensions', () => {
  const config = {
    maxImageSizeMb: 10,
    maxVideoSizeMb: 200,
    maxDocumentSizeMb: 50,
    allowedImageTypes: ['jpg', 'jpeg', 'png', 'webp'],
    allowedVideoTypes: ['mp4', 'mov', 'webm'],
    allowedDocumentTypes: ['pdf', 'doc', 'docx', 'ppt', 'pptx']
  }

  assert.throws(
    () => validateMediaFile({
      config,
      file: {
        originalFileName: 'team-photo.jpg',
        mimeType: 'application/pdf',
        size: 100,
        buffer: Buffer.from('x')
      }
    }),
    error => error instanceof ApiError && error.code === 'BAD_REQUEST'
  )

  assert.throws(
    () => validateMediaFile({
      config,
      file: {
        originalFileName: 'run.sh',
        mimeType: 'text/x-shellscript',
        size: 100,
        buffer: Buffer.from('x')
      }
    }),
    error => error instanceof ApiError && error.code === 'BAD_REQUEST'
  )
})

test('uploadMedia validates participation, uploads to Supabase, and stores pending metadata', async () => {
  const repository = buildRepository()
  const storage = createStorage()
  const service = createMediaService({
    repository,
    storage,
    encryption: createEncryption(),
    logger: createLogger()
  })

  const media = await service.uploadMedia({
    eventId: EVENT_ID,
    teamId: TEAM_ID,
    title: 'Team photo',
    tags: 'team,photo'
  }, {
    originalFileName: '../team photo.jpg',
    mimeType: 'image/jpeg',
    size: 120,
    buffer: Buffer.from('image')
  }, {
    id: USER_ID,
    permissions: [PERMISSIONS.EVENT_VIEW]
  })

  assert.equal(media.status, 'PENDING')
  assert.equal(media.mediaType, 'IMAGE')
  assert.equal(media.bucketName, 'event-media')
  assert.match(media.storagePath, /^events\/664c3f6a3a6d4a5f3f93c101\/users\/664c3f6a3a6d4a5f3f93c102\/\d+-team-photo\.jpg$/)
  assert.equal(storage.uploaded[0].serviceRoleKey, 'service-role-secret')
  assert.equal(repository.activities[0].action, 'UPLOAD')
  assert.equal(repository.auditLogs[0].action, 'MEDIA_UPLOADED')
})

test('participant can delete only own pending media while moderator can delete any media', async () => {
  const pendingMedia = {
    _id: MEDIA_ID,
    eventId: EVENT_ID,
    uploadedBy: USER_ID,
    bucketName: 'event-media',
    storagePath: 'events/event/users/user/file.jpg',
    status: 'APPROVED'
  }
  const repository = buildRepository()
  repository.mediaRecords.set(MEDIA_ID, pendingMedia)
  const storage = createStorage()
  const service = createMediaService({
    repository,
    storage,
    encryption: createEncryption(),
    logger: createLogger()
  })

  await assert.rejects(
    service.deleteMedia(MEDIA_ID, { id: USER_ID, permissions: [PERMISSIONS.EVENT_VIEW] }),
    error => error instanceof ApiError && error.code === 'FORBIDDEN'
  )

  await service.deleteMedia(MEDIA_ID, { id: 'moderator-1', permissions: [PERMISSIONS.EVENT_UPDATE] })

  assert.equal(storage.deleted.length, 1)
  assert.equal(repository.mediaRecords.has(MEDIA_ID), false)
})
