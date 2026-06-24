import crypto from 'node:crypto'
import mongoose from 'mongoose'
import QRCode from 'qrcode'

import { PARTICIPANT_REPOSITORY } from './participant.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { env } from '#configs/environment.js'

const PARTICIPANT_FIELDS = [
  'eventId',
  'userId',
  'teamId',
  'chapterName',
  'teamRole',
  'isGraduated',
  'consentMediaUse',
  'eligibilityStatus',
  'attendedActivities',
  'checkInStatus',
  'githubAccessStatus',
  'status',
  'joinedAt'
]

const APPROVER_PERMISSIONS = new Set(['PARTICIPANT_APPROVE'])
const CHECK_IN_QR_PREFIX = 'wdp301-checkin:'

const hashCheckInToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const normalizeCheckInToken = (value = '') => {
  const token = String(value).trim()
  return token.startsWith(CHECK_IN_QR_PREFIX) ? token.slice(CHECK_IN_QR_PREFIX.length) : token
}

const ensureObjectId = (id, fieldName = 'participant id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const buildParticipantFilter = (query = {}) => {
  const filter = {}

  if (query.eventId) {
    ensureObjectId(query.eventId, 'event id')
    filter.eventId = query.eventId
  }

  if (query.userId) {
    ensureObjectId(query.userId, 'user id')
    filter.userId = query.userId
  }

  if (query.teamId) {
    ensureObjectId(query.teamId, 'team id')
    filter.teamId = query.teamId
  }

  if (query.status) filter.status = query.status
  if (query.checkInStatus) filter.checkInStatus = query.checkInStatus
  if (query.githubAccessStatus) filter.githubAccessStatus = query.githubAccessStatus
  if (query.chapterName) filter.chapterName = query.chapterName

  if (query.search) {
    const pattern = new RegExp(query.search, 'i')
    filter.$or = [
      { chapterName: pattern }
    ]
  }

  return filter
}

const normalizeEvent = (event) => {
  if (!event) return null
  if (typeof event === 'string' || event instanceof mongoose.Types.ObjectId) return { id: event.toString() }

  return {
    id: event._id?.toString() || event.id,
    title: event.title,
    semester: event.semester,
    season: event.season,
    year: event.year,
    status: event.status
  }
}

const normalizeUser = (user) => {
  if (!user) return null
  if (typeof user === 'string' || user instanceof mongoose.Types.ObjectId) return { id: user.toString() }

  return {
    id: user._id?.toString() || user.id,
    fullName: user.fullName,
    email: user.email,
    githubUsername: user.githubUsername,
    status: user.status,
    studentId: user.studentId,
    studentType: user.studentType,
    schoolName: user.schoolName
  }
}

const normalizeTeam = (team) => {
  if (!team) return null
  if (typeof team === 'string' || team instanceof mongoose.Types.ObjectId) return { id: team.toString() }

  return {
    id: team._id?.toString() || team.id,
    name: team.name,
    chapterName: team.chapterName,
    projectName: team.projectName,
    status: team.status,
    qualificationStatus: team.qualificationStatus,
    trackId: team.trackId?._id?.toString?.() || team.trackId?.toString?.() || team.trackId
  }
}

const normalizeParticipant = (participant) => {
  if (!participant) return null

  const plainParticipant = typeof participant.toObject === 'function'
    ? participant.toObject({ getters: true, virtuals: false })
    : participant

  return {
    id: plainParticipant._id?.toString() || plainParticipant.id,
    event: normalizeEvent(plainParticipant.eventId),
    eventId: plainParticipant.eventId?._id?.toString?.() || plainParticipant.eventId?.toString?.() || plainParticipant.eventId,
    user: normalizeUser(plainParticipant.userId),
    userId: plainParticipant.userId?._id?.toString?.() || plainParticipant.userId?.toString?.() || plainParticipant.userId,
    team: normalizeTeam(plainParticipant.teamId),
    teamId: plainParticipant.teamId?._id?.toString?.() || plainParticipant.teamId?.toString?.() || plainParticipant.teamId || null,
    chapterName: plainParticipant.chapterName,
    teamRole: plainParticipant.teamRole,
    isGraduated: plainParticipant.isGraduated,
    consentMediaUse: plainParticipant.consentMediaUse,
    eligibilityStatus: plainParticipant.eligibilityStatus,
    attendedActivities: plainParticipant.attendedActivities || [],
    checkInStatus: plainParticipant.checkInStatus,
    checkedInAt: plainParticipant.checkedInAt || null,
    checkedInBy: plainParticipant.checkedInBy?.toString?.() || plainParticipant.checkedInBy || null,
    githubAccessStatus: plainParticipant.githubAccessStatus,
    status: plainParticipant.status,
    joinedAt: plainParticipant.joinedAt,
    createdAt: plainParticipant.createdAt,
    updatedAt: plainParticipant.updatedAt
  }
}

