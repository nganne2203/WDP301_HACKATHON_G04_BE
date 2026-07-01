import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { TEAM_REPOSITORY } from './team.repository.js'
import { EMAIL_SERVICE } from '#modules/notifications/email.service.js'
import { EMAIL_TEMPLATE_KEYS } from '#modules/notifications/email-templates.js'
import { NOTIFICATION_SERVICE } from '#modules/notifications/notification.service.js'
import { env } from '#configs/environment.js'
import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { LOGGER } from '#utils/logger.js'
import { normalizePaginationQuery } from '#utils/pagination.js'
import { PERMISSIONS } from '#constants/permissions.js'
import { GITHUB_SERVICE } from '#modules/github/github.service.js'
import { ACCESSIBLE_USER_STATUSES, REGISTRATION_SOURCES } from '#utils/userAccountUtil.js'
import { PARTICIPANT_ROLE_NAME } from '#utils/userRoleMigrationUtil.js'

export const TEAM_STATUSES = {
  PENDING: 'PENDING',
  WAITING_FOR_MEMBERS: 'WAITING_FOR_MEMBERS',
  WAITLISTED: 'WAITLISTED',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DISQUALIFIED: 'DISQUALIFIED'
}

export const INVITATION_STATUSES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
}

const CONFIRMED_TEAM_STATUSES = [TEAM_STATUSES.CONFIRMED, TEAM_STATUSES.ACTIVE]
const OPEN_TEAM_STATUSES = [TEAM_STATUSES.PENDING, TEAM_STATUSES.WAITING_FOR_MEMBERS, TEAM_STATUSES.WAITLISTED]
const ACTIVE_PARTICIPANT_STATUSES = ['INVITED', 'ACTIVE']
const COORDINATOR_ROLES = ['ADMIN', 'COORDINATOR', 'EVENT_COORDINATOR']
const MENTOR_SCOPED_ROLES = ['MENTOR', 'SPEAKER']
const EVENT_STATUSES = {
  OPEN_REGISTRATION: 'OPEN_REGISTRATION',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED'
}
const REGISTRATION_CLOSE_REASONS = {
  CAPACITY_REACHED: 'CAPACITY_REACHED',
  REGISTRATION_ENDED: 'REGISTRATION_ENDED'
}
export const TEAM_REJECTION_REASONS = {
  CAPACITY_REACHED: 'The required number of confirmed teams has already been reached.',
  REGISTRATION_CLOSED: 'Registration has closed before this team was fully confirmed.',
  REGISTRATION_ENDED: 'Registration ended before this team was fully confirmed.'
}

const getId = (value) => {
  return value?._id?.toString?.() || value?.id || value?.toString?.()
}

const isSameId = (left, right) => {
  const leftId = getId(left)
  const rightId = getId(right)
  return Boolean(leftId && rightId && leftId === rightId)
}

const uniqueIds = (values = []) => {
  return [...new Set(values.map(getId).filter(Boolean))]
}

