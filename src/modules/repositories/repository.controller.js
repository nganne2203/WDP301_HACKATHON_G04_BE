import { StatusCodes } from 'http-status-codes'

import { REPOSITORY_SERVICE } from './repository.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listRepositories = async (req, res, next) => {
  try {
    const { repositories, pagination } = await REPOSITORY_SERVICE.listRepositories(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repositories successfully',
      data: repositories,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getRepositoryById = async (req, res, next) => {
  try {
    const repository = await REPOSITORY_SERVICE.getRepositoryById(req.params.id)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository successfully',
      data: repository
    }))
  } catch (error) {
    next(error)
  }
}

const createRepository = async (req, res, next) => {
  try {
    const repository = await REPOSITORY_SERVICE.createRepository(req.body)
    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create repository successfully',
      data: repository
    }))
  } catch (error) {
    next(error)
  }
}

const updateRepository = async (req, res, next) => {
  try {
    const repository = await REPOSITORY_SERVICE.updateRepository(req.params.id, req.body)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update repository successfully',
      data: repository
    }))
  } catch (error) {
    next(error)
  }
}

const listRepositoryCommits = async (req, res, next) => {
  try {
    const { repository, commits, pagination } = await REPOSITORY_SERVICE.listRepositoryCommits({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository commits successfully',
      data: {
        repository,
        commits
      },
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

export const REPOSITORY_CONTROLLER = {
  listRepositories,
  getRepositoryById,
  createRepository,
  updateRepository,
  listRepositoryCommits
}
