import Competition from '#models/competition.model.js'
import CheckInQrSession from '#models/checkInQrSession.model.js'
import Participant from '#models/participant.model.js'
import Team from '#models/team.model.js'
import User from '#models/user.model.js'

const participantPopulate = [
  { path: 'competitionId', select: 'title semester season year status startDate endDate maxTeamMembers minTeamMembers' },
  { path: 'userId', select: 'email fullName status studentId studentType schoolName' },
  { path: 'teamId', select: 'name chapterName projectName status trackId qualificationStatus' }
]

const count = async (filter = {}) => {
  return await Participant.countDocuments(filter)
}

const create = async (data) => {
  return await Participant.create(data)
}

const findAll = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await Participant.find(filter)
    .populate(participantPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findById = async (id) => {
  return await Participant.findById(id).populate(participantPopulate)
}

const findByCompetitionAndUser = async ({ competitionId, userId }) => {
  return await Participant.findOne({ competitionId, userId }).populate(participantPopulate)
}

const updateById = async (id, data) => {
  return await Participant.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(participantPopulate)
}

const upsertCheckInQrSession = async ({ competitionId, tokenHash, expiresAt, createdBy }) => {
  return await CheckInQrSession.findOneAndUpdate(
    { competitionId },
    { $set: { tokenHash, expiresAt, createdBy } },
    { new: true, upsert: true, runValidators: true }
  )
}

const findCheckInQrSessionByTokenHash = async (tokenHash) => {
  return await CheckInQrSession.findOne({ tokenHash }).select('+tokenHash')
}

const checkInParticipantByCompetitionAndUser = async ({ competitionId, userId, now }) => {
  return await Participant.findOneAndUpdate(
    {
      competitionId,
      userId,
      checkInStatus: 'NOT_CHECKED_IN'
    },
    {
      $set: {
        checkInStatus: 'CHECKED_IN',
        checkedInAt: now,
        checkedInBy: userId
      }
    },
    { new: true, runValidators: true }
  ).populate(participantPopulate)
}

const deleteById = async (id) => {
  return await Participant.findByIdAndDelete(id)
}

const findCompetitionById = async (id) => {
  return await Competition.findById(id)
}

const findUserById = async (id) => {
  return await User.findById(id).populate({ path: 'roles', select: 'name code' })
}

const findTeamById = async (id) => {
  return await Team.findById(id)
}

const findConfirmedTeamIds = async ({ competitionId } = {}) => {
  const filter = { status: 'CONFIRMED' }
  if (competitionId) filter.competitionId = competitionId
  return await Team.find(filter).distinct('_id')
}

export const PARTICIPANT_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByCompetitionAndUser,
  updateById,
  upsertCheckInQrSession,
  findCheckInQrSessionByTokenHash,
  checkInParticipantByCompetitionAndUser,
  deleteById,
  findCompetitionById,
  findUserById,
  findTeamById,
  findConfirmedTeamIds
}
