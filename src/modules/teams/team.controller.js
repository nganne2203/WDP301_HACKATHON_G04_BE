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

const checkTeamAvailability = async (req, res, next) => {
  try {
    const availability = await TEAM_SERVICE.checkTeamAvailability(req.validated.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Check team availability successfully',
      data: availability
    }))
  } catch (error) {
    next(error)
  }
}

const checkInviteEligibility = async (req, res, next) => {
  try {
    const eligibility = await TEAM_SERVICE.checkInviteEligibility(req.validated.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Check invitation eligibility successfully',
      data: eligibility
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

const updateTeamStatus = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.updateTeamStatus(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update team status successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

const updateTeamPlacement = async (req, res, next) => {
  try {
    const team = await TEAM_SERVICE.updateTeamPlacement(req.params.id, req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update team placement successfully',
      data: team
    }))
  } catch (error) {
    next(error)
  }
}

const updateTeamMentors = async (req, res, next) => {
  try {
    const result = await TEAM_SERVICE.updateTeamMentors(req.params.id, req.body, req.user)

    req.audit = {
      ...(req.audit || {}),
      entityType: 'Team',
      entityId: result.team?.id,
      oldValue: { mentorIds: result.audit.previousMentorIds },
      newValue: {
        mentorIds: result.audit.nextMentorIds,
        addedMentorIds: result.audit.addedMentorIds,
        removedMentorIds: result.audit.removedMentorIds
      },
      metadata: {
        previousMentorIds: result.audit.previousMentorIds,
        nextMentorIds: result.audit.nextMentorIds,
        addedMentorIds: result.audit.addedMentorIds,
        removedMentorIds: result.audit.removedMentorIds
      },
      description: `Updated mentor assignments for team ${result.team?.name || req.params.id}`,
      sourceModule: 'teams'
    }

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update team mentors successfully',
      data: result.team
    }))
  } catch (error) {
    next(error)
  }
}

const assignMentorsByBoard = async (req, res, next) => {
  try {
    const result = await TEAM_SERVICE.assignMentorsByBoard(req.body, req.user)

    req.audit = {
      ...(req.audit || {}),
      entityType: 'Team',
      oldValue: null,
      newValue: {
        eventId: result.eventId,
        boardNumber: result.boardNumber,
        mentorIds: result.mentorIds,
        updatedCount: result.updatedCount,
        teamIds: result.teamIds
      },
      metadata: {
        eventId: result.eventId,
        boardNumber: result.boardNumber,
        mentorIds: result.mentorIds,
        updatedCount: result.updatedCount,
        teamIds: result.teamIds,
        teamDiffs: result.audit.teamDiffs
      },
      description: `Assigned mentors to all teams in board ${result.boardNumber}`,
      sourceModule: 'teams'
    }

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Assign mentors by board successfully',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

const getEventTeamCapacity = async (req, res, next) => {
  try {
    const capacity = await TEAM_SERVICE.getEventTeamCapacity(req.params.eventId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get team capacity successfully',
      data: capacity
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
  checkTeamAvailability,
  checkInviteEligibility,
  inviteMembers,
  acceptInvitation,
  declineInvitation,
  replaceInvitation,
  cancelInvitation,
  updateTeamStatus,
  updateTeamPlacement,
  updateTeamMentors,
  assignMentorsByBoard,
  getEventTeamCapacity
}
