import { StatusCodes } from 'http-status-codes'

import { REPOSITORY_ANALYSIS_SERVICE } from './repository-analysis.service.js'
import { REPOSITORY_EVIDENCE_SERVICE } from './repository-evidence.service.js'
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
    const { repository, commits, pagination } = await REPOSITORY_EVIDENCE_SERVICE.listCommits({
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

const listRepositoryCommitDiffs = async (req, res, next) => {
  try {
    const { repository, commitDiffs, pagination } = await REPOSITORY_EVIDENCE_SERVICE.listCommitDiffs({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository commit diffs successfully',
      data: {
        repository,
        commitDiffs
      },
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const syncRepositoryCommits = async (req, res, next) => {
  try {
    const result = await REPOSITORY_EVIDENCE_SERVICE.syncRepositoryCommits({
      repositoryId: req.params.id
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Repository commit sync queued successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const listRepositoryStaticAnalysis = async (req, res, next) => {
  try {
    const { repository, results, pagination } = await REPOSITORY_ANALYSIS_SERVICE.listStaticAnalysisResults({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository static analysis results successfully',
      data: {
        repository,
        results
      },
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const listRepositoryImpactDecisions = async (req, res, next) => {
  try {
    const { repository, decisions, pagination } = await REPOSITORY_ANALYSIS_SERVICE.listImpactDecisions({
      repositoryId: req.params.id,
      query: req.validated?.query || req.query
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get repository impact decisions successfully',
      data: {
        repository,
        decisions
      },
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const analyzeCommit = async (req, res, next) => {
  try {
    const result = await REPOSITORY_ANALYSIS_SERVICE.analyzeCommit({
      repositoryId: req.params.id,
      commitSha: req.body?.commitSha || null
    })
    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Repository commit analysis queued successfully',
      data: result
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
  listRepositoryCommits,
  listRepositoryCommitDiffs,
  syncRepositoryCommits,
  listRepositoryStaticAnalysis,
  listRepositoryImpactDecisions,
  analyzeCommit
}
