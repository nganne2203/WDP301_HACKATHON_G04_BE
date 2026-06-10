import mongoose from 'mongoose'

import Event from '#models/event.model.js'
import Participant from '#models/participant.model.js'
import Role from '#models/role.model.js'
import Track from '#models/track.model.js'
import Team from '#models/team.model.js'
import TeamInvitation from '#models/teamInvitation.model.js'
import User from '#models/user.model.js'
import '#models/permission.model.js'

const populateRoles = [
  {
    path: 'roles',
    select: 'name description permissions',
    populate: {
      path: 'permissions',
      select: 'code description'
    }
  }
]

const teamPopulate = [
  { path: 'eventId', select: 'title status registrationStart registrationEnd minTeamMembers maxTeamMembers maxTeams totalFinalistSlots' },
  { path: 'trackId', select: 'code name type' },
  { path: 'leaderId', select: 'email fullName status roles', populate: populateRoles[0] },
  { path: 'memberIds', select: 'email fullName status roles', populate: populateRoles[0] }
]

const withSession = (query, session) => {
  return session ? query.session(session) : query
}

const createSession = async () => {
  return await mongoose.startSession()
}

const findEventById = async (id, { session } = {}) => {
  return await withSession(Event.findById(id), session)
}

const countTeams = async (filter = {}, { session } = {}) => {
  return await withSession(Team.countDocuments(filter), session)
}

const findTeams = async ({ filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 }, session } = {}) => {
  return await withSession(
    Team.find(filter)
      .populate(teamPopulate)
      .sort(sort)
      .skip(skip)
      .limit(limit),
    session
  )
}

const findTeamById = async (id, { session } = {}) => {
  return await withSession(Team.findById(id).populate(teamPopulate), session)
}

const findTeamByLeaderAndEvent = async ({ eventId, leaderId }, { session } = {}) => {
  return await withSession(Team.findOne({ eventId, leaderId }).populate(teamPopulate), session)
}

const findTeamForUserInEvent = async ({ eventId, userId }, { session } = {}) => {
  const team = await withSession(
    Team.findOne({
      eventId,
      $or: [
        { leaderId: userId },
        { memberIds: userId }
      ]
    }).populate(teamPopulate),
    session
  )

  if (team) return team

  const participant = await withSession(
    Participant.findOne({
      eventId,
      userId,
      status: { $in: ['INVITED', 'REGISTERED', 'ACTIVE'] }
    }),
    session
  )

  if (!participant?.teamId) return null
  return await findTeamById(participant.teamId, { session })
}

const createTeam = async (data, { session } = {}) => {
  if (session) {
    const [team] = await Team.create([data], { session })
    return team
  }

  return await Team.create(data)
}

const updateTeamById = async (id, data, { session } = {}) => {
  return await withSession(
    Team.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    }).populate(teamPopulate),
    session
  )
}

const findParticipantsByTeam = async (teamId, { session } = {}) => {
  return await withSession(
    Participant.find({ teamId, status: { $in: ['REGISTERED', 'ACTIVE'] } })
      .populate({ path: 'userId', select: 'email fullName status roles', populate: populateRoles[0] })
      .sort({ teamRole: -1, createdAt: 1 }),
    session
  )
}

const findParticipantByEventAndUser = async ({ eventId, userId }, { session } = {}) => {
  return await withSession(Participant.findOne({ eventId, userId }), session)
}

const upsertParticipant = async ({ eventId, userId, data }, { session } = {}) => {
  return await withSession(
    Participant.findOneAndUpdate(
      { eventId, userId },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ),
    session
  )
}

const findUserById = async (id, { session } = {}) => {
  return await withSession(User.findById(id).populate(populateRoles), session)
}

const findUserByEmail = async (email, { session } = {}) => {
  return await withSession(User.findOne({ email: String(email).trim().toLowerCase() }).populate(populateRoles), session)
}

const createUser = async (data, { session } = {}) => {
  if (session) {
    const [user] = await User.create([data], { session })
    return await findUserById(user._id, { session })
  }

  const user = await User.create(data)
  return await findUserById(user._id)
}

const findRoleByName = async (name, { session } = {}) => {
  return await withSession(Role.findOne({ name: String(name).toUpperCase() }), session)
}

const createInvitation = async (data, { session } = {}) => {
  if (session) {
    const [invitation] = await TeamInvitation.create([data], { session })
    return invitation
  }

  return await TeamInvitation.create(data)
}

const findInvitationByTokenHash = async (tokenHash, { session } = {}) => {
  return await withSession(TeamInvitation.findOne({ tokenHash }), session)
}

const findInvitationById = async (id, { session } = {}) => {
  return await withSession(TeamInvitation.findById(id), session)
}

const findInvitationsByTeam = async (teamId, { session } = {}) => {
  return await withSession(
    TeamInvitation.find({ teamId })
      .populate({ path: 'invitedUserId', select: 'email fullName status' })
      .sort({ createdAt: 1 }),
    session
  )
}

const findBlockingInvitation = async ({ eventId, email, userId, excludeInvitationId }, { session } = {}) => {
  const or = [{ invitedEmail: String(email).trim().toLowerCase() }]
  if (userId) or.push({ invitedUserId: userId })

  const filter = {
    eventId,
    status: { $in: ['PENDING', 'ACCEPTED'] },
    $or: or
  }

  if (excludeInvitationId) {
    filter._id = { $ne: excludeInvitationId }
  }

  return await withSession(TeamInvitation.findOne(filter), session)
}

const updateInvitationById = async (id, data, { session } = {}) => {
  return await withSession(
    TeamInvitation.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    }),
    session
  )
}

const updateInvitations = async (filter, data, { session } = {}) => {
  return await withSession(TeamInvitation.updateMany(filter, data), session)
}

const findParticipantById = async (id, { session } = {}) => {
  return await withSession(
    Participant.findById(id).populate({ path: 'userId', select: 'email fullName status' }),
    session
  )
}

const removeParticipantFromTeam = async (participantId, { session } = {}) => {
  return await withSession(
    Participant.findByIdAndUpdate(
      participantId,
      { $unset: { teamId: 1 }, $set: { teamRole: 'MEMBER' } },
      { new: true }
    ),
    session
  )
}

const findTrackById = async (id, { session } = {}) => {
  return await withSession(Track.findById(id), session)
}

export const TEAM_REPOSITORY = {
  createSession,
  findEventById,
  countTeams,
  findTeams,
  findTeamById,
  findTeamByLeaderAndEvent,
  findTeamForUserInEvent,
  createTeam,
  updateTeamById,
  findParticipantsByTeam,
  findParticipantByEventAndUser,
  findParticipantById,
  removeParticipantFromTeam,
  findTrackById,
  upsertParticipant,
  findUserById,
  findUserByEmail,
  createUser,
  findRoleByName,
  createInvitation,
  findInvitationByTokenHash,
  findInvitationById,
  findInvitationsByTeam,
  findBlockingInvitation,
  updateInvitationById,
  updateInvitations
}
