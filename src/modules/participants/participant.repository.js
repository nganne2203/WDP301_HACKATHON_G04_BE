import Event from '#models/event.model.js'
import CheckInQrSession from '#models/checkInQrSession.model.js'
import Participant from '#models/participant.model.js'
import Team from '#models/team.model.js'
import User from '#models/user.model.js'

const participantPopulate = [
  { path: 'eventId', select: 'title semester season year status startDate endDate maxTeamMembers minTeamMembers' },
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

const findByEventAndUser = async ({ eventId, userId }) => {
  return await Participant.findOne({ eventId, userId }).populate(participantPopulate)
}

const updateById = async (id, data) => {
  return await Participant.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(participantPopulate)
}

const upsertCheckInQrSession = async ({ eventId, tokenHash, expiresAt, createdBy }) => {
  return await CheckInQrSession.findOneAndUpdate(
    { eventId },
    { $set: { tokenHash, expiresAt, createdBy } },
    { new: true, upsert: true, runValidators: true }
  )
}

const findCheckInQrSessionByTokenHash = async (tokenHash) => {
  return await CheckInQrSession.findOne({ tokenHash }).select('+tokenHash')
}

const checkInParticipantByEventAndUser = async ({ eventId, userId, now }) => {
  return await Participant.findOneAndUpdate(
    {
      eventId,
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

const findEventById = async (id) => {
  return await Event.findById(id)
}

const findUserById = async (id) => {
  return await User.findById(id).populate({ path: 'roles', select: 'name code' })
}

const findTeamById = async (id) => {
  return await Team.findById(id)
}

const findConfirmedTeamIds = async ({ eventId } = {}) => {
  const filter = { status: 'CONFIRMED' }
  if (eventId) filter.eventId = eventId
  return await Team.find(filter).distinct('_id')
}

export const PARTICIPANT_REPOSITORY = {
  count,
  create,
  findAll,
  findById,
  findByEventAndUser,
  updateById,
  upsertCheckInQrSession,
  findCheckInQrSessionByTokenHash,
  checkInParticipantByEventAndUser,
  deleteById,
  findEventById,
  findUserById,
  findTeamById,
  findConfirmedTeamIds
}
