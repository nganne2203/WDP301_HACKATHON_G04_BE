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

const getUserProfile = async (req, res, next) => {
  try {
    const profile = await GITHUB_SERVICE.getUserProfile(req.params.username)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get GitHub user successfully',
      data: profile
    }))
  } catch (error) {
    next(error)
  }
}

const searchUsers = async (req, res, next) => {
  try {
    const users = await GITHUB_SERVICE.searchUsers(req.validated.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Search GitHub users successfully',
      data: users
    }))
  } catch (error) {
    next(error)
  }
}

const checkUsernameAvailability = async (req, res, next) => {
  try {
    const availability = await GITHUB_SERVICE.checkUsernameAvailability(req.validated.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Check GitHub username availability successfully',
      data: availability
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

const registerRepositoryWebhook = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.registerRepositoryWebhook({
      repoName: req.params.repoName,
      eventId: req.body.eventId
    }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Register GitHub repository webhook successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const revokeCollaborator = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.revokeCollaborator({
      repoName: req.params.repoName,
      username: req.params.username,
      eventId: req.body.eventId
    }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Revoke GitHub collaborator successfully',
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

const bulkCreateRepositories = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.bulkCreateRepositories(req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Bulk create GitHub repositories successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const bulkGrantAccess = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.bulkGrantAccess(req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Bulk grant collaborator access successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const bulkRevokeAccess = async (req, res, next) => {
  try {
    const result = await GITHUB_SERVICE.bulkRevokeAccess(req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Bulk revoke collaborator access successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const GITHUB_CONTROLLER = {
  getConfig,
  getUserProfile,
  searchUsers,
  checkUsernameAvailability,
  saveConfig,
  testConnection,
  createRepository,
  assignCollaborator,
  registerRepositoryWebhook,
  revokeCollaborator,
  inviteOrganizationMember,
  revokeMembers,
  bulkCreateRepositories,
  bulkGrantAccess,
  bulkRevokeAccess
}

