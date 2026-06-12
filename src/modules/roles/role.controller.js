import { StatusCodes } from 'http-status-codes'

import { ROLE_SERVICE } from './role.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listRoles = async (req, res, next) => {
  try {
    const { roles, pagination } = await ROLE_SERVICE.listRoles(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get roles successfully',
      data: roles,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getRoleById = async (req, res, next) => {
  try {
    const role = await ROLE_SERVICE.getRoleById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get role successfully',
      data: role
    }))
  } catch (error) {
    next(error)
  }
}

const createRole = async (req, res, next) => {
  try {
    const role = await ROLE_SERVICE.createRole(req.body, req.user?.id)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create role successfully',
      data: role
    }))
  } catch (error) {
    next(error)
  }
}

const updateRole = async (req, res, next) => {
  try {
    const role = await ROLE_SERVICE.updateRole(req.params.id, req.body, req.user?.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update role successfully',
      data: role
    }))
  } catch (error) {
    next(error)
  }
}

const deleteRole = async (req, res, next) => {
  try {
    const result = await ROLE_SERVICE.deleteRole(req.params.id, req.user?.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete role successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const getRolePermissions = async (req, res, next) => {
  try {
    const result = await ROLE_SERVICE.getRolePermissions(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get role permissions successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const setRolePermissions = async (req, res, next) => {
  try {
    const result = await ROLE_SERVICE.setRolePermissions(req.params.id, req.body.permissions, req.user?.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Set role permissions successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const addPermissionsToRole = async (req, res, next) => {
  try {
    const result = await ROLE_SERVICE.addPermissionsToRole(req.params.id, req.body.permissions, req.user?.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Add permissions to role successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const removePermissionFromRole = async (req, res, next) => {
  try {
    const result = await ROLE_SERVICE.removePermissionFromRole(req.params.id, req.params.permissionId, req.user?.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Remove permission from role successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const ROLE_CONTROLLER = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
  addPermissionsToRole,
  removePermissionFromRole
}
