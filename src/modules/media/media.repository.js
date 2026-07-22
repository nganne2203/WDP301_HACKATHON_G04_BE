import AuditLog from '#models/auditLog.model.js'
import Competition from '#models/competition.model.js'
import Media from '#models/media.model.js'
import MediaActivity from '#models/mediaActivity.model.js'
import Participant from '#models/participant.model.js'
import SystemConfiguration from '#models/systemConfiguration.model.js'
import Team from '#models/team.model.js'
import User from '#models/user.model.js'

const mediaPopulate = [
  { path: 'competitionId', select: 'title status startDate endDate' },
  { path: 'uploadedBy', select: 'email fullName' },
  { path: 'teamId', select: 'name status' },
  { path: 'reviewedBy', select: 'email fullName' }
]

const findCompetitionById = async (id) => {
  return await Competition.findById(id)
}

const findParticipantByCompetitionAndUser = async ({ competitionId, userId }) => {
  return await Participant.findOne({ competitionId, userId })
}

const findTeamById = async (id) => {
  return await Team.findById(id)
}

const findUserById = async (id) => {
  return await User.findById(id).select('email fullName')
}

const findUsersByIds = async (ids = []) => {
  return await User.find({ _id: { $in: ids } }).select('email fullName')
}

const findMediaSummariesByIds = async (ids = []) => {
  return await Media.find({ _id: { $in: ids } }).select('title originalFileName mediaType')
}

const findConfigsByKeys = async (keys = []) => {
  return await SystemConfiguration.find({ key: { $in: keys } })
}

const upsertConfig = async ({ key, value, isEncrypted, updatedBy }) => {
  return await SystemConfiguration.findOneAndUpdate(
    { key },
    {
      $set: {
        value,
        isEncrypted,
        updatedBy
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

const createMedia = async (data) => {
  return await Media.create(data)
}

const countMedia = async (filter = {}) => {
  return await Media.countDocuments(filter)
}

const findMedia = async ({ filter = {}, skip = 0, limit = 20, sort = { uploadedAt: -1, createdAt: -1 } } = {}) => {
  return await Media.find(filter)
    .populate(mediaPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findMediaById = async (id) => {
  return await Media.findById(id).populate(mediaPopulate)
}

const updateMediaById = async (id, data) => {
  return await Media.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(mediaPopulate)
}

const deleteMediaById = async (id) => {
  return await Media.findByIdAndDelete(id)
}

const createActivity = async (data) => {
  return await MediaActivity.create(data)
}

const createAuditLog = async ({ userId, action, resourceType, resourceId, metadata }) => {
  return await AuditLog.create({
    userId,
    action,
    resourceType,
    resourceId,
    metadata
  })
}

const aggregateMedia = async (pipeline = []) => {
  return await Media.aggregate(pipeline)
}

const aggregateActivity = async (pipeline = []) => {
  return await MediaActivity.aggregate(pipeline)
}

export const MEDIA_REPOSITORY = {
  findCompetitionById,
  findParticipantByCompetitionAndUser,
  findTeamById,
  findUserById,
  findUsersByIds,
  findMediaSummariesByIds,
  findConfigsByKeys,
  upsertConfig,
  createMedia,
  countMedia,
  findMedia,
  findMediaById,
  updateMediaById,
  deleteMediaById,
  createActivity,
  createAuditLog,
  aggregateMedia,
  aggregateActivity
}
