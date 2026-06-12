import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const idParam = Joi.object({ id: objectId.required() })

const listPermissions = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    module: Joi.string().trim().uppercase(),
    isActive: Joi.boolean()
  })
}

const getPermissionById = { params: idParam }

const updatePermission = {
  params: idParam,
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120),
    description: Joi.string().trim().max(500).allow('', null),
    module: Joi.string().trim().uppercase().max(50),
    isActive: Joi.boolean()
  }).min(1)
}

export const PERMISSION_VALIDATION = {
  listPermissions,
  getPermissionById,
  updatePermission
}
