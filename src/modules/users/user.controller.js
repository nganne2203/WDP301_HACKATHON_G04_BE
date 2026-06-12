import { StatusCodes } from 'http-status-codes'

import { USER_SERVICE } from './user.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listUsers = async (req, res, next) => {
  try {
    const { users, pagination } = await USER_SERVICE.listUsers(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get users successfully',
      data: users,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getUserById = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.getUserById(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get user successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const createUser = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.createUser(req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create user successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const updateMe = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.updateProfile(req.user.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update profile successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const updateStatus = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.updateStatus(req.params.id, req.body.status)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update user status successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const approveUser = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.approveUser(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Approve user successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const rejectUser = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.rejectUser(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Reject user successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const suspendUser = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.suspendUser(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Suspend user successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const assignRoles = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.assignRoles(req.params.id, req.body.roles)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Assign user roles successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const assignRolesByIds = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.assignRolesByIds(req.params.id, req.body.roleIds, req.user?.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Assign user roles by IDs successfully',
      data: user
    }))
  } catch (error) {
    next(error)
  }
}

const getEffectivePermissions = async (req, res, next) => {
  try {
    const result = await USER_SERVICE.getEffectivePermissions(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get user effective permissions successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const USER_CONTROLLER = {
  listUsers,
  getUserById,
  createUser,
  updateMe,
  updateStatus,
  approveUser,
  rejectUser,
  suspendUser,
  assignRoles,
  assignRolesByIds,
  getEffectivePermissions
}
