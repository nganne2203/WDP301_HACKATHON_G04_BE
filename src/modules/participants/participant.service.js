import crypto from 'node:crypto'
import mongoose from 'mongoose'
import QRCode from 'qrcode'

import { PARTICIPANT_REPOSITORY } from './participant.repository.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { pickSafeFields } from '#utils/pickSafeFieldUtil.js'
import { env } from '#configs/environment.js'
import { buildSafeSearchRegex } from '#utils/sanitizeUtil.js'
import { AUDIT_LOG_REPOSITORY } from '#modules/audit-logs/audit-log.repository.js'
import { actorHasRole, getActorId } from '#utils/domainAccessUtil.js'
import { normalizeLegacyRoleName, PARTICIPANT_ROLE_NAME } from '#utils/userRoleMigrationUtil.js'

const PARTICIPANT_FIELDS = [
  'competitionId',
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
const ACTIVE_TEAM_STATUSES = new Set(['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED'])
const CHECK_IN_QR_PREFIX = 'wdp301-checkin:'

const hashCheckInToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const normalizeCheckInToken = (value = '') => {
  const token = String(value).trim()
  if (!token) return ''

  try {
    const url = new URL(token)
    const urlToken = url.searchParams.get('checkInToken') || url.searchParams.get('token')
    if (urlToken) return normalizeCheckInToken(urlToken)
  } catch {
    // The QR may still be the legacy raw token payload.
  }

  const prefixIndex = token.indexOf(CHECK_IN_QR_PREFIX)
  return prefixIndex >= 0 ? token.slice(prefixIndex + CHECK_IN_QR_PREFIX.length) : token
}

const buildCheckInQrPayload = ({ tokenPayload, checkInUrlBase }) => {
  if (!checkInUrlBase) return tokenPayload

  try {
    const url = new URL('/participant', checkInUrlBase)
    url.searchParams.set('checkInToken', tokenPayload)
    return url.toString()
  } catch {
    return tokenPayload
  }
}

const ensureObjectId = (id, fieldName = 'participant id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const buildParticipantFilter = (query = {}) => {
  const filter = {}

  if (query.competitionId) {
    ensureObjectId(query.competitionId, 'competition id')
    filter.competitionId = query.competitionId
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
    const pattern = buildSafeSearchRegex(query.search)
    if (pattern) {
      filter.$or = [
        { chapterName: pattern }
      ]
    }
  }

  return filter
}

const normalizeCompetition = (competition) => {
  if (!competition) return null
  if (typeof competition === 'string' || competition instanceof mongoose.Types.ObjectId) return { id: competition.toString() }

  return {
    id: competition._id?.toString() || competition.id,
    title: competition.title,
    semester: competition.semester,
    season: competition.season,
    year: competition.year,
    status: competition.status,
    startDate: competition.startDate,
    endDate: competition.endDate
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
    competition: normalizeCompetition(plainParticipant.competitionId),
    competitionId: plainParticipant.competitionId?._id?.toString?.() || plainParticipant.competitionId?.toString?.() || plainParticipant.competitionId,
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

const userHasRole = (user = {}, roleName) => {
  const normalizedRoleName = normalizeLegacyRoleName(roleName)
  return (user.roles || []).some(role => normalizeLegacyRoleName(role?.name || role?.code || role) === normalizedRoleName)
}

const isCompetitionRegistrationOpen = (competition, now) => {
  if (competition?.status !== 'OPEN_REGISTRATION') return false
  if (competition.registrationStart && now < new Date(competition.registrationStart)) return false
  if (competition.registrationEnd && now > new Date(competition.registrationEnd)) return false
  return true
}

export const createParticipantService = ({
  repository = PARTICIPANT_REPOSITORY,
  auditLogRepository = AUDIT_LOG_REPOSITORY,
  qrEncoder = QRCode,
  randomToken = () => crypto.randomBytes(32).toString('base64url'),
  now = () => new Date(),
  qrExpiresMinutes = env.checkInQr.expiresMinutes,
  checkInUrlBase = env.client.frontendUrl,
  relaxedWorkflow = false
} = {}) => {
  const ensureParticipantExists = async (id) => {
    ensureObjectId(id)
    const participant = await repository.findById(id)
    if (!participant) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Participant not found'])
    return participant
  }

  const ensureParticipantHasConfirmedTeam = async (participant) => {
    const teamId = participant.teamId?._id || participant.teamId
    if (!teamId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only members of confirmed teams can check in'])
    }

    const team = participant.teamId?.status ? participant.teamId : await repository.findTeamById(teamId)
    if (!team || team.status !== 'CONFIRMED') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only members of confirmed teams can check in'])
    }
  }

  const ensureCompetitionExists = async (competitionId) => {
    ensureObjectId(competitionId, 'competition id')
    const competition = await repository.findCompetitionById(competitionId)
    if (!competition) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Competition not found'])
    return competition
  }

  const ensureUserExists = async (userId) => {
    ensureObjectId(userId, 'user id')
    const user = await repository.findUserById(userId)
    if (!user) throw new ApiError(ERROR_CODES.NOT_FOUND, ['User not found'])
    return user
  }

  const ensureTeamBelongsToCompetition = async ({ teamId, competitionId }) => {
    if (!teamId) return null

    ensureObjectId(teamId, 'team id')
    const team = await repository.findTeamById(teamId)
    if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

    if (team.competitionId?.toString() !== competitionId.toString()) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team does not belong to the specified competition'])
    }

    return team
  }

  const ensureCheckInWindowOpen = async (competitionId, { allowOverride = false, overrideReason = null, actor = null } = {}) => {
    const competition = await ensureCompetitionExists(competitionId)
    const relaxedCheckInStatuses = ['OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'ONGOING', 'SCORING']
    const checkInOpen = competition.status === 'ONGOING' ||
      (relaxedWorkflow && relaxedCheckInStatuses.includes(competition.status))

    if (checkInOpen) return { competition, overridden: false }

    if (allowOverride) {
      const reason = String(overrideReason || '').trim()
      if (!reason) {
        throw new ApiError(ERROR_CODES.BAD_REQUEST, ['overrideReason is required for manual check-in override'])
      }
      await auditLogRepository.create({
        userId: getActorId(actor),
        action: 'CHECK_IN_WINDOW_OVERRIDE',
        resourceType: 'Competition',
        resourceId: competitionId,
        metadata: {
          reason,
          competitionStatus: competition.status
        }
      })
      return { competition, overridden: true }
    }

    if (competition.status !== 'ONGOING') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Check-in is only available while the competition is ONGOING'])
    }
  }

  const ensureUserCanRegisterForCompetition = async ({ competition, user, actor = {}, overrideReason = null }) => {
    if (hasApproverPermission(actor)) {
      const normalFlow = isCompetitionRegistrationOpen(competition, now())
      if (!normalFlow) {
        const reason = String(overrideReason || '').trim()
        if (!reason) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, ['overrideReason is required for participant registration override'])
        }
        await auditLogRepository.create({
          userId: getActorId(actor),
          action: 'PARTICIPANT_REGISTRATION_OVERRIDE',
          resourceType: 'Participant',
          metadata: {
            competitionId: competition._id || competition.id,
            targetUserId: user._id || user.id,
            reason,
            competitionStatus: competition.status
          }
        })
      }
      return
    }

    if (!isCompetitionRegistrationOpen(competition, now())) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Competition registration is not open'])
    }
    if (user.status !== 'ACTIVE') {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['User account must be ACTIVE to register for an competition'])
    }
    if (!userHasRole(user, PARTICIPANT_ROLE_NAME)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only participant accounts can register for competitions'])
    }
  }

  const ensureUniqueParticipant = async ({ competitionId, userId, ignoreParticipantId = null }) => {
    const existingParticipant = await repository.findByCompetitionAndUser({ competitionId, userId })
    if (existingParticipant && existingParticipant._id.toString() !== ignoreParticipantId) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['User is already registered as a participant for this competition'])
    }
  }

  const listParticipants = async (query = {}) => {
    const { page, limit } = normalizePaginationQuery(query)
    const filter = buildParticipantFilter(query)
    if (query.confirmedTeamsOnly) {
      const confirmedTeamIds = await repository.findConfirmedTeamIds({ competitionId: query.competitionId })
      filter.teamId = { $in: confirmedTeamIds }
    }
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

  const getMyParticipant = async (competitionId, actor = {}) => {
    await ensureCompetitionExists(competitionId)
    if (!actor.id) throw new ApiError(ERROR_CODES.UNAUTHORIZED, ['Authentication is required'])

    const participant = await repository.findByCompetitionAndUser({ competitionId, userId: actor.id })
    if (!participant) return null
    return normalizeParticipant(participant)
  }

  const createParticipant = async (payload = {}, actor = {}) => {
    const competition = await ensureCompetitionExists(payload.competitionId)

    const targetUserId = payload.userId || actor.id
    if (!targetUserId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['userId is required'])
    }

    if (payload.userId && payload.userId !== actor.id && !hasApproverPermission(actor)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You do not have permission to register another user as a participant'])
    }

    const user = await ensureUserExists(targetUserId)
    await ensureUserCanRegisterForCompetition({
      competition,
      user,
      actor,
      overrideReason: payload.overrideReason
    })
    const team = await ensureTeamBelongsToCompetition({ teamId: payload.teamId, competitionId: payload.competitionId })
    if (team && !ACTIVE_TEAM_STATUSES.has(team.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Participant can only be assigned to an active team'])
    }
    await ensureUniqueParticipant({ competitionId: payload.competitionId, userId: targetUserId })

    const participant = await repository.create({
      ...pickSafeFields(payload, PARTICIPANT_FIELDS),
      userId: targetUserId
    })

    return normalizeParticipant(await repository.findById(participant._id))
  }

  const updateParticipant = async (id, payload = {}) => {
    const existingParticipant = await ensureParticipantExists(id)
    const safePayload = pickSafeFields(payload, PARTICIPANT_FIELDS)
    const competitionId = existingParticipant.competitionId?._id || existingParticipant.competitionId
    const targetUserId = safePayload.userId || existingParticipant.userId?._id || existingParticipant.userId

    if (safePayload.userId) {
      await ensureUserExists(safePayload.userId)
      await ensureUniqueParticipant({
        competitionId,
        userId: safePayload.userId,
        ignoreParticipantId: id
      })
    }

    if (safePayload.teamId !== undefined && safePayload.teamId !== null) {
      await ensureTeamBelongsToCompetition({ teamId: safePayload.teamId, competitionId })
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

  const updateCheckInStatus = async (id, checkInStatus, actor = {}, options = {}) => {
    const existingParticipant = await ensureParticipantExists(id)
    await ensureParticipantHasConfirmedTeam(existingParticipant)
    const competitionId = existingParticipant.competitionId?._id?.toString?.() || existingParticipant.competitionId?.toString?.() || existingParticipant.competitionId
    const allowOverride = hasApproverPermission(actor) && actorHasRole(actor, 'ADMIN') && Boolean(options.overrideReason)
    await ensureCheckInWindowOpen(competitionId, {
      allowOverride,
      overrideReason: options.overrideReason,
      actor
    })
    const participant = await repository.updateById(id, {
      checkInStatus,
      ...(checkInStatus === 'CHECKED_IN'
        ? {
          checkedInAt: now(),
          checkedInBy: getActorId(actor)
        }
        : {})
    })
    return normalizeParticipant(participant)
  }

  const generateCheckInQr = async (competitionId, actor = {}) => {
    if (!hasApproverPermission(actor)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only coordinators can generate an competition check-in QR'])
    }
    await ensureCheckInWindowOpen(competitionId)

    const token = randomToken()
    const tokenPayload = `${CHECK_IN_QR_PREFIX}${token}`
    const qrPayload = buildCheckInQrPayload({ tokenPayload, checkInUrlBase })
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
      competitionId,
      tokenHash: hashCheckInToken(token),
      expiresAt,
      createdBy: actor.id
    })

    return {
      competitionId,
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

    const competitionId = session.competitionId?._id?.toString?.() || session.competitionId?.toString?.() || session.competitionId
    await ensureCheckInWindowOpen(competitionId)
    const existingParticipant = await repository.findByCompetitionAndUser({ competitionId, userId: actor.id })
    if (!existingParticipant) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['You are not registered as a participant for this competition'])
    }
    await ensureParticipantHasConfirmedTeam(existingParticipant)
    if (existingParticipant.checkInStatus === 'CHECKED_IN') {
      throw new ApiError(ERROR_CODES.PARTICIPANT_ALREADY_CHECKED_IN, ['You have already checked in for this competition'])
    }

    const participant = await repository.checkInParticipantByCompetitionAndUser({
      competitionId,
      userId: actor.id,
      now: scannedAt
    })

    if (participant) return normalizeParticipant(participant)

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
  ...createParticipantService({ relaxedWorkflow: env.workflow.relaxedDemoRules }),
  normalizeParticipant
}
