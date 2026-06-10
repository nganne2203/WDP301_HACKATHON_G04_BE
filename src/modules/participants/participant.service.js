import mongoose from 'mongoose'

import { PARTICIPANT_REPOSITORY } from './participant.repository.js'
import { EVENT_SERVICE } from '#modules/events/event.service.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'

const PARTICIPANT_FIELDS = [
  'eventId', 'userId', 'teamId', 'chapterName', 'teamRole',
  'isGraduated', 'consentMediaUse', 'eligibilityStatus',
  'attendedActivities', 'checkInStatus', 'githubAccessStatus', 'status', 'joinedAt'
]

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureParticipantExists = async (id) => {
  ensureObjectId(id)
  const participant = await PARTICIPANT_REPOSITORY.findById(id)
  if (!participant) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Participant not found'])
  }
  return participant
}

const normalizeUser = (user) => {
  if (!user) return null
  const u = typeof user.toObject === 'function' ? user.toObject({ getters: true }) : user
  return {
    id: u._id?.toString() || u.id,
    fullName: u.fullName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    studentId: u.studentId,
    studentType: u.studentType,
    schoolName: u.schoolName
  }
}

const normalizeTeam = (team) => {
  if (!team) return null
  const t = typeof team.toObject === 'function' ? team.toObject({ getters: true }) : team
  return {
    id: t._id?.toString() || t.id,
    name: t.name,
    status: t.status
  }
}

const normalizeParticipant = (participant) => {
  if (!participant) return null
  const p = typeof participant.toObject === 'function'
    ? participant.toObject({ getters: true, virtuals: false })
    : participant

  return {
    id: p._id?.toString() || p.id,
    eventId: p.eventId?.toString?.() || p.eventId,
    user: normalizeUser(p.userId),
    team: normalizeTeam(p.teamId),
    chapterName: p.chapterName,
    teamRole: p.teamRole,
    isGraduated: p.isGraduated,
    consentMediaUse: p.consentMediaUse,
    eligibilityStatus: p.eligibilityStatus,
    attendedActivities: p.attendedActivities || [],
    checkInStatus: p.checkInStatus,
    githubAccessStatus: p.githubAccessStatus,
    status: p.status,
    joinedAt: p.joinedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  }
}

const buildFilter = (query = {}) => {
  const filter = {}

  if (query.eventId) {
    ensureObjectId(query.eventId, 'event id')
    filter.eventId = query.eventId
  }

  if (query.teamId) {
    ensureObjectId(query.teamId, 'team id')
    filter.teamId = query.teamId
  }

  if (query.checkInStatus) {
    filter.checkInStatus = query.checkInStatus
  }

  if (query.status) {
    filter.status = query.status
  }

  if (query.eligibilityStatus) {
    filter.eligibilityStatus = query.eligibilityStatus
  }

  if (query.githubAccessStatus) {
    filter.githubAccessStatus = query.githubAccessStatus
  }

  return filter
}

const listParticipants = async (query = {}) => {
  const { page, limit } = normalizePaginationQuery(query)
  const filter = buildFilter(query)
  const skip = (page - 1) * limit

  const [participants, totalItems] = await Promise.all([
    PARTICIPANT_REPOSITORY.findAll({ filter, skip, limit }),
    PARTICIPANT_REPOSITORY.count(filter)
  ])

  return {
    participants: participants.map(normalizeParticipant),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
      pageSize: limit,
      totalItems
    }
  }
}

const getParticipantById = async (id) => {
  const participant = await ensureParticipantExists(id)
  return normalizeParticipant(participant)
}

const registerParticipant = async (payload = {}, requestUserId) => {
  await EVENT_SERVICE.getRawEventById(payload.eventId)

  const userId = payload.userId || requestUserId
  if (!userId) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['userId is required'])
  }

  const existing = await PARTICIPANT_REPOSITORY.findByEventAndUser(payload.eventId, userId)
  if (existing) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['User is already registered for this event'])
  }

  const data = pickSafeFields({ ...payload, userId, joinedAt: new Date() }, PARTICIPANT_FIELDS)
  const created = await PARTICIPANT_REPOSITORY.create(data)
  return normalizeParticipant(await PARTICIPANT_REPOSITORY.findById(created._id))
}

const updateParticipant = async (id, payload = {}) => {
  await ensureParticipantExists(id)
  const UPDATE_FIELDS = ['status', 'eligibilityStatus', 'teamId', 'teamRole', 'chapterName', 'isGraduated', 'consentMediaUse', 'githubAccessStatus', 'attendedActivities']
  const safePayload = pickSafeFields(payload, UPDATE_FIELDS)
  const updated = await PARTICIPANT_REPOSITORY.updateById(id, safePayload)
  return normalizeParticipant(updated)
}

const checkIn = async (id) => {
  const participant = await ensureParticipantExists(id)

  if (participant.checkInStatus === 'CHECKED_IN') {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Participant has already checked in'])
  }

  const updated = await PARTICIPANT_REPOSITORY.updateById(id, {
    checkInStatus: 'CHECKED_IN',
    status: 'ACTIVE'
  })
  return normalizeParticipant(updated)
}

export const PARTICIPANT_SERVICE = {
  listParticipants,
  getParticipantById,
  registerParticipant,
  updateParticipant,
  checkIn,
  normalizeParticipant
}
