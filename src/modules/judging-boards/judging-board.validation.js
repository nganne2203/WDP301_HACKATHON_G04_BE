import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const boardStatus = Joi.string().trim().uppercase().valid('DRAFT', 'ASSIGNED', 'SCORING', 'COMPLETED')

const idParam = Joi.object({
  id: objectId.required()
})

const listBoards = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    competitionId: objectId,
    roundId: objectId,
    trackId: objectId,
    status: boardStatus,
    search: Joi.string().trim().max(100)
  })
}

const createBoard = {
  body: Joi.object({
    competitionId: objectId.required(),
    roundId: objectId.required(),
    trackId: objectId.allow(null),
    name: Joi.string().trim().min(2).max(200).required(),
    boardNumber: Joi.number().integer().min(1).required(),
    teamIds: Joi.array().items(objectId).unique().default([]),
    judgeIds: Joi.array().items(objectId).unique().default([]),
    maxTeams: Joi.number().integer().min(1),
    status: boardStatus.default('DRAFT')
  })
}

const updateBoard = {
  params: idParam,
  body: Joi.object({
    competitionId: objectId,
    roundId: objectId,
    trackId: objectId.allow(null),
    name: Joi.string().trim().min(2).max(200),
    boardNumber: Joi.number().integer().min(1),
    teamIds: Joi.array().items(objectId).unique(),
    judgeIds: Joi.array().items(objectId).unique(),
    maxTeams: Joi.number().integer().min(1),
    status: boardStatus
  }).min(1)
}

const autoAssignBoards = {
  body: Joi.object({
    competitionId: objectId.required(),
    roundId: objectId.required()
  })
}

const boardPlanItem = Joi.object({
  boardNumber: Joi.number().integer().min(1).required(),
  name: Joi.string().trim().min(2).max(200).required(),
  teamIds: Joi.array().items(objectId).unique().required()
})

const randomizePreview = {
  body: Joi.object({
    competitionId: objectId.required(),
    roundId: objectId.required()
  })
}

const confirmRandomization = {
  body: Joi.object({
    competitionId: objectId.required(),
    roundId: objectId.required(),
    boards: Joi.array().items(boardPlanItem).min(1).required()
  })
}

const getBoardById = {
  params: idParam
}

export const JUDGING_BOARD_VALIDATION = {
  listBoards,
  createBoard,
  updateBoard,
  autoAssignBoards,
  randomizePreview,
  confirmRandomization,
  getBoardById
}
