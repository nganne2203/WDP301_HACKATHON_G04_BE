import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const mediaType = Joi.string().trim().uppercase().valid('IMAGE', 'VIDEO', 'DOCUMENT')
const mediaStatus = Joi.string().trim().uppercase().valid('PENDING', 'APPROVED', 'REJECTED')
const dateFilter = {
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  week: Joi.number().integer().min(1).max(53),
  month: Joi.number().integer().min(1).max(12),
  year: Joi.number().integer().min(2000).max(2100)
}

const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
}

const tags = Joi.alternatives().try(
  Joi.array().items(Joi.string().trim().max(50)).max(20),
  Joi.string().trim().max(500)
)

const mediaIdParam = Joi.object({
  mediaId: objectId.required()
})

const uploadMedia = {
  body: Joi.object({
    eventId: objectId.required(),
    teamId: objectId.allow('', null),
    title: Joi.string().trim().max(200).allow('', null),
    description: Joi.string().trim().max(2000).allow('', null),
    tags
  })
}

const listMyHistory = {
  query: Joi.object({
    ...pagination,
    eventId: objectId,
    mediaType,
    status: mediaStatus,
    ...dateFilter
  })
}

const listAdminMedia = {
  query: Joi.object({
    ...pagination,
    eventId: objectId,
    uploadedBy: objectId,
    teamId: objectId,
    mediaType,
    status: mediaStatus,
    ...dateFilter
  })
}

const eventGallery = {
  params: Joi.object({
    id: objectId.required()
  }),
  query: Joi.object({
    mediaType,
    search: Joi.string().trim().max(100),
    tags
  })
}

const viewUrl = {
  params: mediaIdParam
}

const deleteMedia = {
  params: mediaIdParam
}

const approveMedia = {
  params: mediaIdParam
}

const rejectMedia = {
  params: mediaIdParam,
  body: Joi.object({
    reason: Joi.string().trim().min(1).max(1000).required()
  })
}

const statistics = {
  query: Joi.object({
    eventId: objectId,
    fromDate: Joi.date().iso(),
    toDate: Joi.date().iso()
  })
}

const config = {
  body: Joi.object({
    supabaseUrl: Joi.string().trim().uri().required(),
    serviceRoleKey: Joi.string().trim().allow('', null),
    bucket: Joi.string().trim().min(1).max(120).default('event-media'),
    visibility: Joi.string().trim().valid('private').default('private'),
    maxImageSizeMb: Joi.number().integer().min(1).max(100).default(10),
    maxVideoSizeMb: Joi.number().integer().min(1).max(500).default(200),
    maxDocumentSizeMb: Joi.number().integer().min(1).max(100).default(50),
    allowedImageTypes: Joi.array().items(Joi.string().trim().lowercase()).min(1).default(['jpg', 'jpeg', 'png', 'webp']),
    allowedVideoTypes: Joi.array().items(Joi.string().trim().lowercase()).min(1).default(['mp4', 'mov', 'webm']),
    allowedDocumentTypes: Joi.array().items(Joi.string().trim().lowercase()).min(1).default(['pdf', 'doc', 'docx', 'ppt', 'pptx'])
  })
}

export const MEDIA_VALIDATION = {
  uploadMedia,
  listMyHistory,
  listAdminMedia,
  eventGallery,
  viewUrl,
  deleteMedia,
  approveMedia,
  rejectMedia,
  statistics,
  config
}
