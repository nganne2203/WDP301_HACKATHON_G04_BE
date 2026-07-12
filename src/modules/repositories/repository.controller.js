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

const listConfirmedTeamsMissingRepositories = async (req, res, next) => {
  try {
    const result = await REPOSITORY_SERVICE.listConfirmedTeamsMissingRepositories(req.validated?.query || req.query)
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get confirmed teams missing repositories successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const createRepository = async (req, res, next) => {
  try {
    const repository = await REPOSITORY_SERVICE.createRepository(req.body, req.user)
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

const listStaticAnalysis = async (req, res, next) => {
  try {
    const { analysisResults, pagination } = await REPOSITORY_SERVICE.listStaticAnalysis({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository static analysis successfully',
      data: analysisResults,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const listCommitDiffs = async (req, res, next) => {
  try {
    const { commitDiffs, pagination } = await REPOSITORY_SERVICE.listCommitDiffs({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository commit diffs successfully',
      data: commitDiffs,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const listImpactDecisions = async (req, res, next) => {
  try {
    const { impactDecisions, pagination } = await REPOSITORY_SERVICE.listImpactDecisions({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository impact decisions successfully',
      data: impactDecisions,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const syncRepositoryCommits = async (req, res, next) => {
  try {
    const result = await REPOSITORY_SERVICE.syncRepositoryCommits({
      repositoryId: req.params.id,
      requestedBy: req.user?.id || null
    })

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Sync repository commits successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

export const REPOSITORY_CONTROLLER = {
  listRepositories,
  listConfirmedTeamsMissingRepositories,
  getRepositoryById,
  createRepository,
  updateRepository,
  listRepositoryCommits,
  listStaticAnalysis,
  listCommitDiffs,
  listImpactDecisions,
  syncRepositoryCommits
}