const normalizeTeamName = (name) => {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

const normalizeEmailAddress = (email) => {
  return String(email || '').trim().toLowerCase()
}

const ensureEmailIsNotLeader = (email, leader) => {
  if (normalizeEmailAddress(email) === normalizeEmailAddress(leader?.email)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team leader cannot invite their own email'])
  }
}

const ensureMembersDoNotContainLeader = (members = [], leader) => {
  for (const member of members) {
    ensureEmailIsNotLeader(member.email, leader)
  }
}

const buildTeamRejectedMessage = (team, reason) => {
  return `${team?.name || 'Your team'} was rejected. ${reason}`
}

export const hashInvitationToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export const createInvitationToken = () => {
  return crypto.randomBytes(32).toString('base64url')
}

export const normalizeInvitationEmails = (emails = []) => {
  return [...new Set(emails.map((email) => String(email).trim().toLowerCase()).filter(Boolean))]
}

export const normalizeInvitationMembers = ({ members = [], emails = [] } = {}) => {
  const normalizedMembers = [
    ...members.map((member) => ({
      fullName: String(member.fullName || '').trim(),
      email: String(member.email || '').trim().toLowerCase(),
      githubUsername: String(member.githubUsername || '').trim()
    })),
    ...emails.map((email) => ({
      fullName: '',
      email: String(email || '').trim().toLowerCase(),
      githubUsername: ''
    }))
  ].filter(member => member.email)

  const uniqueMembers = []
  const seenEmails = new Set()
  for (const member of normalizedMembers) {
    if (seenEmails.has(member.email)) continue
    seenEmails.add(member.email)
    uniqueMembers.push(member)
  }

  return uniqueMembers
}

export const isRegistrationOpen = (event, now = new Date()) => {
  if (!event || event.status !== EVENT_STATUSES.OPEN_REGISTRATION) return false

  if (event.registrationStart && now < new Date(event.registrationStart)) return false
  if (event.registrationEnd && now > new Date(event.registrationEnd)) return false

  return true
}

const getMaxTeams = (event) => {
  return event?.maxTeams || 30
}

const getRegistrationClosure = ({ event, confirmedCount = null, now = new Date() }) => {
  if (!event || event.status !== EVENT_STATUSES.OPEN_REGISTRATION) return null

  if (event.registrationEnd && now > new Date(event.registrationEnd)) {
    return {
      status: EVENT_STATUSES.REGISTRATION_CLOSED,
      registrationClosedAt: now,
      registrationCloseReason: REGISTRATION_CLOSE_REASONS.REGISTRATION_ENDED
    }
  }

  if (confirmedCount !== null && confirmedCount >= getMaxTeams(event)) {
    return {
      status: EVENT_STATUSES.REGISTRATION_CLOSED,
      registrationClosedAt: now,
      registrationCloseReason: REGISTRATION_CLOSE_REASONS.CAPACITY_REACHED
    }
  }

  return null
}

const syncEventRegistrationStatus = async ({ repository, event, session, confirmedCount = null, now = new Date() }) => {
  const closure = getRegistrationClosure({ event, confirmedCount, now })
  if (!closure) return event

  const updatedEvent = await repository.updateEventById(getId(event), closure, { session })
  return updatedEvent || event
}

const getFrontendUrl = (path, logger = LOGGER) => {
  const frontendUrl = env.client.frontendUrl || env.client.urls[0]
  if (!frontendUrl) return null

  try {
    return new URL(path, frontendUrl).toString()
  } catch (error) {
    logger.warn('Team frontend URL is invalid; skipping generated link', {
      frontendUrl,
      path,
      error: error.message
    })
    return null
  }
}

const appendSearchParams = (urlString, params = {}, logger = LOGGER) => {
  if (!urlString) return null

  try {
    const url = new URL(urlString)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
    return url.toString()
  } catch (error) {
    logger.warn('Generated team URL is invalid while appending query params', {
      urlString,
      error: error.message
    })
    return null
  }
}

const buildInvitationUrls = (token, logger = LOGGER) => {
  const baseUrl = getFrontendUrl('/team-invitations/confirm', logger)
  if (!baseUrl) {
    return {
      acceptUrl: null,
      declineUrl: null
    }
  }

  return {
    acceptUrl: appendSearchParams(baseUrl, { token, decision: 'accept' }, logger),
    declineUrl: appendSearchParams(baseUrl, { token, decision: 'decline' }, logger)
  }
}

const buildLoginUrl = (logger = LOGGER) => {
  return getFrontendUrl('/login', logger)
}

const buildFullNameFromEmail = (email) => {
  return String(email).split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

const normalizeUserSummary = (user) => {
  if (!user) return null
  const plainUser = typeof user.toObject === 'function'
    ? user.toObject({ getters: true, virtuals: false })
    : user

  return {
    id: getId(plainUser._id) || plainUser.id,
    email: plainUser.email,
    fullName: plainUser.fullName,
    githubUsername: plainUser.githubUsername,
    status: plainUser.status,
    mustChangePassword: Boolean(plainUser.mustChangePassword)
  }
}

const normalizeEventSummary = (event) => {
  if (!event) return null
  const plainEvent = typeof event.toObject === 'function'
    ? event.toObject({ getters: true, virtuals: false })
    : event

  return {
    id: getId(plainEvent._id) || plainEvent.id,
    title: plainEvent.title,
    status: plainEvent.status,
    registrationStart: plainEvent.registrationStart,
    registrationEnd: plainEvent.registrationEnd,
    registrationClosedAt: plainEvent.registrationClosedAt,
    registrationCloseReason: plainEvent.registrationCloseReason,
    minTeamMembers: plainEvent.minTeamMembers,
    maxTeamMembers: plainEvent.maxTeamMembers,
    maxTeams: getMaxTeams(plainEvent),
    competitionConfig: plainEvent.competitionConfig || null
  }
}

const normalizeTrackSummary = (track) => {
  if (!track) return null
  if (typeof track === 'string' || track instanceof mongoose.Types.ObjectId) {
    return { id: track.toString() }
  }

  return {
    id: getId(track._id) || track.id,
    code: track.code,
    name: track.name,
    type: track.type,
    maxTeams: track.maxTeams,
    status: track.status
  }
}

const normalizeParticipant = (participant) => {
  if (!participant) return null
  const plainParticipant = typeof participant.toObject === 'function'
    ? participant.toObject({ getters: true, virtuals: false })
    : participant

  return {
    id: getId(plainParticipant._id) || plainParticipant.id,
    eventId: getId(plainParticipant.eventId),
    teamId: getId(plainParticipant.teamId),
    user: normalizeUserSummary(plainParticipant.userId),
    teamRole: plainParticipant.teamRole,
    status: plainParticipant.status,
    joinedAt: plainParticipant.joinedAt,
    createdAt: plainParticipant.createdAt,
    updatedAt: plainParticipant.updatedAt
  }
}

const normalizeInvitation = (invitation) => {
  if (!invitation) return null
  const plainInvitation = typeof invitation.toObject === 'function'
    ? invitation.toObject({ getters: true, virtuals: false })
    : invitation

  return {
    id: getId(plainInvitation._id) || plainInvitation.id,
    eventId: getId(plainInvitation.eventId),
    teamId: getId(plainInvitation.teamId),
    leaderId: getId(plainInvitation.leaderId),
    invitedEmail: plainInvitation.invitedEmail,
    invitedUserId: getId(plainInvitation.invitedUserId),
    invitedUser: plainInvitation.invitedUserId?.email ? normalizeUserSummary(plainInvitation.invitedUserId) : null,
    status: plainInvitation.status,
    expiresAt: plainInvitation.expiresAt,
    acceptedAt: plainInvitation.acceptedAt,
    declinedAt: plainInvitation.declinedAt,
    cancelledAt: plainInvitation.cancelledAt,
    replacedByInvitationId: getId(plainInvitation.replacedByInvitationId),
    createdAt: plainInvitation.createdAt,
    updatedAt: plainInvitation.updatedAt
  }
}

const normalizeTeam = ({ team, participants = [], invitations = [] } = {}) => {
  if (!team) return null
  const plainTeam = typeof team.toObject === 'function'
    ? team.toObject({ getters: true, virtuals: false })
    : team
  const normalizedMentorEntries = (plainTeam.mentorIds || []).filter((mentor) => {
    if (!mentor) return false
    if (typeof mentor === 'string' || mentor instanceof mongoose.Types.ObjectId) return true
    if (!Array.isArray(mentor.roles)) return true
    return userHasRole(mentor, 'MENTOR')
  })
  const normalizedMentorUsers = (plainTeam.mentorIds || [])
    .filter((mentor) => normalizedMentorEntries.includes(mentor))
    .map(normalizeUserSummary)
    .filter(Boolean)

  return {
    id: getId(plainTeam._id) || plainTeam.id,
    event: normalizeEventSummary(plainTeam.eventId),
    eventId: getId(plainTeam.eventId),
    track: normalizeTrackSummary(plainTeam.trackId),
    trackId: getId(plainTeam.trackId),
    leader: normalizeUserSummary(plainTeam.leaderId),
    leaderId: getId(plainTeam.leaderId),
    members: (plainTeam.memberIds || []).map(normalizeUserSummary).filter(Boolean),
    assignedMentors: normalizedMentorUsers,
    mentorIds: normalizedMentorEntries.map(getId).filter(Boolean),
    name: plainTeam.name,
    chapterName: plainTeam.chapterName,
    projectName: plainTeam.projectName,
    boardNumber: plainTeam.boardNumber,
    placementSlot: plainTeam.placementSlot,
    waitlistPosition: plainTeam.waitlistPosition,
    trackAssignmentMethod: plainTeam.trackAssignmentMethod,
    trackAssignedAt: plainTeam.trackAssignedAt,
    status: plainTeam.status,
    qualificationStatus: plainTeam.qualificationStatus,
    confirmedAt: plainTeam.confirmedAt,
    rejectedAt: plainTeam.rejectedAt,
    rejectionReason: plainTeam.rejectionReason,
    participants: participants.map(normalizeParticipant).filter(Boolean),
    invitations: invitations.map(normalizeInvitation).filter(Boolean),
    createdAt: plainTeam.createdAt,
    updatedAt: plainTeam.updatedAt
  }
}

const actorHasPermission = (actor = {}, permission) => {
  const permissions = actor.effectivePermissions || actor.permissions || []
  return permissions.includes(permission)
}

const hasMentorScopedRole = (actor = {}) => {
  return (actor.roles || []).some(role => MENTOR_SCOPED_ROLES.includes(String(role).toUpperCase()))
}

const hasCoordinatorRole = (actor = {}) => {
  return (actor.roles || []).some(role => COORDINATOR_ROLES.includes(String(role).toUpperCase()))
}

const hasTeamManagementPermission = (actor = {}) => {
  return actorHasPermission(actor, PERMISSIONS.TEAM_UPDATE)
}

const ensureTeamManagementPermission = (actor = {}) => {
  if (!hasTeamManagementPermission(actor)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['You do not have permission to manage teams'])
  }
}

const ensureObjectId = (id, fieldName = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Invalid ${fieldName}`])
  }
}

const ensureUniqueTeamName = async ({ repository, eventId, name, session }) => {
  const existingTeam = await repository.findTeamByEventAndName({ eventId, name }, { session })
  if (existingTeam) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['Team name already exists in this event'])
  }
}

const isDuplicateKeyError = (error) => {
  return error?.code === 11000
}

const mapDuplicateTeamError = (error) => {
  if (!isDuplicateKeyError(error)) return error

  const keyPattern = error.keyPattern || {}
  const keyNames = Object.keys(keyPattern)

  if (keyNames.includes('name') || keyNames.includes('normalizedName')) {
    return new ApiError(ERROR_CODES.CONFLICT, ['Team name already exists in this event'])
  }

  if (keyNames.includes('leaderId')) {
    return new ApiError(ERROR_CODES.CONFLICT, ['You already created a team for this event'])
  }

  return new ApiError(ERROR_CODES.CONFLICT, ['Team name or leader already exists in this event'])
}

const ensureEventOpen = (event) => {
  if (!isRegistrationOpen(event)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Event registration is not open'])
  }
}

const ensureTeamIsNotRejected = (team) => {
  if (team.status === TEAM_STATUSES.REJECTED) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team has been rejected and cannot be changed'])
  }
}

const ensureTeamLeader = (team, actor) => {
  if (!isSameId(team.leaderId, actor.id)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only the team leader can perform this action'])
  }
}

const ensureTeamSizeWithinEventRules = (team, event) => {
  const memberCount = (team.memberIds || []).length
  if (memberCount < (event.minTeamMembers || 1)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team does not meet the minimum member requirement for this event'])
  }

  if (memberCount > (event.maxTeamMembers || 5)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team exceeds the maximum member limit for this event'])
  }
}

const ensureTeamReadable = (team, actor) => {
  const memberIds = (team.memberIds || []).map(getId)
  const mentorIds = (team.mentorIds || []).map(getId)
  const actorId = actor.id

  if (
    hasTeamManagementPermission(actor) ||
    isSameId(team.leaderId, actorId) ||
    memberIds.includes(actorId) ||
    mentorIds.includes(actorId)
  ) {
    return
  }

  throw new ApiError(ERROR_CODES.FORBIDDEN, ['You can only view your own team'])
}

const userHasRole = (user = {}, roleName) => {
  const normalizedRole = String(roleName || '').toUpperCase()
  return (user.roles || []).some(role => String(role?.name || role).toUpperCase() === normalizedRole)
}

const validateMentorAssignments = async ({ repository, mentorIds = [], session }) => {
  const normalizedMentorIds = uniqueIds(mentorIds)
  if (normalizedMentorIds.length === 0) {
    return {
      mentorIds: [],
      mentors: []
    }
  }

  const mentors = await repository.findUsersByIds(normalizedMentorIds, { session })
  if (mentors.length !== normalizedMentorIds.length) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['One or more mentor accounts were not found'])
  }

  for (const mentor of mentors) {
    if (!ACCESSIBLE_USER_STATUSES.includes(mentor.status)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`Mentor ${mentor.fullName || mentor.email} must be APPROVED or ACTIVE`])
    }

    if (!userHasRole(mentor, 'MENTOR')) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, [`User ${mentor.fullName || mentor.email} does not have the mentor role`])
    }
  }

  return {
    mentorIds: normalizedMentorIds,
    mentors
  }
}

const buildMentorDiff = ({ previousMentorIds = [], nextMentorIds = [] }) => {
  const normalizedPreviousMentorIds = uniqueIds(previousMentorIds)
  const normalizedNextMentorIds = uniqueIds(nextMentorIds)

  return {
    previousMentorIds: normalizedPreviousMentorIds,
    nextMentorIds: normalizedNextMentorIds,
    addedMentorIds: normalizedNextMentorIds.filter(id => !normalizedPreviousMentorIds.includes(id)),
    removedMentorIds: normalizedPreviousMentorIds.filter(id => !normalizedNextMentorIds.includes(id))
  }
}

const ensureConfirmedSlotsNotFull = async ({ event, repository, session }) => {
  const confirmedCount = await repository.countTeams({
    eventId: getId(event),
    status: { $in: CONFIRMED_TEAM_STATUSES }
  }, { session })

  if (confirmedCount >= getMaxTeams(event)) {
    throw new ApiError(ERROR_CODES.CONFLICT, [TEAM_REJECTION_REASONS.CAPACITY_REACHED])
  }
}

const loadEventForRegistration = async ({ repository, eventId, session }) => {
  let event = await repository.findEventById(eventId, { session })
  if (!event) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
  }

  const confirmedCount = await repository.countTeams({
    eventId: getId(event),
    status: { $in: CONFIRMED_TEAM_STATUSES }
  }, { session })

  event = await syncEventRegistrationStatus({
    repository,
    event,
    session,
    confirmedCount
  })

  return { event, confirmedCount }
}

const getCompetitionConfig = (event = {}) => {
  return event?.competitionConfig || {}
}

const getTrackCapacity = ({ event, track }) => {
  return track?.maxTeams || getCompetitionConfig(event).maxTeamsPerBoard || null
}

const buildBoardInfoByTrack = (tracks = []) => {
  const sortedTracks = [...tracks].sort((left, right) => {
    const leftKey = `${left.code || ''}:${left.name || ''}:${getId(left) || ''}`
    const rightKey = `${right.code || ''}:${right.name || ''}:${getId(right) || ''}`
    return leftKey.localeCompare(rightKey)
  })

  return new Map(sortedTracks.map((track, index) => [getId(track), index + 1]))
}

const ensureTrackBelongsToEvent = async ({ repository, eventId, trackId, session }) => {
  if (!trackId) return null

  ensureObjectId(trackId, 'track id')
  const track = await repository.findTrackById(trackId, { session })
  if (!track) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, ['Track not found'])
  }

  if (!isSameId(track.eventId, eventId)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Track does not belong to this event'])
  }

  return track
}

const getTrackOccupancy = async ({ repository, eventId, trackId, excludeTeamId = null, session }) => {
  const filter = {
    eventId,
    trackId,
    status: { $in: CONFIRMED_TEAM_STATUSES }
  }

  if (excludeTeamId) {
    filter._id = { $ne: excludeTeamId }
  }

  return await repository.countTeams(filter, { session })
}

const getWaitlistPosition = async ({ repository, eventId, trackId = null, excludeTeamId = null, session }) => {
  const filter = {
    eventId,
    status: TEAM_STATUSES.WAITLISTED
  }

  if (trackId) {
    filter.trackId = trackId
  }

  if (excludeTeamId) {
    filter._id = { $ne: excludeTeamId }
  }

  const count = await repository.countTeams(filter, { session })
  return count + 1
}

const buildCapacitySummary = async ({ repository, event, session }) => {
  const eventId = getId(event)
  const tracks = await repository.findTracksByEvent(eventId, { session })
  const boardNumberByTrackId = buildBoardInfoByTrack(tracks)
  const fallbackTrackCapacity = getCompetitionConfig(event).maxTeamsPerBoard || null

  const trackSummaries = []
  let totalOccupiedSlots = 0
  let totalCapacity = 0

  for (const track of tracks) {
    const occupiedSlots = await getTrackOccupancy({
      repository,
      eventId,
      trackId: getId(track),
      session
    })
    const capacity = getTrackCapacity({ event, track }) || fallbackTrackCapacity
    totalOccupiedSlots += occupiedSlots
    if (capacity) totalCapacity += capacity

    trackSummaries.push({
      track: normalizeTrackSummary(track),
      trackId: getId(track),
      boardNumber: boardNumberByTrackId.get(getId(track)) || null,
      capacity,
      occupiedSlots,
      availableSlots: capacity === null ? null : Math.max(capacity - occupiedSlots, 0),
      isFull: capacity === null ? false : occupiedSlots >= capacity
    })
  }

  return {
    event: normalizeEventSummary(event),
    eventId,
    boardCount: getCompetitionConfig(event).boardCount || tracks.length || null,
    trackCount: getCompetitionConfig(event).trackCount || tracks.length || null,
    maxTeamsPerBoard: getCompetitionConfig(event).maxTeamsPerBoard || null,
    totalCapacity: totalCapacity || null,
    totalOccupiedSlots,
    availableSlots: totalCapacity ? Math.max(totalCapacity - totalOccupiedSlots, 0) : null,
    tracks: trackSummaries
  }
}

const assignTeamPlacement = async ({
  repository,
  event,
  team,
  preferredTrackId = null,
  trackAssignmentMethod = 'SYSTEM',
  session,
  allowWaitlist = true
}) => {
  const eventId = getId(event)
  const tracks = await repository.findTracksByEvent(eventId, { session })
  if (tracks.length === 0) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['No tracks are configured for this event'])
  }

  const boardNumberByTrackId = buildBoardInfoByTrack(tracks)
  const selectedTrackId = preferredTrackId || getId(team.trackId)

  let candidateTracks = tracks
  if (selectedTrackId) {
    const selectedTrack = tracks.find(track => isSameId(track, selectedTrackId))
    if (!selectedTrack) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Track does not belong to this event'])
    }
    candidateTracks = [selectedTrack]
  }

  let selectedPlacement = null
  const candidateSummaries = []
  for (const track of candidateTracks) {
    const occupiedSlots = await getTrackOccupancy({
      repository,
      eventId,
      trackId: getId(track),
      excludeTeamId: getId(team),
      session
    })
    const capacity = getTrackCapacity({ event, track })

    candidateSummaries.push({
      track,
      occupiedSlots,
      capacity,
      hasCapacity: capacity === null || occupiedSlots < capacity
    })
  }

  selectedPlacement = candidateSummaries
    .filter(candidate => candidate.hasCapacity)
    .sort((left, right) => left.occupiedSlots - right.occupiedSlots)[0]

  if (selectedPlacement) {
    selectedPlacement = {
      track: selectedPlacement.track,
      boardNumber: boardNumberByTrackId.get(getId(selectedPlacement.track)) || null,
      placementSlot: selectedPlacement.occupiedSlots + 1
    }
  }

  if (!selectedPlacement) {
    if (!allowWaitlist) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['Selected track is full'])
    }

    const waitlistTrackId = selectedTrackId || getId(candidateTracks[0])
    return await repository.updateTeamById(getId(team), {
      trackId: waitlistTrackId,
      boardNumber: waitlistTrackId ? boardNumberByTrackId.get(waitlistTrackId) || null : null,
      placementSlot: null,
      waitlistPosition: await getWaitlistPosition({
        repository,
        eventId,
        trackId: waitlistTrackId,
        excludeTeamId: getId(team),
        session
      }),
      trackAssignmentMethod,
      trackAssignedAt: new Date(),
      status: TEAM_STATUSES.WAITLISTED
    }, { session })
  }

  return await repository.updateTeamById(getId(team), {
    trackId: getId(selectedPlacement.track),
    boardNumber: selectedPlacement.boardNumber,
    placementSlot: selectedPlacement.placementSlot,
    waitlistPosition: null,
    status: team.status === TEAM_STATUSES.WAITLISTED ? TEAM_STATUSES.CONFIRMED : team.status,
    trackAssignmentMethod,
    trackAssignedAt: new Date()
  }, { session })
}

const ensureParticipantCanJoinEvent = async ({
  repository,
  eventId,
  user,
  targetTeamId = null,
  excludeInvitationId = null,
  session
}) => {
  const userId = getId(user)

  if (!userId) return

  const participant = await repository.findParticipantByEventAndUser({ eventId, userId }, { session })
  if (
    participant &&
    ACTIVE_PARTICIPANT_STATUSES.includes(participant.status) &&
    (!targetTeamId || !isSameId(participant.teamId, targetTeamId))
  ) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['User already belongs to another team in this event'])
  }

  const blockingInvitation = await repository.findBlockingInvitation({
    eventId,
    email: user.email,
    userId,
    excludeInvitationId
  }, { session })

  if (blockingInvitation) {
    throw new ApiError(ERROR_CODES.CONFLICT, ['User already has an active invitation for this event'])
  }
}

const buildInvitationEmailContext = ({ event, team, leader, token, invitedUser, fullName, email, logger = LOGGER }) => {
  const { acceptUrl, declineUrl } = buildInvitationUrls(token, logger)

  return {
    to: email,
    template: EMAIL_TEMPLATE_KEYS.TEAM_INVITATION,
    context: {
      fullName: invitedUser?.fullName || fullName || email,
      eventTitle: event.title,
      teamName: team.name,
      leaderName: leader.fullName,
      leaderEmail: leader.email,
      acceptUrl,
      declineUrl
    },
    metadata: {
      eventId: getId(event),
      teamId: getId(team),
      invitedUserId: getId(invitedUser)
    }
  }
}

const sendEmailJob = async (emailService, logger, job) => {
  try {
    await emailService.sendTemplateEmail(job)
  } catch (error) {
    logger.error('Team email job failed', {
      template: job.template,
      to: job.to,
      message: error.message,
      stack: error.stack
    })
  }
}

const sendNotificationJob = async (notificationService, logger, job) => {
  try {
    await notificationService.notifyUser(job)
  } catch (error) {
    logger.error('Team notification job failed', {
      title: job.title,
      userId: getId(job.user),
      error: error.message
    })
  }
}

const sendJobs = async ({ jobs, emailService, notificationService, logger }) => {
  for (const job of jobs) {
    if (job.kind === 'email') {
      await sendEmailJob(emailService, logger, job.payload)
    }

    if (job.kind === 'notification') {
      await sendNotificationJob(notificationService, logger, job.payload)
    }

    if (job.kind === 'github_assign') {
      try {
        await GITHUB_SERVICE.assignCollaborator({
          eventId: job.payload.eventId,
          repoName: job.payload.repoName,
          username: job.payload.githubUsername,
          permission: 'push'
        }, job.payload.actor)
      } catch (err) {
        logger.error('Failed to auto-assign collaborator upon invitation acceptance', {
          repoName: job.payload.repoName,
          username: job.payload.githubUsername,
          error: err.message
        })
      }
    }
  }
}

const runWithOptionalTransaction = async ({ repository, logger, work }) => {
  const session = await repository.createSession()

  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result
  } catch (error) {
    const unsupportedTransaction = /Transaction numbers|replica set member|mongos/i.test(error.message)
    if (!unsupportedTransaction) throw error

    logger.warn('MongoDB transaction is not available; running team flow without transaction', {
      error: error.message
    })
    return await work(null)
  } finally {
    await session.endSession()
  }
}

const createInvitationForEmail = async ({
  repository,
  event,
  team,
  leader,
  email,
  fullName,
  githubUsername,
  session,
  jobs,
  excludeInvitationId = null,
  logger = LOGGER
}) => {
  ensureEmailIsNotLeader(email, leader)

  let invitedUser = await repository.findUserByEmail(email, { session })

  if (invitedUser) {
    await ensureParticipantCanJoinEvent({
      repository,
      eventId: getId(event),
      user: invitedUser,
      targetTeamId: getId(team),
      excludeInvitationId,
      session
    })

    if (!invitedUser.githubUsername && githubUsername) {
      invitedUser = await repository.updateUserById(invitedUser._id, { githubUsername }, { session })
    }
  } else {
    const blockingInvitation = await repository.findBlockingInvitation({
      eventId: getId(event),
      email,
      excludeInvitationId
    }, { session })
    if (blockingInvitation) {
      throw new ApiError(ERROR_CODES.CONFLICT, ['User already has an active invitation for this event'])
    }
  }

  const token = createInvitationToken()
  const invitation = await repository.createInvitation({
    eventId: getId(event),
    teamId: getId(team),
    leaderId: getId(leader),
    invitedEmail: email,
    invitedUserId: getId(invitedUser) || undefined,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(Date.now() + env.teamInvitation.expiresHours * 60 * 60 * 1000),
    status: INVITATION_STATUSES.PENDING,
    metadata: {
      invitedFullName: fullName || undefined,
      invitedGithubUsername: githubUsername || undefined
    }
  }, { session })

  jobs.push({
    kind: 'email',
    payload: buildInvitationEmailContext({
      event,
      team,
      leader,
      token,
      invitedUser,
      fullName,
      email,
      logger
    })
  })

  return invitation
}

const getInvitationMetadata = (invitation = {}) => {
  return invitation.metadata && typeof invitation.metadata === 'object'
    ? invitation.metadata
    : {}
}

const resolveInvitationUser = async ({
  repository,
  event,
  team,
  invitation,
  session
}) => {
  const invitedEmail = normalizeEmailAddress(invitation.invitedEmail)
  const metadata = getInvitationMetadata(invitation)
  const invitedFullName = metadata.invitedFullName || buildFullNameFromEmail(invitedEmail)
  const invitedGithubUsername = metadata.invitedGithubUsername

  let invitedUser = null
  let accountCreated = false
  let temporaryPassword = null

  if (invitation.invitedUserId) {
    invitedUser = await repository.findUserById(invitation.invitedUserId, { session })
    if (!invitedUser) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Invitation target not found'])
  } else {
    invitedUser = await repository.findUserByEmail(invitedEmail, { session })

    if (invitedUser && !invitedUser.githubUsername && invitedGithubUsername) {
      invitedUser = await repository.updateUserById(invitedUser._id, {
        githubUsername: invitedGithubUsername
      }, { session })
    }

    if (!invitedUser) {
      const participantRole = await repository.findRoleByName(PARTICIPANT_ROLE_NAME, { session })
      temporaryPassword = env.teamInvitation.temporaryPassword
      invitedUser = await repository.createUser({
        email: invitedEmail,
        fullName: invitedFullName,
        githubUsername: invitedGithubUsername,
        passwordHash: await BCRYPT_UTILS.hashPassword(temporaryPassword),
        authProvider: 'LOCAL',
        registrationSource: REGISTRATION_SOURCES.FORM,
        status: 'APPROVED',
        mustChangePassword: true,
        roles: participantRole ? [participantRole._id] : []
      }, { session })
      accountCreated = true
    }
  }

  if (isSameId(team.leaderId, invitedUser)) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Team member must not be the team leader'])
  }

  await ensureParticipantCanJoinEvent({
    repository,
    eventId: getId(event),
    user: invitedUser,
    targetTeamId: getId(team),
    excludeInvitationId: getId(invitation),
    session
  })

  return {
    invitedUser,
    accountCreated,
    temporaryPassword
  }
}

const rejectOpenTeams = async ({ repository, event, reason, excludeTeamId = null, session, jobs }) => {
  const filter = {
    eventId: getId(event),
    status: { $in: OPEN_TEAM_STATUSES }
  }

  if (excludeTeamId) {
    filter._id = { $ne: excludeTeamId }
  }

  const teams = await repository.findTeams({ filter, limit: 1000, session })
  const now = new Date()

  for (const team of teams) {
    const rejectedTeam = await repository.updateTeamById(getId(team), {
      status: TEAM_STATUSES.REJECTED,
      rejectedAt: now,
      rejectionReason: reason
    }, { session })

    await repository.updateInvitations({
      teamId: getId(team),
      status: INVITATION_STATUSES.PENDING
    }, {
      status: INVITATION_STATUSES.CANCELLED,
      cancelledAt: now
    }, { session })

    const participants = await repository.findParticipantsByTeam(getId(team), { session })
    const recipientById = new Map()
    for (const user of [rejectedTeam.leaderId, ...participants.map(participant => participant.userId)].filter(Boolean)) {
      recipientById.set(getId(user), user)
    }

    for (const user of recipientById.values()) {
      jobs.push({
        kind: 'notification',
        payload: {
          user,
          type: 'SYSTEM',
          title: 'Team registration rejected',
          message: buildTeamRejectedMessage(rejectedTeam, reason),
          emailTemplate: EMAIL_TEMPLATE_KEYS.TEAM_REJECTED,
          emailContext: {
            eventTitle: event.title,
            teamName: rejectedTeam.name,
            rejectionReason: reason
          },
          metadata: {
            eventId: getId(event),
            teamId: getId(rejectedTeam),
            reason
          }
        }
      })
    }
  }

  return teams.length
}

const loadTeamDetail = async ({ repository, team, session }) => {
  if (!team) return null

  const [participants, invitations] = await Promise.all([
    repository.findParticipantsByTeam(getId(team), { session }),
    repository.findInvitationsByTeam(getId(team), { session })
  ])

  return normalizeTeam({ team, participants, invitations })
}

export const createTeamService = ({
  repository = TEAM_REPOSITORY,
  emailService = EMAIL_SERVICE,
  notificationService = NOTIFICATION_SERVICE,
  logger = LOGGER
} = {}) => {
  const listTeams = async (query = {}, actor = {}) => {
    if (!hasTeamManagementPermission(actor) && !actorHasPermission(actor, PERMISSIONS.TEAM_VIEW) && !hasMentorScopedRole(actor)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['You do not have permission to list all teams'])
    }

    const { page, limit } = normalizePaginationQuery(query)
    const filter = {}
    if (query.eventId) {
      ensureObjectId(query.eventId, 'event id')
      filter.eventId = query.eventId
    }
    if (query.trackId) {
      ensureObjectId(query.trackId, 'track id')
      filter.trackId = query.trackId
    }
    if (query.boardNumber) {
      filter.boardNumber = Number(query.boardNumber)
    }
    if (query.status) filter.status = query.status
    if (!hasCoordinatorRole(actor)) {
      if (!actor.id) {
        throw new ApiError(ERROR_CODES.FORBIDDEN, ['Mentor account is missing actor context'])
      }
      filter.mentorIds = actor.id
    }

    const skip = (page - 1) * limit
    const [teams, totalItems] = await Promise.all([
      repository.findTeams({ filter, skip, limit }),
      repository.countTeams(filter)
    ])

    const details = []
    for (const team of teams) {
      details.push(await loadTeamDetail({ repository, team }))
    }

    return {
      teams: details,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        pageSize: limit,
        totalItems
      }
    }
  }

  const getTeamById = async (id, actor = {}) => {
    ensureObjectId(id, 'team id')
    const team = await repository.findTeamById(id)
    if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

    ensureTeamReadable(team, actor)
    return await loadTeamDetail({ repository, team })
  }

  const getMyTeamByEvent = async (eventId, actor = {}) => {
    ensureObjectId(eventId, 'event id')
    const team = await repository.findTeamForUserInEvent({ eventId, userId: actor.id })
    if (!team) return null

    return await loadTeamDetail({ repository, team })
  }

  const rejectUnconfirmedTeamsForRegistrationClosure = async ({
    event,
    eventId,
    reason = TEAM_REJECTION_REASONS.REGISTRATION_CLOSED
  } = {}) => {
    const jobs = []
    const result = await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const targetEvent = event || await repository.findEventById(eventId, { session })
        if (!targetEvent) {
          throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
        }

        const rejectedCount = await rejectOpenTeams({
          repository,
          event: targetEvent,
          reason,
          session,
          jobs
        })

        return {
          eventId: getId(targetEvent),
          rejectedCount
        }
      }
    })

    await sendJobs({ jobs, emailService, notificationService, logger })
    return result
  }

  const checkTeamAvailability = async (query = {}, actor = {}) => {
    ensureObjectId(query.eventId, 'event id')
    if (!actor.id) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, ['User context is required to validate team availability'])
    }

    const name = String(query.name || '').trim()
    const [event, existingTeam, existingLeaderTeam] = await Promise.all([
      repository.findEventById(query.eventId),
      repository.findTeamByEventAndName({ eventId: query.eventId, name }),
      repository.findTeamByLeaderAndEvent({ eventId: query.eventId, leaderId: actor.id })
    ])

    if (!event) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])
    }

    const errors = []
    if (existingTeam) errors.push('Team name already exists in this event')
    if (existingLeaderTeam) errors.push('You already created a team for this event')

    return {
      eventId: getId(event),
      name,
      normalizedName: normalizeTeamName(name),
      available: errors.length === 0,
      nameAvailable: !existingTeam,
      leaderAvailable: !existingLeaderTeam,
      errors
    }
  }

  const createTeam = async (payload = {}, actor = {}) => {
    const jobs = []
    let result

    try {
      result = await runWithOptionalTransaction({
        repository,
        logger,
        work: async (session) => {
          const { event } = await loadEventForRegistration({
            repository,
            eventId: payload.eventId,
            session
          })
          ensureEventOpen(event)
          await ensureConfirmedSlotsNotFull({ event, repository, session })
          await ensureTrackBelongsToEvent({
            repository,
            eventId: getId(event),
            trackId: payload.trackId,
            session
          })

          const leader = await repository.findUserById(actor.id, { session })
          if (!leader || !['APPROVED', 'ACTIVE'].includes(leader.status)) {
            throw new ApiError(ERROR_CODES.FORBIDDEN, ['Only active users can create teams'])
          }

          const existingTeam = await repository.findTeamByLeaderAndEvent({
            eventId: getId(event),
            leaderId: getId(leader)
          }, { session })
          if (existingTeam) {
            throw new ApiError(ERROR_CODES.CONFLICT, ['You already created a team for this event'])
          }

          await ensureUniqueTeamName({
            repository,
            eventId: getId(event),
            name: payload.name,
            session
          })

          await ensureParticipantCanJoinEvent({
            repository,
            eventId: getId(event),
            user: leader,
            session
          })

          const invitedMembers = normalizeInvitationMembers({
            members: payload.invitedMembers,
            emails: payload.invitedEmails
          })
          if (invitedMembers.length > Math.max((event.maxTeamMembers || 5) - 1, 0)) {
            throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Too many invited members for this event'])
          }
          ensureMembersDoNotContainLeader(invitedMembers, leader)

          const team = await repository.createTeam({
            eventId: getId(event),
            trackId: payload.trackId || undefined,
            leaderId: getId(leader),
            memberIds: [getId(leader)],
            name: payload.name,
            chapterName: payload.chapterName,
            projectName: payload.projectName,
            trackAssignmentMethod: payload.trackId ? 'MANUAL' : 'SYSTEM',
            status: TEAM_STATUSES.WAITING_FOR_MEMBERS
          }, { session })

          await repository.upsertParticipant({
            eventId: getId(event),
            userId: getId(leader),
            data: {
              teamId: getId(team),
              teamRole: 'LEADER',
              status: 'ACTIVE',
              joinedAt: new Date()
            }
          }, { session })

          for (const member of invitedMembers) {
            await createInvitationForEmail({
              repository,
              event,
              team,
              leader,
              email: member.email,
              fullName: member.fullName,
              githubUsername: member.githubUsername,
              session,
              jobs
            })
          }

          if ((event.minTeamMembers || 1) <= 1) {
            const confirmedTeam = await repository.updateTeamById(getId(team), {
              status: TEAM_STATUSES.CONFIRMED,
              confirmedAt: new Date()
            }, { session })

            await assignTeamPlacement({
              repository,
              event,
              team: confirmedTeam,
              preferredTrackId: payload.trackId,
              trackAssignmentMethod: payload.trackId ? 'MANUAL' : 'SYSTEM',
              session,
              allowWaitlist: true
            })

            await syncEventRegistrationStatus({
              repository,
              event,
              session,
              confirmedCount: await repository.countTeams({
                eventId: getId(event),
                status: { $in: CONFIRMED_TEAM_STATUSES }
              }, { session })
            })

            // TODO Phase 5: trigger repository provisioning hook after the team has a confirmed placement.
          }

          const createdTeam = await repository.findTeamById(getId(team), { session })
          return await loadTeamDetail({ repository, team: createdTeam, session })
        }
      })
    } catch (error) {
      throw mapDuplicateTeamError(error)
    }

    await sendJobs({ jobs, emailService, notificationService, logger })
    return result
  }

  const inviteMembers = async (teamId, payload = {}, actor = {}) => {
    const jobs = []
    const result = await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const team = await repository.findTeamById(teamId, { session })
        if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])
        ensureTeamLeader(team, actor)
        ensureTeamIsNotRejected(team)

        const { event } = await loadEventForRegistration({
          repository,
          eventId: getId(team.eventId),
          session
        })
        ensureEventOpen(event)
        await ensureConfirmedSlotsNotFull({ event, repository, session })

        const leader = await repository.findUserById(actor.id, { session })
        const currentMemberCount = (team.memberIds || []).length
        const pendingInvitations = (await repository.findInvitationsByTeam(teamId, { session }))
          .filter(invitation => invitation.status === INVITATION_STATUSES.PENDING)
        const invitedMembers = normalizeInvitationMembers({
          members: payload.members,
          emails: payload.emails
        })
        ensureMembersDoNotContainLeader(invitedMembers, leader)

        if (currentMemberCount + pendingInvitations.length + invitedMembers.length > (event.maxTeamMembers || 5)) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Too many team members for this event'])
        }

        const invitations = []
        for (const member of invitedMembers) {
          invitations.push(await createInvitationForEmail({
            repository,
            event,
            team,
            leader,
            email: member.email,
            fullName: member.fullName,
            githubUsername: member.githubUsername,
            session,
            jobs
          }))
        }

        return {
          total: invitations.length,
          invitations: invitations.map(normalizeInvitation)
        }
      }
    })

    await sendJobs({ jobs, emailService, notificationService, logger })
    return result
  }

  const acceptInvitation = async (token) => {
    const jobs = []
    const result = await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const invitation = await repository.findInvitationByTokenHash(hashInvitationToken(token), { session })
        if (!invitation) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Invitation not found'])

        const team = await repository.findTeamById(invitation.teamId, { session })
        if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

        const { event } = await loadEventForRegistration({
          repository,
          eventId: invitation.eventId,
          session
        })
        ensureEventOpen(event)

        if (invitation.status === INVITATION_STATUSES.ACCEPTED) {
          return {
            status: INVITATION_STATUSES.ACCEPTED,
            team: await loadTeamDetail({ repository, team, session }),
            invitation: normalizeInvitation(invitation)
          }
        }

        if (invitation.status === INVITATION_STATUSES.DECLINED) {
          return {
            status: INVITATION_STATUSES.DECLINED,
            team: normalizeTeam({ team }),
            invitation: normalizeInvitation(invitation)
          }
        }

        if (invitation.status === INVITATION_STATUSES.CANCELLED) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Invitation was cancelled'])
        }

        if (new Date(invitation.expiresAt) < new Date()) {
          const expiredInvitation = await repository.updateInvitationById(getId(invitation), {
            status: INVITATION_STATUSES.EXPIRED
          }, { session })

          return {
            status: INVITATION_STATUSES.EXPIRED,
            team: normalizeTeam({ team }),
            invitation: normalizeInvitation(expiredInvitation)
          }
        }

        if (team.status === TEAM_STATUSES.REJECTED) {
          await repository.updateInvitationById(getId(invitation), {
            status: INVITATION_STATUSES.CANCELLED,
            cancelledAt: new Date()
          }, { session })

          return {
            status: TEAM_STATUSES.REJECTED,
            team: normalizeTeam({ team }),
            invitation: normalizeInvitation(invitation)
          }
        }

        const confirmedCount = await repository.countTeams({
          eventId: getId(event),
          status: { $in: CONFIRMED_TEAM_STATUSES }
        }, { session })

        if (!CONFIRMED_TEAM_STATUSES.includes(team.status) && confirmedCount >= getMaxTeams(event)) {
          const rejectedTeam = await repository.updateTeamById(getId(team), {
            status: TEAM_STATUSES.REJECTED,
            rejectedAt: new Date(),
            rejectionReason: TEAM_REJECTION_REASONS.CAPACITY_REACHED
          }, { session })

          await repository.updateInvitationById(getId(invitation), {
            status: INVITATION_STATUSES.CANCELLED,
            cancelledAt: new Date()
          }, { session })
          await rejectOpenTeams({
            repository,
            event,
            reason: TEAM_REJECTION_REASONS.CAPACITY_REACHED,
            excludeTeamId: getId(team),
            session,
            jobs
          })

          return {
            status: TEAM_STATUSES.REJECTED,
            team: normalizeTeam({ team: rejectedTeam }),
            invitation: normalizeInvitation(invitation)
          }
        }

        const {
          invitedUser,
          accountCreated,
          temporaryPassword
        } = await resolveInvitationUser({
          repository,
          event,
          team,
          invitation,
          session
        })

        await repository.upsertParticipant({
          eventId: getId(event),
          userId: getId(invitedUser),
          data: {
            teamId: getId(team),
            teamRole: 'MEMBER',
            status: 'ACTIVE',
            joinedAt: new Date()
          }
        }, { session })

        if (invitedUser.githubUsername) {
          try {
            const teamRepo = await mongoose.model('Repository').findOne({
              eventId: getId(event),
              teamId: getId(team),
              status: 'ACTIVE'
            }).session(session)

            if (teamRepo) {
              jobs.push({
                kind: 'github_assign',
                payload: {
                  eventId: getId(event),
                  repoName: teamRepo.repoName || teamRepo.githubRepo,
                  githubUsername: invitedUser.githubUsername,
                  actor: { id: getId(team.leaderId) }
                }
              })
            }
          } catch (repoError) {
            logger.warn('Failed to check existing repository for auto collaborator assignment', {
              teamId: getId(team),
              error: repoError.message
            })
          }
        }

        let updatedTeam = await repository.updateTeamById(getId(team), {
          $addToSet: { memberIds: getId(invitedUser) }
        }, { session })

        const acceptedInvitation = await repository.updateInvitationById(getId(invitation), {
          status: INVITATION_STATUSES.ACCEPTED,
          acceptedAt: new Date(),
          invitedUserId: getId(invitedUser)
        }, { session })

        const memberCount = (updatedTeam.memberIds || []).length
        if (!CONFIRMED_TEAM_STATUSES.includes(updatedTeam.status) && memberCount >= (event.minTeamMembers || 1)) {
          const confirmedCountBeforeUpdate = await repository.countTeams({
            eventId: getId(event),
            status: { $in: CONFIRMED_TEAM_STATUSES }
          }, { session })

          if (confirmedCountBeforeUpdate >= getMaxTeams(event)) {
            updatedTeam = await repository.updateTeamById(getId(updatedTeam), {
              status: TEAM_STATUSES.REJECTED,
              rejectedAt: new Date(),
              rejectionReason: TEAM_REJECTION_REASONS.CAPACITY_REACHED
            }, { session })
          } else {
            updatedTeam = await repository.updateTeamById(getId(updatedTeam), {
              status: TEAM_STATUSES.CONFIRMED,
              confirmedAt: new Date()
            }, { session })

            updatedTeam = await assignTeamPlacement({
              repository,
              event,
              team: updatedTeam,
              preferredTrackId: getId(updatedTeam.trackId),
              trackAssignmentMethod: getId(updatedTeam.trackId) ? 'MANUAL' : 'SYSTEM',
              session,
              allowWaitlist: true
            })

            // TODO Phase 5: trigger repository provisioning hook after the team has a confirmed placement.

            if (CONFIRMED_TEAM_STATUSES.includes(updatedTeam.status) && confirmedCountBeforeUpdate + 1 >= getMaxTeams(event)) {
              await rejectOpenTeams({
                repository,
                event,
                reason: TEAM_REJECTION_REASONS.CAPACITY_REACHED,
                excludeTeamId: getId(updatedTeam),
                session,
                jobs
              })
            }

            await syncEventRegistrationStatus({
              repository,
              event,
              session,
              confirmedCount: confirmedCountBeforeUpdate + 1
            })
          }
        }

        if (accountCreated) {
          jobs.push({
            kind: 'email',
            payload: {
              to: invitedUser.email,
              template: EMAIL_TEMPLATE_KEYS.TEMPORARY_ACCOUNT,
              context: {
                fullName: invitedUser.fullName,
                email: invitedUser.email,
                temporaryPassword,
                loginUrl: buildLoginUrl(logger)
              },
              metadata: {
                eventId: getId(event),
                teamId: getId(updatedTeam),
                invitedUserId: getId(invitedUser),
                invitationId: getId(acceptedInvitation)
              }
            }
          })
        }

        jobs.push({
          kind: 'notification',
          payload: {
            user: invitedUser,
            type: 'SYSTEM',
            title: 'Team membership confirmed',
            message: `You joined ${updatedTeam.name}.`,
            emailTemplate: EMAIL_TEMPLATE_KEYS.TEAM_CONFIRMATION_SUCCESS,
            emailContext: {
              eventTitle: event.title,
              teamName: updatedTeam.name
            },
            metadata: {
              eventId: getId(event),
              teamId: getId(updatedTeam),
              invitationId: getId(acceptedInvitation)
            },
            channels: accountCreated ? ['IN_APP'] : undefined
          }
        })

        return {
          status: acceptedInvitation.status,
          team: await loadTeamDetail({ repository, team: updatedTeam, session }),
          invitation: normalizeInvitation(acceptedInvitation)
        }
      }
    })

    await sendJobs({ jobs, emailService, notificationService, logger })
    return result
  }

  const declineInvitation = async (token) => {
    const jobs = []
    const result = await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const invitation = await repository.findInvitationByTokenHash(hashInvitationToken(token), { session })
        if (!invitation) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Invitation not found'])

        const team = await repository.findTeamById(invitation.teamId, { session })
        const event = await repository.findEventById(invitation.eventId, { session })
        const leader = await repository.findUserById(invitation.leaderId, { session })

        if (invitation.status === INVITATION_STATUSES.DECLINED) {
          return {
            status: INVITATION_STATUSES.DECLINED,
            team: normalizeTeam({ team }),
            invitation: normalizeInvitation(invitation)
          }
        }

        if (invitation.status === INVITATION_STATUSES.ACCEPTED) {
          throw new ApiError(ERROR_CODES.CONFLICT, ['Accepted invitation cannot be declined'])
        }

        if (new Date(invitation.expiresAt) < new Date()) {
          const expiredInvitation = await repository.updateInvitationById(getId(invitation), {
            status: INVITATION_STATUSES.EXPIRED
          }, { session })

          return {
            status: INVITATION_STATUSES.EXPIRED,
            team: normalizeTeam({ team }),
            invitation: normalizeInvitation(expiredInvitation)
          }
        }

        const declinedInvitation = await repository.updateInvitationById(getId(invitation), {
          status: INVITATION_STATUSES.DECLINED,
          declinedAt: new Date()
        }, { session })

        if (leader) {
          jobs.push({
            kind: 'notification',
            payload: {
              user: leader,
              type: 'SYSTEM',
              title: 'Team invitation declined',
              message: `${invitation.invitedEmail} declined the invitation to join ${team?.name || 'your team'}.`,
              emailTemplate: EMAIL_TEMPLATE_KEYS.TEAM_MEMBER_DECLINED,
              emailContext: {
                eventTitle: event?.title,
                teamName: team?.name,
                declinedEmail: invitation.invitedEmail
              },
              metadata: {
                eventId: getId(event),
                teamId: getId(team),
                invitationId: getId(declinedInvitation)
              }
            }
          })
        }

        return {
          status: declinedInvitation.status,
          team: normalizeTeam({ team }),
          invitation: normalizeInvitation(declinedInvitation)
        }
      }
    })

    await sendJobs({ jobs, emailService, notificationService, logger })
    return result
  }

  const replaceInvitation = async ({ teamId, invitationId, email }, actor = {}) => {
    const jobs = []
    const result = await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const team = await repository.findTeamById(teamId, { session })
        if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])
        ensureTeamLeader(team, actor)
        ensureTeamIsNotRejected(team)

        const invitation = await repository.findInvitationById(invitationId, { session })
        if (!invitation || !isSameId(invitation.teamId, teamId)) {
          throw new ApiError(ERROR_CODES.NOT_FOUND, ['Invitation not found'])
        }

        if (invitation.status !== INVITATION_STATUSES.DECLINED) {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only declined invitations can be replaced'])
        }

        const { event } = await loadEventForRegistration({
          repository,
          eventId: getId(team.eventId),
          session
        })
        ensureEventOpen(event)
        await ensureConfirmedSlotsNotFull({ event, repository, session })

        const leader = await repository.findUserById(actor.id, { session })
        const [replacement] = await Promise.all([
          createInvitationForEmail({
            repository,
            event,
            team,
            leader,
            email: String(email).trim().toLowerCase(),
            session,
            jobs,
            excludeInvitationId: invitationId
          })
        ])

        await repository.updateInvitationById(invitationId, {
          replacedByInvitationId: getId(replacement)
        }, { session })

        return normalizeInvitation(replacement)
      }
    })

    await sendJobs({ jobs, emailService, notificationService, logger })
    return result
  }

  const cancelInvitation = async ({ teamId, invitationId }, actor = {}) => {
    const team = await repository.findTeamById(teamId)
    if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])
    ensureTeamLeader(team, actor)
    ensureTeamIsNotRejected(team)

    const invitation = await repository.findInvitationById(invitationId)
    if (!invitation || !isSameId(invitation.teamId, teamId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, ['Invitation not found'])
    }

    if (invitation.status !== INVITATION_STATUSES.PENDING) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Only pending invitations can be cancelled'])
    }

    const updatedInvitation = await repository.updateInvitationById(invitationId, {
      status: INVITATION_STATUSES.CANCELLED,
      cancelledAt: new Date()
    })

    return normalizeInvitation(updatedInvitation)
  }

  const updateTeamStatus = async (teamId, payload = {}, actor = {}) => {
    ensureTeamManagementPermission(actor)

    return await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const team = await repository.findTeamById(teamId, { session })
        if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

        const event = await repository.findEventById(getId(team.eventId), { session })
        if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])

        let updatedTeam = team
        const nextStatus = payload.status

        if (nextStatus === TEAM_STATUSES.CONFIRMED) {
          if (!CONFIRMED_TEAM_STATUSES.includes(team.status)) {
            await ensureConfirmedSlotsNotFull({ event, repository, session })
          }

          ensureTeamSizeWithinEventRules(team, event)

          updatedTeam = await repository.updateTeamById(getId(team), {
            status: TEAM_STATUSES.CONFIRMED,
            confirmedAt: new Date(),
            rejectedAt: null,
            rejectionReason: null
          }, { session })

          updatedTeam = await assignTeamPlacement({
            repository,
            event,
            team: updatedTeam,
            preferredTrackId: payload.trackId || getId(updatedTeam.trackId),
            trackAssignmentMethod: payload.trackId || getId(updatedTeam.trackId) ? 'MANUAL' : 'SYSTEM',
            session,
            allowWaitlist: true
          })

          const confirmedCount = await repository.countTeams({
            eventId: getId(event),
            status: { $in: CONFIRMED_TEAM_STATUSES }
          }, { session })
          await syncEventRegistrationStatus({
            repository,
            event,
            session,
            confirmedCount
          })

          // TODO Phase 5: trigger repository provisioning hook after the team has a confirmed placement.
        } else if (nextStatus === TEAM_STATUSES.REJECTED) {
          updatedTeam = await repository.updateTeamById(getId(team), {
            status: TEAM_STATUSES.REJECTED,
            rejectedAt: new Date(),
            rejectionReason: payload.rejectionReason || 'Rejected by coordinator'
          }, { session })
        } else {
          updatedTeam = await repository.updateTeamById(getId(team), {
            status: nextStatus
          }, { session })
        }

        return await loadTeamDetail({ repository, team: updatedTeam, session })
      }
    })
  }

  const updateTeamPlacement = async (teamId, payload = {}, actor = {}) => {
    ensureTeamManagementPermission(actor)

    return await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const team = await repository.findTeamById(teamId, { session })
        if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

        const event = await repository.findEventById(getId(team.eventId), { session })
        if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])

        if (payload.trackId) {
          await ensureTrackBelongsToEvent({
            repository,
            eventId: getId(event),
            trackId: payload.trackId,
            session
          })
        }

        const updatedTeam = await assignTeamPlacement({
          repository,
          event,
          team,
          preferredTrackId: payload.trackId,
          trackAssignmentMethod: payload.trackAssignmentMethod || (payload.trackId ? 'MANUAL' : 'SYSTEM'),
          session,
          allowWaitlist: false
        })

        return await loadTeamDetail({ repository, team: updatedTeam, session })
      }
    })
  }

  const updateTeamMentors = async (teamId, payload = {}, actor = {}) => {
    ensureTeamManagementPermission(actor)
    ensureObjectId(teamId, 'team id')

    return await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const team = await repository.findTeamById(teamId, { session })
        if (!team) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Team not found'])

        const previousMentorIds = uniqueIds(team.mentorIds || [])
        const { mentorIds } = await validateMentorAssignments({
          repository,
          mentorIds: payload.mentorIds || [],
          session
        })

        const updatedTeam = await repository.updateTeamById(getId(team), {
          mentorIds
        }, { session })

        const diff = buildMentorDiff({
          previousMentorIds,
          nextMentorIds: updatedTeam.mentorIds || []
        })

        return {
          team: await loadTeamDetail({ repository, team: updatedTeam, session }),
          audit: diff
        }
      }
    })
  }

  const assignMentorsByBoard = async (payload = {}, actor = {}) => {
    ensureTeamManagementPermission(actor)
    ensureObjectId(payload.eventId, 'event id')

    return await runWithOptionalTransaction({
      repository,
      logger,
      work: async (session) => {
        const event = await repository.findEventById(payload.eventId, { session })
        if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])

        const { mentorIds } = await validateMentorAssignments({
          repository,
          mentorIds: payload.mentorIds || [],
          session
        })

        const teams = await repository.findTeams({
          filter: {
            eventId: payload.eventId,
            boardNumber: Number(payload.boardNumber)
          },
          limit: 1000,
          sort: { boardNumber: 1, placementSlot: 1, createdAt: 1 },
          session
        })

        if (teams.length === 0) {
          throw new ApiError(ERROR_CODES.NOT_FOUND, [`No teams found for board ${payload.boardNumber}`])
        }

        const updatedTeams = []
        const teamDiffs = []

        for (const team of teams) {
          const previousMentorIds = uniqueIds(team.mentorIds || [])
          const updatedTeam = await repository.updateTeamById(getId(team), { mentorIds }, { session })
          const diff = buildMentorDiff({
            previousMentorIds,
            nextMentorIds: updatedTeam.mentorIds || []
          })

          teamDiffs.push({
            teamId: getId(updatedTeam),
            teamName: updatedTeam.name,
            ...diff
          })
          updatedTeams.push(await loadTeamDetail({ repository, team: updatedTeam, session }))
        }

        return {
          eventId: getId(event),
          boardNumber: Number(payload.boardNumber),
          mentorIds,
          updatedCount: updatedTeams.length,
          teamIds: updatedTeams.map(team => team.id),
          teams: updatedTeams,
          audit: {
            teamDiffs
          }
        }
      }
    })
  }

  const getEventTeamCapacity = async (eventId, actor = {}) => {
    ensureTeamManagementPermission(actor)
    ensureObjectId(eventId, 'event id')

    const event = await repository.findEventById(eventId)
    if (!event) throw new ApiError(ERROR_CODES.NOT_FOUND, ['Event not found'])

    return await buildCapacitySummary({ repository, event })
  }

  return {
    listTeams,
    getTeamById,
    getMyTeamByEvent,
    rejectUnconfirmedTeamsForRegistrationClosure,
    checkTeamAvailability,
    createTeam,
    inviteMembers,
    acceptInvitation,
    declineInvitation,
    replaceInvitation,
    cancelInvitation,
    updateTeamStatus,
    updateTeamPlacement,
    updateTeamMentors,
    assignMentorsByBoard,
    getEventTeamCapacity,
    normalizeTeam
  }
}

export const TEAM_SERVICE = createTeamService()
