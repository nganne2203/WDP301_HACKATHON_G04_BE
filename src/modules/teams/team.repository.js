import mongoose from 'mongoose'

import Competition from '#models/competition.model.js'
import Participant from '#models/participant.model.js'
import Role from '#models/role.model.js'
import Team from '#models/team.model.js'
import TeamInvitation from '#models/teamInvitation.model.js'
import Track from '#models/track.model.js'
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

const ACTIVE_TEAM_STATUSES = ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED']

const teamPopulate = [
  { path: 'competitionId', select: 'title status registrationStart registrationEnd registrationClosedAt registrationCloseReason minTeamMembers maxTeamMembers maxTeams totalFinalistSlots competitionConfig' },
  { path: 'trackId', select: 'code name type maxTeams status' },
  { path: 'leaderId', select: 'email fullName githubUsername status roles', populate: populateRoles[0] },
  { path: 'memberIds', select: 'email fullName githubUsername status roles', populate: populateRoles[0] },
  { path: 'mentorIds', select: 'email fullName githubUsername status roles', populate: populateRoles[0] }
]

const withSession = (query, session) => {
  return session ? query.session(session) : query
}

const escapeRegExp = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const normalizeTeamName = (name) => {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

const createSession = async () => {
  return await mongoose.startSession()
}

const findCompetitionById = async (id, { session } = {}) => {
  return await withSession(Competition.findById(id), session)
}

const updateCompetitionById = async (id, data, { session } = {}) => {
  return await withSession(
    Competition.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    }),
    session
  )
}

const findTracksByCompetition = async (competitionId, { session } = {}) => {
  return await withSession(
    Track.find({ competitionId }).sort({ code: 1, name: 1, createdAt: 1 }),
    session
  )
}

