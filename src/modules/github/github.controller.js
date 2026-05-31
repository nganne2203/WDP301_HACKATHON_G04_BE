import { StatusCodes } from 'http-status-codes'

import { GITHUB_SERVICE } from './github.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const getConfig = async (req, res, next) => {
  try {
    const config = await GITHUB_SERVICE.getConfig(req.validated.query.eventId)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get GitHub configuration successfully',
      data: config
    }))
  } catch (error) {
    next(error)
  }
}

const saveConfig = async (req, res, next) => {
  try {
    const config = await GITHUB_SERVICE.saveConfig(req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Save GitHub configuration successfully',
      data: config
    }))
  } catch (error) {
    next(error)
  }
}

const testConnection = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.testConnection(req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Test GitHub connection successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const createRepository = async (req, res, next) => {
  try {
    const repository = await GITHUB_SERVICE.createRepository(req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create GitHub repository successfully',
      data: repository
    }))
  } catch (error) {
    next(error)
  }
}

const assignCollaborator = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.assignCollaborator({
      repoName: req.params.repoName,
      username: req.params.username,
      eventId: req.body.eventId,
      permission: req.body.permission
    }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Assign GitHub collaborator successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const inviteOrganizationMember = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.inviteOrganizationMember(req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Invite GitHub organization member successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const revokeMembers = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.revokeMembers(req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Revoke GitHub organization members successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const GITHUB_CONTROLLER = {
  getConfig,
  saveConfig,
  testConnection,
  createRepository,
  assignCollaborator,
  inviteOrganizationMember,
  revokeMembers
}