const hasApproverPermission = (actor = {}) => {
  return Array.isArray(actor.permissions) && actor.permissions.some(permission => APPROVER_PERMISSIONS.has(permission))
}

export const createParticipantService = ({
  repository = PARTICIPANT_REPOSITORY,
  qrEncoder = QRCode,
  randomToken = () => crypto.randomBytes(32).toString('base64url'),
  now = () => new Date(),
  qrExpiresMinutes = env.checkInQr.expiresMinutes
} = {}) => {
  const ensureParticipantExists = async (id) => {
    ensureObjectId(id)
    const participant = await repository.findById(id)
    if (!participant) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Participant not found'])
    return participant
  }

  const ensureEventExists = async (eventId) => {
    ensureObjectId(eventId, 'event id')
    const event = await repository.findEventById(eventId)
    if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    return event
  }

  const ensureUserExists = async (userId) => {
    ensureObjectId(userId, 'user id')
    const user = await repository.findUserById(userId)
    if (!user) throw new ApiError(ERROR_CODES.NOT_FOUND, ['User not found'])
    return user
  }

  const ensureTeamBelongsToEvent = async ({ teamId, eventId }) => {
    if (!teamId) return null

    ensureObjectId(teamId, 'team id')
    const team = await repository.findTeamById(teamId)
    if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

    if (team.eventId?.toString() !== eventId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team does not belong to the specified event'])
    }

    return team
  }

  const ensureUniqueParticipant = async ({ eventId, userId, ignoreParticipantId = null }) => {
    const existingParticipant = await repository.findByEventAndUser({ eventId, userId })
    if (existingParticipant && existingParticipant._id.toString() !== ignoreParticipantId) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['User is already registered as a participant for this event'])
    }
  }

  const listParticipants = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildParticipantFilter(query)
    const skip = (page - 1) * limit

    const [participants, totalItems] = await Promise.all([
      repository.findAll({ filter, skip, limit }),
      repository.count(filter)
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

  const getMyParticipant = async (eventId, actor = {}) => {
    await ensureEventExists(eventId)
    if (!actor.id) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])

    const participant = await repository.findByEventAndUser({ eventId, userId: actor.id })
    if (!participant) return null
    return normalizeParticipant(participant)
  }

  const createParticipant = async (payload = {}, actor = {}) => {
    await ensureEventExists(payload.eventId)

    const targetUserId = payload.userId || actor.id
    if (!targetUserId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['userId is required'])
    }

    if (payload.userId && payload.userId !== actor.id && !hasApproverPermission(actor)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You do not have permission to register another user as a participant'])
    }

    await ensureUserExists(targetUserId)
    await ensureTeamBelongsToEvent({ teamId: payload.teamId, eventId: payload.eventId })
    await ensureUniqueParticipant({ eventId: payload.eventId, userId: targetUserId })

    const participant = await repository.create({
      ...pickSafeFields(payload, PARTICIPANT_FIELDS),
      userId: targetUserId
    })

    return normalizeParticipant(await repository.findById(participant._id))
  }

  const updateParticipant = async (id, payload = {}) => {
    const existingParticipant = await ensureParticipantExists(id)
    const safePayload = pickSafeFields(payload, PARTICIPANT_FIELDS)
    const eventId = existingParticipant.eventId?._id || existingParticipant.eventId
    const targetUserId = safePayload.userId || existingParticipant.userId?._id || existingParticipant.userId

    if (safePayload.userId) {
      await ensureUserExists(safePayload.userId)
      await ensureUniqueParticipant({
        eventId,
        userId: safePayload.userId,
        ignoreParticipantId: id
      })
    }

    if (safePayload.teamId !== undefined && safePayload.teamId !== null) {
      await ensureTeamBelongsToEvent({ teamId: safePayload.teamId, eventId })
    }

    if (safePayload.teamRole === 'LEADER' && !safePayload.teamId && !existingParticipant.teamId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Participant must belong to a team before being assigned as leader'])
    }

    const participant = await repository.updateById(id, {
      ...safePayload,
      userId: targetUserId
    })

    return normalizeParticipant(participant)
  }

  const updateCheckInStatus = async (id, checkInStatus) => {
    await ensureParticipantExists(id)
    const participant = await repository.updateById(id, {
      checkInStatus
    })
    return normalizeParticipant(participant)
  }

  const generateCheckInQr = async (eventId, actor = {}) => {
    if (!hasApproverPermission(actor)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only coordinators can generate an event check-in QR'])
    }
    await ensureEventExists(eventId)

    const token = randomToken()
    const qrPayload = `${CHECK_IN_QR_PREFIX}${token}`
    const issuedAt = now()
    const ttlMinutes = Number.isFinite(Number(qrExpiresMinutes)) && Number(qrExpiresMinutes) > 0
      ? Number(qrExpiresMinutes)
      : 5
    const expiresAt = new Date(issuedAt.getTime() + ttlMinutes * 60 * 1000)

    const qrCodeDataUrl = await qrEncoder.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320
    })

    await repository.upsertCheckInQrSession({
      eventId,
      tokenHash: hashCheckInToken(token),
      expiresAt,
      createdBy: actor.id
    })

    return {
      eventId,
      qrCodeDataUrl,
      qrPayload,
      expiresAt
    }
  }

  const scanCheckInQr = async (value, actor = {}) => {
    const token = normalizeCheckInToken(value)
    if (!token) throw new ApiError(ERROR_CODES.INVALID_CHECK_IN_QR, ['Check-in QR token is required'])

    if (!actor.id) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])

    const tokenHash = hashCheckInToken(token)
    const scannedAt = now()
    const session = await repository.findCheckInQrSessionByTokenHash(tokenHash)
    if (!session) throw new ApiError(ERROR_CODES.INVALID_CHECK_IN_QR, ['Invalid check-in QR token'])
    if (!session.expiresAt || session.expiresAt <= scannedAt) {
      throw new ApiError(ERROR_CODES.CHECK_IN_QR_EXPIRED, ['Check-in QR has expired'])
    }

    const eventId = session.eventId?._id?.toString?.() || session.eventId?.toString?.() || session.eventId
    const participant = await repository.checkInParticipantByEventAndUser({
      eventId,
      userId: actor.id,
      now: scannedAt
    })

    if (participant) return normalizeParticipant(participant)

    const existingParticipant = await repository.findByEventAndUser({ eventId, userId: actor.id })
    if (!existingParticipant) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['You are not registered as a participant for this event'])
    }
    if (existingParticipant.checkInStatus === 'CHECKED_IN') {
      throw new ApiError(ERROR_CODES.PARTICIPANT_ALREADY_CHECKED_IN, ['You have already checked in for this event'])
    }

    throw new ApiError(ERROR_CODES.CONFLICT, ['Participant could not be checked in'])
  }

  const updateAttendance = async (id, attendedActivities = []) => {
    await ensureParticipantExists(id)
    const participant = await repository.updateById(id, {
      attendedActivities
    })
    return normalizeParticipant(participant)
  }

  const updateGithubAccessStatus = async (id, githubAccessStatus) => {
    await ensureParticipantExists(id)
    const participant = await repository.updateById(id, {
      githubAccessStatus
    })
    return normalizeParticipant(participant)
  }

  return {
    listParticipants,
    getParticipantById,
    getMyParticipant,
    createParticipant,
    updateParticipant,
    updateCheckInStatus,
    generateCheckInQr,
    scanCheckInQr,
    updateAttendance,
    updateGithubAccessStatus
  }
}

export const PARTICIPANT_SERVICE = {
  ...createParticipantService(),
  normalizeParticipant
}
