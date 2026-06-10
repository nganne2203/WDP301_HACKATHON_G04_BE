import { StatusCodes } from 'http-status-codes'

import { TEAM_SERVICE } from './team.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listTeams = async (req, res, next) => {
  try {
    const { teams, pagination } = await TEAM_SERVICE.listTeams(req.validated?.query || req.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get teams successfully',
      data: teams,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const createTeam = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.createTeam(req.body, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create team successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

const getTeamById = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.getTeamById(req.params.id, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get team successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

const getMyTeam = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.getMyTeamByEvent(req.validated.query.eventId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get my team successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

const inviteMembers = async (req, res, next) => {
  try {
    const result = await TEAM_SERVICE.inviteMembers(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Invite team members successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const acceptInvitation = async (req, res, next) => {
  try {
    const result = await TEAM_SERVICE.acceptInvitation(req.params.token)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Accept invitation successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const declineInvitation = async (req, res, next) => {
  try {
    const result = await TEAM_SERVICE.declineInvitation(req.params.token)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Decline invitation successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const replaceInvitation = async (req, res, next) => {
  try {
    const invitation = await TEAM_SERVICE.replaceInvitation({
      teamId: req.params.teamId,
      invitationId: req.params.invitationId,
      email: req.body.email
    }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Replace invitation successfully',
      data: invitation
    }))
  } catch (error) {
    next(error)
  }
}

const cancelInvitation = async (req, res, next) => {
  try {
    const invitation = await TEAM_SERVICE.cancelInvitation({
      teamId: req.params.teamId,
      invitationId: req.params.invitationId
    }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Cancel invitation successfully',
      data: invitation
    }))
  } catch (error) {
    next(error)
  }
}

const updateTeam = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.updateTeam(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update team successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

const kickMember = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.kickMember({
      teamId: req.params.id,
      participantId: req.params.participantId
    }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Member removed from team successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

const assignTrack = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.assignTrack({
      teamId: req.params.id,
      trackId: req.body.trackId
    }, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Track assigned successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

export const TEAM_CONTROLLER = {
  listTeams,
  createTeam,
  getTeamById,
  getMyTeam,
  updateTeam,
  kickMember,
  assignTrack,
  inviteMembers,
  acceptInvitation,
  declineInvitation,
  replaceInvitation,
  cancelInvitation
}