const findTrackById = async (id, { session } = {}) => {
  return await withSession(Track.findById(id), session)
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

const findTeamByCompetitionAndName = async ({ competitionId, name }, { session } = {}) => {
  const trimmedName = String(name || '').trim()
  const normalizedName = normalizeTeamName(trimmedName)
  if (!competitionId || !normalizedName) return null

  return await withSession(
    Team.findOne({
      competitionId,
      status: { $in: ACTIVE_TEAM_STATUSES },
      $or: [
        { normalizedName },
        { name: new RegExp(`^${escapeRegExp(trimmedName)}$`, 'i') }
      ]
    }).populate(teamPopulate),
    session
  )
}

const findTeamByLeaderAndCompetition = async ({ competitionId, leaderId }, { session } = {}) => {
  return await withSession(
    Team.findOne({ competitionId, leaderId, status: { $in: ACTIVE_TEAM_STATUSES } }).populate(teamPopulate),
    session
  )
}

const findTeamForUserInCompetition = async ({ competitionId, userId }, { session } = {}) => {
  const team = await withSession(
    Team.findOne({
      competitionId,
      status: { $in: ACTIVE_TEAM_STATUSES },
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
      competitionId,
      userId,
      status: { $in: ['INVITED', 'JOINED'] }
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
    Participant.find({ teamId })
      .populate({ path: 'userId', select: 'email fullName status roles', populate: populateRoles[0] })
      .sort({ teamRole: -1, createdAt: 1 }),
    session
  )
}

const findParticipantByCompetitionAndUser = async ({ competitionId, userId }, { session } = {}) => {
  return await withSession(Participant.findOne({ competitionId, userId }), session)
}

const upsertParticipant = async ({ competitionId, userId, data }, { session } = {}) => {
  return await withSession(
    Participant.findOneAndUpdate(
      { competitionId, userId },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ),
    session
  )
}

const findUserById = async (id, { session } = {}) => {
  return await withSession(User.findById(id).populate(populateRoles), session)
}

const findUsersByIds = async (ids = [], { session } = {}) => {
  if (!Array.isArray(ids) || ids.length === 0) return []

  return await withSession(
    User.find({ _id: { $in: ids } })
      .populate(populateRoles),
    session
  )
}

const updateParticipantByCompetitionAndUser = async ({ competitionId, userId, data }, { session } = {}) => {
  return await withSession(
    Participant.findOneAndUpdate(
      { competitionId, userId },
      { $set: data },
      { new: true, runValidators: true }
    ),
    session
  )
}

const updateParticipants = async (filter, data, { session } = {}) => {
  return await withSession(Participant.updateMany(filter, data), session)
}

const findUserByEmail = async (email, { session } = {}) => {
  return await withSession(User.findOne({ email: String(email).trim().toLowerCase() }).populate(populateRoles), session)
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const findUserByGithubUsername = async (githubUsername, { session } = {}) => {
  const username = String(githubUsername || '').trim()
  if (!username) return null

  return await withSession(
    User.findOne({
      githubUsername: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') }
    }).populate(populateRoles),
    session
  )
}

const createUser = async (data, { session } = {}) => {
  if (session) {
    const [user] = await User.create([data], { session })
    return await findUserById(user._id, { session })
  }

  const user = await User.create(data)
  return await findUserById(user._id)
}

const updateUserById = async (id, data, { session } = {}) => {
  return await withSession(
    User.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    }).populate(populateRoles),
    session
  )
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

const findActiveTeamIds = async ({ competitionId } = {}, { session } = {}) => {
  const filter = { status: { $in: ACTIVE_TEAM_STATUSES } }
  if (competitionId) filter.competitionId = competitionId

  return await withSession(Team.find(filter).distinct('_id'), session)
}

const findBlockingInvitation = async ({ competitionId, email, userId, excludeInvitationId }, { session } = {}) => {
  const or = [{ invitedEmail: String(email).trim().toLowerCase() }]
  if (userId) or.push({ invitedUserId: userId })

  const activeTeamIds = await findActiveTeamIds({ competitionId }, { session })
  if (activeTeamIds.length === 0) return null

  const filter = {
    competitionId,
    teamId: { $in: activeTeamIds },
    status: { $in: ['PENDING', 'ACCEPTED'] },
    $or: or
  }

  if (excludeInvitationId) {
    filter._id = { $ne: excludeInvitationId }
  }

  return await withSession(TeamInvitation.findOne(filter), session)
}

const findActiveInvitationByGithubUsername = async ({ githubUsername, email, userId, excludeInvitationId }, { session } = {}) => {
  const username = String(githubUsername || '').trim()
  if (!username) return null

  const activeTeamIds = await findActiveTeamIds({}, { session })
  if (activeTeamIds.length === 0) return null

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const filter = {
    teamId: { $in: activeTeamIds },
    status: { $in: ['PENDING', 'ACCEPTED'] },
    'metadata.invitedGithubUsername': { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') }
  }

  const sameInviteConditions = []
  if (normalizedEmail) {
    sameInviteConditions.push({ invitedEmail: normalizedEmail })
  }
  if (userId) {
    sameInviteConditions.push({ invitedUserId: userId })
  }
  if (sameInviteConditions.length > 0) {
    filter.$nor = sameInviteConditions
  }

  if (excludeInvitationId) {
    filter._id = { $ne: excludeInvitationId }
  }

  return await withSession(
    TeamInvitation.findOne(filter).populate({ path: 'invitedUserId', select: 'email fullName status' }),
    session
  )
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

export const TEAM_REPOSITORY = {
  createSession,
  findCompetitionById,
  updateCompetitionById,
  findTracksByCompetition,
  findTrackById,
  countTeams,
  findTeams,
  findTeamById,
  findTeamByCompetitionAndName,
  findTeamByLeaderAndCompetition,
  findTeamForUserInCompetition,
  createTeam,
  updateTeamById,
  findParticipantsByTeam,
  findParticipantByCompetitionAndUser,
  upsertParticipant,
  updateParticipantByCompetitionAndUser,
  updateParticipants,
  findUserById,
  findUsersByIds,
  findUserByEmail,
  findUserByGithubUsername,
  createUser,
  updateUserById,
  findRoleByName,
  createInvitation,
  findInvitationByTokenHash,
  findInvitationById,
  findInvitationsByTeam,
  findBlockingInvitation,
  findActiveInvitationByGithubUsername,
  updateInvitationById,
  updateInvitations
}
