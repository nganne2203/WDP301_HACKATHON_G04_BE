import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const idParam = Joi.object({ id: objectId.required() })

const listRoles = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    isActive: Joi.boolean(),
    isSystemRole: Joi.boolean()
  })
}

const getRoleById = { params: idParam }

const createRole = {
  body: Joi.object({
    name: Joi.string().trim().uppercase().min(2).max(60).required(),
    code: Joi.string().trim().uppercase().min(2).max(60),
    description: Joi.string().trim().max(500).allow('', null),
    permissions: Joi.array().items(objectId).unique().default([])
  })
}

const updateRole = {
  params: idParam,
  body: Joi.object({
    name: Joi.string().trim().uppercase().min(2).max(60),
    code: Joi.string().trim().uppercase().min(2).max(60),
    description: Joi.string().trim().max(500).allow('', null),
    isActive: Joi.boolean()
  }).min(1)
}

const deleteRole = { params: idParam }

const permissionIdParam = Joi.object({
  id: objectId.required(),
  permissionId: objectId.required()
})

const setPermissions = {
  params: idParam,
  body: Joi.object({
    permissions: Joi.array().items(objectId).unique().required()
  })
}

const addPermissions = {
  params: idParam,
  body: Joi.object({
    permissions: Joi.array().items(objectId).unique().min(1).required()
  })
}

const removePermission = { params: permissionIdParam }

export const ROLE_VALIDATION = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  setPermissions,
  addPermissions,
  removePermission
}
