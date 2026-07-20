import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const githubUsername = Joi.string().trim().min(1).max(39).pattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)

const idParam = Joi.object({
  id: objectId.required()
})

const listUsers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'),
    search: Joi.string().trim().max(100),
    roles: Joi.alternatives().try(
      Joi.array().items(Joi.string().trim().uppercase().valid('ADMIN', 'COMPETITION_COORDINATOR', 'COORDINATOR', 'JUDGE', 'MENTOR', 'SPEAKER', 'PARTICIPANT')).min(1).unique(),
      Joi.string().trim().min(1)
    )
  })
}

const getUserById = {
  params: idParam
}

const updateProfile = {
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(120),
    avatarUrl: Joi.string().uri().allow('', null),
    phone: Joi.string().trim().max(30).allow('', null),
    bio: Joi.string().trim().max(500).allow('', null),
    githubUsername: githubUsername.allow('', null)
  }).min(1)
}

const createUser = {
  body: Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().min(8).max(128).required(),
    fullName: Joi.string().trim().min(2).max(120).required(),
    roles: Joi.array()
      .items(Joi.string().trim().uppercase().valid('ADMIN', 'COMPETITION_COORDINATOR', 'COORDINATOR', 'JUDGE', 'MENTOR', 'SPEAKER', 'PARTICIPANT'))
      .min(1)
      .unique()
      .required(),
    status: Joi.string().valid('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED').default('ACTIVE'),
    avatarUrl: Joi.string().uri().allow('', null),
    phone: Joi.string().trim().max(30).allow('', null),
    bio: Joi.string().trim().max(500).allow('', null),
    githubUsername: githubUsername.allow('', null),
    studentType: Joi.when('roles', {
      is: Joi.array().has(Joi.string().valid('PARTICIPANT')),
      then: Joi.string().trim().uppercase().valid('FPT', 'EXTERNAL').required(),
      otherwise: Joi.string().trim().uppercase().valid('FPT', 'EXTERNAL')
    }),
    studentId: Joi.when('roles', {
      is: Joi.array().has(Joi.string().valid('PARTICIPANT')),
      then: Joi.string().trim().min(2).max(50).required(),
      otherwise: Joi.string().trim().min(2).max(50)
    }),
    schoolName: Joi.when('studentType', {
      is: 'EXTERNAL',
      then: Joi.string().trim().min(2).max(200).required(),
      otherwise: Joi.string().trim().max(200).allow('', null)
    })
  })
}

const updateUser = {
  params: idParam,
  body: Joi.object({
    email: Joi.string().email().trim().lowercase(),
    fullName: Joi.string().trim().min(2).max(120),
    roles: Joi.array()
      .items(Joi.string().trim().uppercase().valid('ADMIN', 'COMPETITION_COORDINATOR', 'COORDINATOR', 'JUDGE', 'MENTOR', 'SPEAKER', 'PARTICIPANT'))
      .min(1)
      .unique(),
    avatarUrl: Joi.string().uri().allow('', null),
    phone: Joi.string().trim().max(30).allow('', null),
    bio: Joi.string().trim().max(500).allow('', null),
    githubUsername: githubUsername.allow('', null),
    studentType: Joi.string().trim().uppercase().valid('FPT', 'EXTERNAL').allow(null),
    studentId: Joi.string().trim().min(2).max(50).allow('', null),
    schoolName: Joi.string().trim().max(200).allow('', null)
  }).min(1)
}

const updateStatus = {
  params: idParam,
  body: Joi.object({
    status: Joi.string().valid('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED').required()
  })
}

const assignRoles = {
  params: idParam,
  body: Joi.object({
    roles: Joi.array()
      .items(Joi.string().trim().uppercase().valid('ADMIN', 'COMPETITION_COORDINATOR', 'COORDINATOR', 'JUDGE', 'MENTOR', 'SPEAKER', 'PARTICIPANT'))
      .min(1)
      .unique()
      .required()
  })
}

const assignRolesByIds = {
  params: idParam,
  body: Joi.object({
    roleId: Joi.string().hex().length(24),
    roleIds: Joi.array()
      .items(Joi.string().hex().length(24))
      .min(1)
      .unique()
  }).xor('roleId', 'roleIds')
}

export const USER_VALIDATION = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateProfile,
  updateStatus,
  assignRoles,
  assignRolesByIds
}
