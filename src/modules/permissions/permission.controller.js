import { StatusCodes } from 'http-status-codes'

import { PERMISSION_SERVICE } from './permission.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listPermissions = async (req, res, next) => {
  try {
    const { permissions, pagination } = await PERMISSION_SERVICE.listPermissions(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get permissions successfully',
      data: permissions,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getGroupedPermissions = async (req, res, next) => {
  try {
    const groups = await PERMISSION_SERVICE.getGroupedPermissions()

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get grouped permissions successfully',
      data: groups
    }))
  } catch (error) {
    next(error)
  }
}

const getPermissionById = async (req, res, next) => {
  try {
    const permission = await PERMISSION_SERVICE.getPermissionById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get permission successfully',
      data: permission
    }))
  } catch (error) {
    next(error)
  }
}

const updatePermission = async (req, res, next) => {
  try {
    const permission = await PERMISSION_SERVICE.updatePermission(req.params.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update permission successfully',
      data: permission
    }))
  } catch (error) {
    next(error)
  }
}

export const PERMISSION_CONTROLLER = {
  listPermissions,
  getGroupedPermissions,
  getPermissionById,
  updatePermission
}
