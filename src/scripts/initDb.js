import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { env } from '#configs/environment.js'
import { ALL_PERMISSIONS, ROLE_PERMISSION_MAP } from '#constants/permissions.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { migrateUsersOffRemovedUserRole } from '#utils/removeUserRoleMigration.js'

import User from '#models/user.model.js'
import Role from '#models/role.model.js'
import Permission from '#models/permission.model.js'
import Event from '#models/event.model.js'
import TimelineEvent from '#models/timelineEvent.model.js'
import Workshop from '#models/workshop.model.js'
import WorkshopQuestion from '#models/workshopQuestion.model.js'
import WorkshopFeedback from '#models/workshopFeedback.model.js'
import WorkshopRating from '#models/workshopRating.model.js'
import Track from '#models/track.model.js'
import Round from '#models/round.model.js'
import JudgingBoard from '#models/judgingBoard.model.js'
import Participant from '#models/participant.model.js'
import Team from '#models/team.model.js'
import TeamInvitation from '#models/teamInvitation.model.js'
import Repository from '#models/repository.model.js'
import Commit from '#models/commit.model.js'
import CommitDiff from '#models/commitDiff.model.js'
import GitHubWebhookEvent from '#models/githubWebhookEvent.model.js'
import Submission from '#models/submission.model.js'
import Rubric from '#models/rubric.model.js'
import Criterion from '#models/criterion.model.js'
import Score from '#models/score.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'
import Ranking from '#models/ranking.model.js'
import Prize from '#models/prize.model.js'
import AiReview from '#models/aiReview.model.js'
import AiReviewCriterion from '#models/aiReviewCriterion.model.js'
import TechnicalFinding from '#models/technicalFinding.model.js'
import StaticAnalysisResult from '#models/staticAnalysisResult.model.js'
import ImpactDecision from '#models/impactDecision.model.js'
import ChangedCodeContext from '#models/changedCodeContext.model.js'
import Notification from '#models/notification.model.js'
import Media from '#models/media.model.js'
import MediaActivity from '#models/mediaActivity.model.js'
import AuditLog from '#models/auditLog.model.js'
import SystemConfiguration from '#models/systemConfiguration.model.js'

const MODELS = [
  User,
  Role,
  Permission,
  Event,
  TimelineEvent,
  Workshop,
  WorkshopQuestion,
  WorkshopFeedback,
  WorkshopRating,
  Track,
  Round,
  JudgingBoard,
  Participant,
  Team,
  TeamInvitation,
  Repository,
  Commit,
  CommitDiff,
  GitHubWebhookEvent,
  Submission,
  Rubric,
  Criterion,
  ScoreSheet,
  Score,
  Ranking,
  Prize,
  AiReview,
  AiReviewCriterion,
  TechnicalFinding,
  StaticAnalysisResult,
  ImpactDecision,
  ChangedCodeContext,
  Notification,
  Media,
  MediaActivity,
  AuditLog,
  SystemConfiguration
]

const connect = async () => {
  if (!env.db?.uri) {
    throw new Error('MONGODB_URI is not set')
  }
  await mongoose.connect(env.db.uri)
}

const initIndexes = async () => {
  for (const model of MODELS) {
    await model.syncIndexes()
  }
}

const upsertOne = async (Model, filter, data) => {
  return await Model.findOneAndUpdate(
    filter,
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  )
}

const buildDate = (value) => new Date(value)
const addTime = (date, { days = 0, hours = 0, minutes = 0 } = {}) => {
  return new Date(date.getTime() + (((days * 24) + hours) * 60 + minutes) * 60 * 1000)
}

const toQualitativeLevel = (score, totalScore) => {
  const ratio = totalScore > 0 ? Number(score || 0) / Number(totalScore) : 0
  if (ratio >= 0.9) return 'EXCELLENT'
  if (ratio >= 0.75) return 'GOOD'
  if (ratio >= 0.6) return 'FAIR'
  if (ratio >= 0.45) return 'AVERAGE'
  return 'WEAK'
}

const FALL_2025_SAMPLE_CONFIG = {
  boardCount: 2,
  trackCount: 2,
  maxTeamsPerBoard: 20,
  finalistCount: 10,
  finalistsPerBoard: 5,
  finalistSelectionMode: 'FIXED_PER_BOARD',
  fillRemainingFinalistsByOverallScore: false,
  rankingScopes: ['TEAM', 'CHAPTER', 'INDIVIDUAL'],
  tieBreakRule: 'Judges resolve ties using rubric-level discussion and final deliberation.'
}

const FALL_2025_TRACK_SEEDS = [
  {
    code: 'A',
    name: 'Bang A',
    description: 'AI for Requirements and Design',
    type: 'PRELIMINARY_GROUP',
    maxTeams: FALL_2025_SAMPLE_CONFIG.maxTeamsPerBoard
  },
  {
    code: 'B',
    name: 'Bang B',
    description: 'AI for Development, Testing, and Operations',
    type: 'PRELIMINARY_GROUP',
    maxTeams: FALL_2025_SAMPLE_CONFIG.maxTeamsPerBoard
  }
]

const buildPermissionDescription = (code) => {
  return code
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (char) => char.toUpperCase())
}

const buildPermissionModule = (code) => {
  const parts = code.split('_')
  if (parts.length >= 2) return parts[0]
  return 'GENERAL'
}

const buildPermissionName = (code) => {
  return buildPermissionDescription(code)
}

const ROLE_SEEDS = [
  ['ADMIN', 'System administrator'],
  ['COORDINATOR', 'Event coordinator'],
  ['EVENT_COORDINATOR', 'Event coordinator'],
  ['JUDGE', 'Judge role'],
  ['MENTOR', 'Mentor role'],
  ['SPEAKER', 'Workshop speaker role'],
  ['PARTICIPANT', 'Hackathon participant']
]

const SEED_EMAIL_DOMAIN = 'seal-hackathon.example.com'

const buildSeedEmail = (localPart) => `${localPart}@${SEED_EMAIL_DOMAIN}`

const seedPermissions = async () => {
  const permissionRecords = await Promise.all(ALL_PERMISSIONS.map((code) => {
    return upsertOne(Permission, { code }, {
      code,
      name: buildPermissionName(code),
      description: buildPermissionDescription(code),
      module: buildPermissionModule(code),
      isActive: true
    })
  }))

  return new Map(permissionRecords.map((permission) => [permission.code, permission]))
}

const seedRoles = async (permissionByCode) => {
  const allPermissionIds = [...permissionByCode.values()].map(p => p._id)

  const roleRecords = await Promise.all(ROLE_SEEDS.map(([name, description]) => {
    let permissionIds

    if (name === 'ADMIN') {
      permissionIds = allPermissionIds
    } else {
      permissionIds = (ROLE_PERMISSION_MAP[name] || []).map((code) => {
        const permission = permissionByCode.get(code)
        if (!permission) {
          throw new Error(`Missing permission seed for ${code}`)
        }
        return permission._id
      })
    }

    return upsertOne(Role, { name }, {
      name,
      code: name,
      description,
      permissions: permissionIds,
      isSystemRole: true,
      isActive: true
    })
  }))

  return new Map(roleRecords.map((role) => [role.name, role]))
}

const seedUser = async ({ email, legacyEmail, fullName, roleIds, passwordHash, status = 'ACTIVE', extra = {} }) => {
  const filter = legacyEmail ? { $or: [{ email }, { email: legacyEmail }] } : { email }

  return await upsertOne(User, filter, {
    email,
    authProvider: 'LOCAL',
    passwordHash,
    fullName,
    status,
    roles: roleIds,
    ...extra
  })
}

const seedBaseUser = async ({ email, legacyEmail, fullName, roleId, passwordHash, status = 'ACTIVE', extra = {} }) => {
  return await seedUser({
    email,
    legacyEmail,
    fullName,
    roleIds: [roleId],
    passwordHash,
    status,
    extra
  })
}

const buildSeedInvitation = ({ token, ...data }) => {
  const normalizedToken = token || `seed-token-${crypto.randomUUID()}`
  return {
    ...data,
    tokenHash: crypto.createHash('sha256').update(normalizedToken).digest('hex'),
    metadata: {
      ...(data.metadata || {}),
      previewToken: normalizedToken
    }
  }
}

const seedRuntimeDevScenarios = async ({
  roleByName,
  seededPasswordHash,
  adminUser,
  coordinatorUser,
  judgeUserA,
  judgeUserB,
  mentorUser,
  speakerUser
}) => {
  const participantRole = roleByName.get('PARTICIPANT')
  const now = new Date()
  const runtimeYear = now.getFullYear() + 1

  const registrationEvent = await upsertOne(Event, { seriesName: 'SEAL Runtime Sandbox', season: 'SPRING', year: runtimeYear }, {
    title: `SEAL Runtime Sandbox Spring ${runtimeYear}`,
    description: 'Runtime-ready sandbox event for FE manual testing during registration and team formation.',
    semester: `Spring ${runtimeYear}`,
    seriesName: 'SEAL Runtime Sandbox',
    season: 'SPRING',
    year: runtimeYear,
    theme: 'Live FE scenario coverage',
    registrationStart: addTime(now, { days: -7 }),
    registrationEnd: addTime(now, { days: 14 }),
    startDate: addTime(now, { days: 21 }),
    endDate: addTime(now, { days: 23 }),
    maxTeams: 8,
    minTeamMembers: 3,
    maxTeamMembers: 5,
    competitionConfig: {
      boardCount: 2,
      trackCount: 2,
      maxTeamsPerBoard: 4,
      finalistCount: 4,
      finalistsPerBoard: 2,
      finalistSelectionMode: 'FIXED_PER_BOARD',
      fillRemainingFinalistsByOverallScore: false,
      rankingScopes: ['TEAM', 'CHAPTER', 'INDIVIDUAL'],
      tieBreakRule: 'Coordinator resolves sandbox ties manually.'
    },
    finalistSlotsPerTrack: 2,
    totalFinalistSlots: 4,
    status: 'OPEN_REGISTRATION',
    createdBy: coordinatorUser._id
  })

  const scoringEvent = await upsertOne(Event, { seriesName: 'SEAL Scoring Sandbox', season: 'SUMMER', year: runtimeYear }, {
    title: `SEAL Scoring Sandbox Summer ${runtimeYear}`,
    description: 'Ongoing scoring sandbox for repository, judging, submission, and media review flows.',
    semester: `Summer ${runtimeYear}`,
    seriesName: 'SEAL Scoring Sandbox',
    season: 'SUMMER',
    year: runtimeYear,
    theme: 'Judging and repository operations',
    registrationStart: addTime(now, { days: -30 }),
    registrationEnd: addTime(now, { days: -14 }),
    startDate: addTime(now, { days: -1 }),
    endDate: addTime(now, { days: 2 }),
    maxTeams: 6,
    minTeamMembers: 3,
    maxTeamMembers: 5,
    competitionConfig: {
      boardCount: 1,
      trackCount: 2,
      maxTeamsPerBoard: 6,
      finalistCount: 3,
      finalistsPerBoard: 3,
      finalistSelectionMode: 'FIXED_PER_BOARD',
      fillRemainingFinalistsByOverallScore: false,
      rankingScopes: ['TEAM', 'CHAPTER'],
      tieBreakRule: 'Judges use rubric-level tie break and coordinator confirmation.'
    },
    finalistSlotsPerTrack: 2,
    totalFinalistSlots: 3,
    status: 'ONGOING',
    createdBy: coordinatorUser._id
  })

  const registrationTracks = await Promise.all([
    upsertOne(Track, { eventId: registrationEvent._id, code: 'WEB' }, {
      eventId: registrationEvent._id,
      code: 'WEB',
      name: 'Web Experience',
      description: 'Frontend and product experience sandbox track.',
      type: 'PRELIMINARY_GROUP',
      maxTeams: 4,
      status: 'OPEN'
    }),
    upsertOne(Track, { eventId: registrationEvent._id, code: 'OPS' }, {
      eventId: registrationEvent._id,
      code: 'OPS',
      name: 'Automation Ops',
      description: 'Automation and developer tooling sandbox track.',
      type: 'PRELIMINARY_GROUP',
      maxTeams: 4,
      status: 'OPEN'
    })
  ])

  const scoringTracks = await Promise.all([
    upsertOne(Track, { eventId: scoringEvent._id, code: 'BUILD' }, {
      eventId: scoringEvent._id,
      code: 'BUILD',
      name: 'Build Reliability',
      description: 'Runtime and CI reliability scenarios.',
      type: 'PRELIMINARY_GROUP',
      maxTeams: 3,
      status: 'LOCKED'
    }),
    upsertOne(Track, { eventId: scoringEvent._id, code: 'AI' }, {
      eventId: scoringEvent._id,
      code: 'AI',
      name: 'AI Workflow',
      description: 'AI-assisted implementation and review scenarios.',
      type: 'PRELIMINARY_GROUP',
      maxTeams: 3,
      status: 'LOCKED'
    })
  ])

  const [
    registrationLead,
    registrationAcceptedA,
    registrationAcceptedB,
    waitingLead,
    waitlistedLead,
    rejectedLead,
    soloParticipant,
    invitedParticipantUser,
    checkedInParticipantUser,
    pendingApprovalUser,
    rejectedApprovalUser,
    suspendedUser,
    scoringLeadA,
    scoringLeadB,
    scoringJudgeParticipantUser
  ] = await Promise.all([
    seedUser({ email: buildSeedEmail('runtime.registration.lead'), fullName: 'Runtime Registration Leader', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.accepted.a'), fullName: 'Runtime Accepted Member A', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.accepted.b'), fullName: 'Runtime Accepted Member B', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.waiting.lead'), fullName: 'Runtime Waiting Leader', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.waitlist.lead'), fullName: 'Runtime Waitlist Leader', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.rejected.lead'), fullName: 'Runtime Rejected Leader', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.solo'), fullName: 'Runtime Solo Participant', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.invited'), fullName: 'Runtime Invited Participant', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.registration.checkedin'), fullName: 'Runtime Checked In Participant', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.approval.pending'), fullName: 'Runtime Pending Approval', roleIds: [participantRole._id], passwordHash: seededPasswordHash, status: 'PENDING' }),
    seedUser({ email: buildSeedEmail('runtime.approval.rejected'), fullName: 'Runtime Rejected Approval', roleIds: [participantRole._id], passwordHash: seededPasswordHash, status: 'REJECTED' }),
    seedUser({ email: buildSeedEmail('runtime.suspended.user'), fullName: 'Runtime Suspended User', roleIds: [participantRole._id], passwordHash: seededPasswordHash, status: 'SUSPENDED' }),
    seedUser({ email: buildSeedEmail('runtime.scoring.lead.a'), fullName: 'Runtime Scoring Leader A', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.scoring.lead.b'), fullName: 'Runtime Scoring Leader B', roleIds: [participantRole._id], passwordHash: seededPasswordHash }),
    seedUser({ email: buildSeedEmail('runtime.scoring.judge.participant'), fullName: 'Runtime Judge Participant', roleIds: [participantRole._id], passwordHash: seededPasswordHash })
  ])
  void [pendingApprovalUser, rejectedApprovalUser, suspendedUser]

  const registrationTimelines = await Promise.all([
    upsertOne(TimelineEvent, { eventId: registrationEvent._id, title: 'Registration window' }, {
      eventId: registrationEvent._id,
      title: 'Registration window',
      description: 'Current registration window for team creation and invitation flows.',
      eventType: 'OTHER',
      status: 'ONGOING',
      startTime: addTime(now, { days: -7 }),
      endTime: addTime(now, { days: 14 })
    }),
    upsertOne(TimelineEvent, { eventId: registrationEvent._id, title: 'Welcome workshop' }, {
      eventId: registrationEvent._id,
      title: 'Welcome workshop',
      description: 'Kickoff workshop for sandbox participants.',
      eventType: 'WORKSHOP',
      status: 'SCHEDULED',
      startTime: addTime(now, { days: 3, hours: 2 }),
      endTime: addTime(now, { days: 3, hours: 4 })
    }),
    upsertOne(TimelineEvent, { eventId: registrationEvent._id, title: 'Check-in opening' }, {
      eventId: registrationEvent._id,
      title: 'Check-in opening',
      description: 'Check-in station opens for sandbox participants.',
      eventType: 'CHECK_IN',
      status: 'SCHEDULED',
      startTime: addTime(now, { days: 7 }),
      endTime: addTime(now, { days: 7, hours: 2 })
    })
  ])

  await upsertOne(Workshop, { eventId: registrationEvent._id, title: 'Welcome workshop' }, {
    eventId: registrationEvent._id,
    timelineEventId: registrationTimelines[1]._id,
    title: 'Welcome workshop',
    description: 'Sandbox workshop for testing participant and coordinator workshop screens.',
    presenterId: mentorUser._id,
    speakerInfo: {
      name: mentorUser.fullName,
      title: 'Sandbox mentor',
      email: mentorUser.email
    },
    meetLink: 'https://meet.google.com/runtime-welcome-workshop',
    startTime: addTime(now, { days: 3, hours: 2 }),
    endTime: addTime(now, { days: 3, hours: 4 }),
    questionnaire: ['What flow are you testing today?', 'Which screen still needs better seed coverage?'],
    status: 'SCHEDULED'
  })

  await upsertOne(Workshop, { eventId: registrationEvent._id, title: 'UI Showcase Session' }, {
    eventId: registrationEvent._id,
    title: 'UI Showcase Session',
    description: 'Speaker-led walkthrough for validating participant and media-facing UI states.',
    presenterId: speakerUser._id,
    speakerInfo: {
      name: speakerUser.fullName,
      title: 'Sandbox speaker',
      email: speakerUser.email
    },
    meetLink: 'https://meet.google.com/runtime-ui-showcase',
    startTime: addTime(now, { days: 4, hours: 1 }),
    endTime: addTime(now, { days: 4, hours: 2, minutes: 30 }),
    questionnaire: ['Which role view should be verified first?', 'What UI state still lacks seed data?'],
    status: 'SCHEDULED'
  })

  const readyTeam = await upsertOne(Team, { eventId: registrationEvent._id, name: 'Runtime Ready Team' }, {
    eventId: registrationEvent._id,
    trackId: registrationTracks[0]._id,
    leaderId: registrationLead._id,
    memberIds: [registrationLead._id, registrationAcceptedA._id, registrationAcceptedB._id],
    mentorIds: [mentorUser._id],
    name: 'Runtime Ready Team',
    chapterName: 'SE',
    projectName: 'Open Registration Portal',
    trackAssignmentMethod: 'MANUAL',
    qualificationStatus: 'REGISTERED',
    status: 'CONFIRMED',
    confirmedAt: addTime(now, { days: -2 })
  })

  const waitingTeam = await upsertOne(Team, { eventId: registrationEvent._id, name: 'Runtime Waiting Team' }, {
    eventId: registrationEvent._id,
    trackId: registrationTracks[1]._id,
    leaderId: waitingLead._id,
    memberIds: [waitingLead._id],
    mentorIds: [mentorUser._id],
    name: 'Runtime Waiting Team',
    chapterName: 'AI',
    projectName: 'Invitation State Tracker',
    trackAssignmentMethod: 'MANUAL',
    qualificationStatus: 'REGISTERED',
    status: 'WAITING_FOR_MEMBERS'
  })

  const waitlistedTeam = await upsertOne(Team, { eventId: registrationEvent._id, name: 'Runtime Waitlisted Team' }, {
    eventId: registrationEvent._id,
    trackId: registrationTracks[1]._id,
    leaderId: waitlistedLead._id,
    memberIds: [waitlistedLead._id],
    mentorIds: [mentorUser._id],
    name: 'Runtime Waitlisted Team',
    chapterName: 'UX',
    projectName: 'Waitlist Visualizer',
    trackAssignmentMethod: 'MANUAL',
    qualificationStatus: 'REGISTERED',
    status: 'WAITLISTED',
    waitlistPosition: 2
  })

  const rejectedTeam = await upsertOne(Team, { eventId: registrationEvent._id, name: 'Runtime Rejected Team' }, {
    eventId: registrationEvent._id,
    trackId: registrationTracks[0]._id,
    leaderId: rejectedLead._id,
    memberIds: [rejectedLead._id],
    mentorIds: [mentorUser._id],
    name: 'Runtime Rejected Team',
    chapterName: 'QA',
    projectName: 'Constraint Validator',
    trackAssignmentMethod: 'MANUAL',
    qualificationStatus: 'ELIMINATED',
    status: 'REJECTED',
    rejectedAt: addTime(now, { days: -1 }),
    rejectionReason: 'Sandbox rejected team for UI testing.'
  })

  await Promise.all([
    upsertOne(Participant, { eventId: registrationEvent._id, userId: registrationLead._id }, {
      eventId: registrationEvent._id,
      userId: registrationLead._id,
      teamId: readyTeam._id,
      chapterName: 'SE',
      teamRole: 'LEADER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'CHECKED_IN',
      githubAccessStatus: 'GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -5 })
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: registrationAcceptedA._id }, {
      eventId: registrationEvent._id,
      userId: registrationAcceptedA._id,
      teamId: readyTeam._id,
      chapterName: 'SE',
      teamRole: 'MEMBER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'NOT_CHECKED_IN',
      githubAccessStatus: 'NOT_GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -4 })
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: registrationAcceptedB._id }, {
      eventId: registrationEvent._id,
      userId: registrationAcceptedB._id,
      teamId: readyTeam._id,
      chapterName: 'SE',
      teamRole: 'MEMBER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'CHECKED_IN',
      githubAccessStatus: 'GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -3 })
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: waitingLead._id }, {
      eventId: registrationEvent._id,
      userId: waitingLead._id,
      teamId: waitingTeam._id,
      chapterName: 'AI',
      teamRole: 'LEADER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'NOT_CHECKED_IN',
      githubAccessStatus: 'NOT_GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -2 })
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: waitlistedLead._id }, {
      eventId: registrationEvent._id,
      userId: waitlistedLead._id,
      teamId: waitlistedTeam._id,
      chapterName: 'UX',
      teamRole: 'LEADER',
      consentMediaUse: true,
      eligibilityStatus: 'PENDING',
      checkInStatus: 'NOT_CHECKED_IN',
      githubAccessStatus: 'NOT_GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -1 })
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: rejectedLead._id }, {
      eventId: registrationEvent._id,
      userId: rejectedLead._id,
      teamId: rejectedTeam._id,
      chapterName: 'QA',
      teamRole: 'LEADER',
      consentMediaUse: true,
      eligibilityStatus: 'INELIGIBLE',
      checkInStatus: 'NOT_CHECKED_IN',
      githubAccessStatus: 'REVOKED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -1 })
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: soloParticipant._id }, {
      eventId: registrationEvent._id,
      userId: soloParticipant._id,
      chapterName: 'SE',
      teamRole: 'MEMBER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'NOT_CHECKED_IN',
      githubAccessStatus: 'NOT_GRANTED',
      status: 'INVITED',
      joinedAt: addTime(now, { hours: -12 })
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: invitedParticipantUser._id }, {
      eventId: registrationEvent._id,
      userId: invitedParticipantUser._id,
      chapterName: 'AI',
      consentMediaUse: false,
      eligibilityStatus: 'PENDING',
      checkInStatus: 'NOT_CHECKED_IN',
      githubAccessStatus: 'NOT_GRANTED',
      status: 'INVITED'
    }),
    upsertOne(Participant, { eventId: registrationEvent._id, userId: checkedInParticipantUser._id }, {
      eventId: registrationEvent._id,
      userId: checkedInParticipantUser._id,
      chapterName: 'Cloud',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'CHECKED_IN',
      githubAccessStatus: 'NOT_GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -1 })
    })
  ])

  await Promise.all([
    upsertOne(TeamInvitation, { teamId: readyTeam._id, invitedEmail: registrationAcceptedA.email }, buildSeedInvitation({
      token: 'seed-runtime-ready-a',
      eventId: registrationEvent._id,
      teamId: readyTeam._id,
      leaderId: registrationLead._id,
      invitedEmail: registrationAcceptedA.email,
      invitedUserId: registrationAcceptedA._id,
      expiresAt: addTime(now, { days: 3 }),
      status: 'ACCEPTED',
      acceptedAt: addTime(now, { days: -4 })
    })),
    upsertOne(TeamInvitation, { teamId: readyTeam._id, invitedEmail: registrationAcceptedB.email }, buildSeedInvitation({
      token: 'seed-runtime-ready-b',
      eventId: registrationEvent._id,
      teamId: readyTeam._id,
      leaderId: registrationLead._id,
      invitedEmail: registrationAcceptedB.email,
      invitedUserId: registrationAcceptedB._id,
      expiresAt: addTime(now, { days: 3 }),
      status: 'ACCEPTED',
      acceptedAt: addTime(now, { days: -3 })
    })),
    upsertOne(TeamInvitation, { teamId: waitingTeam._id, invitedEmail: buildSeedEmail('runtime.registration.pending.invite') }, buildSeedInvitation({
      token: 'seed-runtime-waiting-pending',
      eventId: registrationEvent._id,
      teamId: waitingTeam._id,
      leaderId: waitingLead._id,
      invitedEmail: buildSeedEmail('runtime.registration.pending.invite'),
      expiresAt: addTime(now, { days: 4 }),
      status: 'PENDING'
    })),
    upsertOne(TeamInvitation, { teamId: waitingTeam._id, invitedEmail: buildSeedEmail('runtime.registration.declined.invite') }, buildSeedInvitation({
      token: 'seed-runtime-waiting-declined',
      eventId: registrationEvent._id,
      teamId: waitingTeam._id,
      leaderId: waitingLead._id,
      invitedEmail: buildSeedEmail('runtime.registration.declined.invite'),
      expiresAt: addTime(now, { days: 1 }),
      status: 'DECLINED',
      declinedAt: addTime(now, { days: -1 })
    })),
    upsertOne(TeamInvitation, { teamId: waitingTeam._id, invitedEmail: buildSeedEmail('runtime.registration.cancelled.invite') }, buildSeedInvitation({
      token: 'seed-runtime-waiting-cancelled',
      eventId: registrationEvent._id,
      teamId: waitingTeam._id,
      leaderId: waitingLead._id,
      invitedEmail: buildSeedEmail('runtime.registration.cancelled.invite'),
      expiresAt: addTime(now, { days: 2 }),
      status: 'CANCELLED',
      cancelledAt: addTime(now, { hours: -6 })
    }))
  ])

  const registrationPendingMedia = await upsertOne(Media, { title: 'Pending UI capture' }, {
    eventId: registrationEvent._id,
    uploadedBy: registrationLead._id,
    teamId: readyTeam._id,
    title: 'Pending UI capture',
    description: 'Pending media moderation scenario for admin media screen.',
    mediaType: 'IMAGE',
    storageProvider: 'CLOUDINARY',
    bucketName: 'event-media',
    storagePath: 'handbag-feedbacks/deavtm4rhgfyqvoo6hsm',
    fileUrl: 'https://res.cloudinary.com/dlpuoczic/image/upload/v1772767781/handbag-feedbacks/deavtm4rhgfyqvoo6hsm.jpg',
    originalFileName: 'pending-ui-capture.jpg',
    mimeType: 'image/jpeg',
    fileSize: 2048,
    fileExtension: 'jpg',
    tags: ['runtime', 'pending', 'ui'],
    status: 'PENDING',
    uploadedAt: addTime(now, { hours: -4 })
  })

  const registrationRejectedMedia = await upsertOne(Media, { title: 'Rejected specification' }, {
    eventId: registrationEvent._id,
    uploadedBy: waitingLead._id,
    teamId: waitingTeam._id,
    title: 'Rejected specification',
    description: 'Rejected media moderation scenario.',
    mediaType: 'DOCUMENT',
    storageProvider: 'CLOUDINARY',
    bucketName: 'event-media',
    storagePath: 'samples/coffee',
    fileUrl: 'https://res.cloudinary.com/dlpuoczic/image/upload/v1769832940/samples/coffee.jpg',
    originalFileName: 'runtime-rejected-spec.pdf',
    mimeType: 'application/pdf',
    fileSize: 4096,
    fileExtension: 'pdf',
    tags: ['runtime', 'rejected'],
    status: 'REJECTED',
    reviewedBy: coordinatorUser._id,
    reviewedAt: addTime(now, { hours: -1 }),
    rejectReason: 'Seeded rejected document for moderation testing.',
    uploadedAt: addTime(now, { hours: -5 })
  })

  await Promise.all([
    upsertOne(MediaActivity, { mediaId: registrationPendingMedia._id, action: 'UPLOAD' }, {
      mediaId: registrationPendingMedia._id,
      eventId: registrationEvent._id,
      userId: registrationLead._id,
      action: 'UPLOAD',
      metadata: { seeded: true, scenario: 'runtime-pending-media' },
      createdAt: addTime(now, { hours: -4 })
    }),
    upsertOne(MediaActivity, { mediaId: registrationRejectedMedia._id, action: 'REJECT' }, {
      mediaId: registrationRejectedMedia._id,
      eventId: registrationEvent._id,
      userId: coordinatorUser._id,
      action: 'REJECT',
      metadata: { seeded: true, reason: 'Seeded rejected document for moderation testing.' },
      createdAt: addTime(now, { hours: -1 })
    })
  ])

  const scoringRubricDraft = await upsertOne(Rubric, { eventId: scoringEvent._id, title: 'Runtime Draft Rubric' }, {
    eventId: scoringEvent._id,
    title: 'Runtime Draft Rubric',
    description: 'Draft rubric used to test rubric lifecycle states.',
    totalScore: 100,
    status: 'DRAFT',
    createdBy: coordinatorUser._id
  })

  const scoringRubricActive = await upsertOne(Rubric, { eventId: scoringEvent._id, title: 'Runtime Active Rubric' }, {
    eventId: scoringEvent._id,
    title: 'Runtime Active Rubric',
    description: 'Active rubric used for sandbox judging.',
    totalScore: 100,
    status: 'ACTIVE',
    createdBy: coordinatorUser._id
  })

  const scoringCriteria = await Promise.all([
    ['Product readiness', 30],
    ['Technical depth', 25],
    ['AI usage quality', 25],
    ['Presentation clarity', 20]
  ].map(([name, maxScore]) => upsertOne(Criterion, { rubricId: scoringRubricActive._id, name }, {
    rubricId: scoringRubricActive._id,
    name,
    description: `${name} criterion for runtime sandbox scoring.`,
    maxScore,
    weight: 1
  })))
  void scoringRubricDraft

  const scoringTeamA = await upsertOne(Team, { eventId: scoringEvent._id, name: 'Runtime Scoring Team A' }, {
    eventId: scoringEvent._id,
    trackId: scoringTracks[0]._id,
    leaderId: scoringLeadA._id,
    memberIds: [scoringLeadA._id],
    mentorIds: [mentorUser._id],
    name: 'Runtime Scoring Team A',
    chapterName: 'SE',
    projectName: 'Board Scope Viewer',
    trackAssignmentMethod: 'MANUAL',
    qualificationStatus: 'PRELIMINARY',
    status: 'CONFIRMED',
    confirmedAt: addTime(now, { days: -8 })
  })

  const scoringTeamB = await upsertOne(Team, { eventId: scoringEvent._id, name: 'Runtime Scoring Team B' }, {
    eventId: scoringEvent._id,
    trackId: scoringTracks[1]._id,
    leaderId: scoringLeadB._id,
    memberIds: [scoringLeadB._id, scoringJudgeParticipantUser._id],
    mentorIds: [mentorUser._id],
    name: 'Runtime Scoring Team B',
    chapterName: 'AI',
    projectName: 'Submission Review Console',
    trackAssignmentMethod: 'MANUAL',
    qualificationStatus: 'PRELIMINARY',
    status: 'CONFIRMED',
    confirmedAt: addTime(now, { days: -8 })
  })

  await Promise.all([
    upsertOne(Participant, { eventId: scoringEvent._id, userId: scoringLeadA._id }, {
      eventId: scoringEvent._id,
      userId: scoringLeadA._id,
      teamId: scoringTeamA._id,
      chapterName: 'SE',
      teamRole: 'LEADER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'CHECKED_IN',
      githubAccessStatus: 'GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -10 })
    }),
    upsertOne(Participant, { eventId: scoringEvent._id, userId: scoringLeadB._id }, {
      eventId: scoringEvent._id,
      userId: scoringLeadB._id,
      teamId: scoringTeamB._id,
      chapterName: 'AI',
      teamRole: 'LEADER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'CHECKED_IN',
      githubAccessStatus: 'NOT_GRANTED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -10 })
    }),
    upsertOne(Participant, { eventId: scoringEvent._id, userId: scoringJudgeParticipantUser._id }, {
      eventId: scoringEvent._id,
      userId: scoringJudgeParticipantUser._id,
      teamId: scoringTeamB._id,
      chapterName: 'AI',
      teamRole: 'MEMBER',
      consentMediaUse: true,
      eligibilityStatus: 'ELIGIBLE',
      checkInStatus: 'NOT_CHECKED_IN',
      githubAccessStatus: 'REVOKED',
      status: 'JOINED',
      joinedAt: addTime(now, { days: -9 })
    })
  ])

  const scoringTimelines = await Promise.all([
    upsertOne(TimelineEvent, { eventId: scoringEvent._id, title: 'Coding window' }, {
      eventId: scoringEvent._id,
      title: 'Coding window',
      description: 'Ongoing implementation window.',
      eventType: 'OTHER',
      status: 'ONGOING',
      startTime: addTime(now, { hours: -6 }),
      endTime: addTime(now, { hours: 8 })
    }),
    upsertOne(TimelineEvent, { eventId: scoringEvent._id, title: 'Scoring review' }, {
      eventId: scoringEvent._id,
      title: 'Scoring review',
      description: 'Judges submit and lock score sheets.',
      eventType: 'ROUND',
      status: 'SCHEDULED',
      startTime: addTime(now, { hours: 1 }),
      endTime: addTime(now, { hours: 12 })
    })
  ])
  void scoringTimelines

  const workshopLive = await upsertOne(Workshop, { eventId: scoringEvent._id, title: 'Live mentoring desk' }, {
    eventId: scoringEvent._id,
    title: 'Live mentoring desk',
    description: 'Ongoing mentor office hours for sandbox participants.',
    presenterId: mentorUser._id,
    speakerInfo: {
      name: mentorUser.fullName,
      title: 'Live mentor',
      email: mentorUser.email
    },
    meetLink: 'https://meet.google.com/runtime-live-mentor',
    startTime: addTime(now, { hours: -1 }),
    endTime: addTime(now, { hours: 2 }),
    questionnaire: ['What repository signal should judges trust most?'],
    status: 'LIVE'
  })

  const workshopSpeakerLive = await upsertOne(Workshop, { eventId: scoringEvent._id, title: 'Final Demo Storytelling Clinic' }, {
    eventId: scoringEvent._id,
    title: 'Final Demo Storytelling Clinic',
    description: 'Speaker-led live session for polishing demos before score submission closes.',
    presenterId: speakerUser._id,
    speakerInfo: {
      name: speakerUser.fullName,
      title: 'Demo storytelling speaker',
      email: speakerUser.email
    },
    meetLink: 'https://meet.google.com/runtime-demo-clinic',
    startTime: addTime(now, { minutes: -30 }),
    endTime: addTime(now, { hours: 1, minutes: 30 }),
    questionnaire: ['What is the strongest takeaway from your demo?', 'Which slide needs the most clarity?'],
    status: 'LIVE'
  })
  void [workshopLive, workshopSpeakerLive]

  const draftRound = await upsertOne(Round, { eventId: scoringEvent._id, name: 'Runtime Qualification' }, {
    eventId: scoringEvent._id,
    trackId: scoringTracks[0]._id,
    name: 'Runtime Qualification',
    roundType: 'PRELIMINARY',
    assignedTeamIds: [scoringTeamA._id, scoringTeamB._id],
    assignedJudgeIds: [judgeUserA._id],
    rubricId: scoringRubricActive._id,
    submissionDeadline: addTime(now, { hours: 2 }),
    startTime: addTime(now, { hours: -1 }),
    endTime: addTime(now, { hours: 5 }),
    status: 'OPEN'
  })

  const scoringRound = await upsertOne(Round, { eventId: scoringEvent._id, name: 'Runtime Final Scoring' }, {
    eventId: scoringEvent._id,
    trackId: scoringTracks[1]._id,
    name: 'Runtime Final Scoring',
    roundType: 'FINAL',
    assignedTeamIds: [scoringTeamA._id, scoringTeamB._id],
    promotedTeamIds: [scoringTeamA._id, scoringTeamB._id],
    assignedJudgeIds: [judgeUserA._id, judgeUserB._id],
    rubricId: scoringRubricActive._id,
    submissionDeadline: addTime(now, { hours: -2 }),
    startTime: addTime(now, { hours: -3 }),
    endTime: addTime(now, { hours: 6 }),
    publishTime: addTime(now, { hours: 7 }),
    status: 'SCORING'
  })

  const draftBoard = await upsertOne(JudgingBoard, { eventId: scoringEvent._id, roundId: draftRound._id, boardNumber: 1 }, {
    eventId: scoringEvent._id,
    roundId: draftRound._id,
    trackId: scoringTracks[0]._id,
    name: 'Runtime Qualification Board',
    boardNumber: 1,
    teamIds: [scoringTeamA._id, scoringTeamB._id],
    judgeIds: [judgeUserA._id],
    maxTeams: 4,
    status: 'ASSIGNED'
  })

  const scoringBoard = await upsertOne(JudgingBoard, { eventId: scoringEvent._id, roundId: scoringRound._id, boardNumber: 1 }, {
    eventId: scoringEvent._id,
    roundId: scoringRound._id,
    trackId: scoringTracks[1]._id,
    name: 'Runtime Final Board',
    boardNumber: 1,
    teamIds: [scoringTeamA._id, scoringTeamB._id],
    judgeIds: [judgeUserA._id, judgeUserB._id],
    maxTeams: 4,
    status: 'SCORING'
  })
  void draftBoard

  const repositories = await Promise.all([
    upsertOne(Repository, { teamId: scoringTeamA._id }, {
      eventId: scoringEvent._id,
      roundId: scoringRound._id,
      teamId: scoringTeamA._id,
      githubOwner: 'seal-runtime-sandbox',
      githubRepo: 'runtime-scoring-team-a',
      repositoryFullName: 'seal-runtime-sandbox/runtime-scoring-team-a',
      repositoryUrl: 'https://github.com/seal-runtime-sandbox/runtime-scoring-team-a',
      repoUrl: 'https://github.com/seal-runtime-sandbox/runtime-scoring-team-a',
      contributors: [scoringLeadA._id],
      defaultBranch: 'main',
      latestCommitSha: 'runtimea1234567890',
      lastProcessedCommitSha: 'runtimea1234567890',
      status: 'ACTIVE',
      accessState: 'GRANTED',
      submissionStatus: 'SUBMITTED',
      webhookStatus: 'REGISTERED',
      webhookRegisteredAt: addTime(now, { hours: -2 }),
      accessGrantedAt: addTime(now, { days: -5 }),
      lastSyncAt: addTime(now, { hours: -1 })
    }),
    upsertOne(Repository, { teamId: scoringTeamB._id }, {
      eventId: scoringEvent._id,
      roundId: scoringRound._id,
      teamId: scoringTeamB._id,
      githubOwner: 'seal-runtime-sandbox',
      githubRepo: 'runtime-scoring-team-b',
      repositoryFullName: 'seal-runtime-sandbox/runtime-scoring-team-b',
      repositoryUrl: 'https://github.com/seal-runtime-sandbox/runtime-scoring-team-b',
      repoUrl: 'https://github.com/seal-runtime-sandbox/runtime-scoring-team-b',
      contributors: [scoringLeadB._id, scoringJudgeParticipantUser._id],
      defaultBranch: 'main',
      latestCommitSha: 'runtimeb0987654321',
      lastProcessedCommitSha: 'runtimeb0000000000',
      status: 'DISCONNECTED',
      accessState: 'REVOKED',
      submissionStatus: 'NOT_SUBMITTED',
      webhookStatus: 'FAILED',
      lastWebhookRegistrationError: 'Seeded webhook failure for runtime testing.',
      accessRevokedAt: addTime(now, { hours: -8 }),
      lastSyncAt: addTime(now, { hours: -9 })
    })
  ])

  const [repositoryA, repositoryB] = repositories
  const commitA = await upsertOne(Commit, { commitSha: 'runtimea1234567890' }, {
    repositoryId: repositoryA._id,
    commitSha: 'runtimea1234567890',
    authorName: scoringLeadA.fullName,
    authorEmail: scoringLeadA.email,
    timestamp: addTime(now, { hours: -2 }),
    message: 'Seeded scoring sandbox commit',
    linesAdded: 180,
    linesRemoved: 24,
    filesChanged: 8
  })

  const commitB = await upsertOne(Commit, { commitSha: 'runtimeb0987654321' }, {
    repositoryId: repositoryB._id,
    commitSha: 'runtimeb0987654321',
    authorName: scoringLeadB.fullName,
    authorEmail: scoringLeadB.email,
    timestamp: addTime(now, { hours: -8 }),
    message: 'Repository with failing webhook state',
    linesAdded: 42,
    linesRemoved: 17,
    filesChanged: 3
  })

  const diffA = await upsertOne(CommitDiff, { repositoryId: repositoryA._id, headCommitSha: commitA.commitSha }, {
    repositoryId: repositoryA._id,
    commitId: commitA._id,
    baseCommitSha: 'runtimea0000000000',
    headCommitSha: commitA.commitSha,
    provider: 'GITHUB',
    status: 'READY',
    diffHash: 'runtime-diff-a',
    diffText: 'Seeded runtime diff for repository detail testing.',
    files: [
      {
        filePath: 'src/widgets/coordinator/judging/ui/JudgingView.tsx',
        status: 'modified',
        additions: 40,
        deletions: 10,
        patch: '@@ runtime diff @@'
      }
    ],
    fetchedAt: addTime(now, { hours: -2 })
  })

  await Promise.all([
    upsertOne(StaticAnalysisResult, { repositoryId: repositoryA._id, commitSha: commitA.commitSha, source: 'SECRET_SCAN' }, {
      repositoryId: repositoryA._id,
      commitSha: commitA.commitSha,
      source: 'SECRET_SCAN',
      status: 'COMPLETED',
      errorCount: 0,
      warningCount: 1,
      findings: [
        {
          type: 'SECRET',
          severity: 'LOW',
          filePath: 'src/config.ts',
          title: 'Potential token placeholder',
          message: 'Token-like string found in seeded repository.',
          evidence: ['const token = "placeholder"']
        }
      ]
    }),
    upsertOne(ImpactDecision, { repositoryId: repositoryA._id, commitSha: commitA.commitSha }, {
      repositoryId: repositoryA._id,
      commitSha: commitA.commitSha,
      impactScore: 82,
      impactLevel: 'HIGH',
      decision: 'CALL_PER_PUSH_AUDIT',
      reasons: ['Touches judging flow code', 'Updates route-level composition'],
      needsHumanReview: true
    }),
    upsertOne(ChangedCodeContext, { repositoryId: repositoryA._id, commitSha: commitA.commitSha, filePath: 'src/widgets/coordinator/judging/ui/JudgingView.tsx', symbolName: 'JudgingView' }, {
      repositoryId: repositoryA._id,
      commitSha: commitA.commitSha,
      filePath: 'src/widgets/coordinator/judging/ui/JudgingView.tsx',
      symbolName: 'JudgingView',
      symbolType: 'MODULE_SYMBOL',
      startLine: 1,
      endLine: 120,
      contextSnippet: 'Seeded component context for repository evidence testing.',
      confidence: 'HIGH'
    })
  ])

  const reviewA = await upsertOne(AiReview, { repositoryId: repositoryA._id, commitSha: commitA.commitSha, reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT' }, {
    eventId: scoringEvent._id,
    teamId: scoringTeamA._id,
    roundId: scoringRound._id,
    repositoryId: repositoryA._id,
    commitId: commitA._id,
    commitDiffId: diffA._id,
    reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
    provider: 'SeededAI',
    model: 'sandbox-evaluator',
    modelName: 'sandbox-evaluator',
    commitSha: commitA.commitSha,
    status: 'COMPLETED',
    summary: 'Repository A has complete seeded evidence for coordinator and judge review screens.',
    needsHumanReview: true,
    requestedBy: coordinatorUser._id,
    requestedAt: addTime(now, { hours: -2 }),
    completedAt: addTime(now, { hours: -1 })
  })

  await upsertOne(TechnicalFinding, { aiReviewId: reviewA._id, title: 'Judging workflow needs manual smoke test' }, {
    aiReviewId: reviewA._id,
    type: 'RELIABILITY',
    severity: 'MEDIUM',
    title: 'Judging workflow needs manual smoke test',
    evidence: ['Large composition file was recently split into local sections.'],
    comment: 'Seeded technical finding for repository detail dialog.',
    recommendedAction: 'Verify board loading and scoring submission once after every major refactor.'
  })

  const submissions = await Promise.all([
    upsertOne(Submission, { roundId: scoringRound._id, teamId: scoringTeamA._id }, {
      eventId: scoringEvent._id,
      roundId: scoringRound._id,
      teamId: scoringTeamA._id,
      repositoryId: repositoryA._id,
      demoUrl: 'https://example.com/runtime-scoring-a/demo',
      reportUrl: 'https://example.com/runtime-scoring-a/report',
      presentationUrl: 'https://example.com/runtime-scoring-a/slides',
      submittedAt: addTime(now, { hours: -2 }),
      status: 'ACCEPTED'
    }),
    upsertOne(Submission, { roundId: scoringRound._id, teamId: scoringTeamB._id }, {
      eventId: scoringEvent._id,
      roundId: scoringRound._id,
      teamId: scoringTeamB._id,
      repositoryId: repositoryB._id,
      demoUrl: 'https://example.com/runtime-scoring-b/demo',
      reportUrl: 'https://example.com/runtime-scoring-b/report',
      presentationUrl: 'https://example.com/runtime-scoring-b/slides',
      status: 'DRAFT'
    })
  ])

  const [submissionA, submissionB] = submissions
  void submissionB

  const submittedSheet = await upsertOne(ScoreSheet, { roundId: scoringRound._id, teamId: scoringTeamA._id, judgeId: judgeUserA._id }, {
    eventId: scoringEvent._id,
    roundId: scoringRound._id,
    boardId: scoringBoard._id,
    teamId: scoringTeamA._id,
    submissionId: submissionA._id,
    judgeId: judgeUserA._id,
    rubricId: scoringRubricActive._id,
    totalScore: 88,
    weightedScore: 88,
    finalScore: 88,
    generalComment: 'Submitted seeded score sheet.',
    status: 'SUBMITTED',
    submittedAt: addTime(now, { hours: -1 })
  })

  const lockedSheet = await upsertOne(ScoreSheet, { roundId: scoringRound._id, teamId: scoringTeamA._id, judgeId: judgeUserB._id }, {
    eventId: scoringEvent._id,
    roundId: scoringRound._id,
    boardId: scoringBoard._id,
    teamId: scoringTeamA._id,
    submissionId: submissionA._id,
    judgeId: judgeUserB._id,
    rubricId: scoringRubricActive._id,
    totalScore: 91,
    weightedScore: 91,
    finalScore: 91,
    generalComment: 'Locked seeded score sheet.',
    status: 'LOCKED',
    submittedAt: addTime(now, { hours: -1 }),
    lockedAt: addTime(now, { minutes: -30 })
  })

  const draftSheet = await upsertOne(ScoreSheet, { roundId: scoringRound._id, teamId: scoringTeamB._id, judgeId: judgeUserA._id }, {
    eventId: scoringEvent._id,
    roundId: scoringRound._id,
    boardId: scoringBoard._id,
    teamId: scoringTeamB._id,
    submissionId: submissionB._id,
    judgeId: judgeUserA._id,
    rubricId: scoringRubricActive._id,
    totalScore: 0,
    weightedScore: 0,
    finalScore: 0,
    generalComment: 'Draft seeded score sheet.',
    status: 'DRAFT'
  })
  void draftSheet

  const scoreLines = await Promise.all(scoringCriteria.map((criterion, index) => {
    const scores = [24, 22, 23, 19]
    return upsertOne(Score, { submissionId: submissionA._id, judgeId: judgeUserA._id, criterionId: criterion._id }, {
      submissionId: submissionA._id,
      scoreSheetId: submittedSheet._id,
      judgeId: judgeUserA._id,
      criterionId: criterion._id,
      scoreValue: scores[index],
      comment: 'Seeded scoring criterion'
    })
  }))

  await upsertOne(ScoreSheet, { _id: submittedSheet._id }, {
    scoreIds: scoreLines.map((score) => score._id)
  })
  await upsertOne(ScoreSheet, { _id: lockedSheet._id }, {
    scoreIds: scoreLines.map((score) => score._id)
  })

  await Promise.all([
    upsertOne(SystemConfiguration, { key: `github.event.${registrationEvent._id}.organization` }, {
      key: `github.event.${registrationEvent._id}.organization`,
      value: {
        eventId: registrationEvent._id.toString(),
        organizationName: 'seal-runtime-sandbox',
        ownerUsername: 'runtime-owner',
        enabled: false
      },
      isEncrypted: false,
      updatedBy: adminUser._id
    }),
    upsertOne(SystemConfiguration, { key: `github.event.${scoringEvent._id}.organization` }, {
      key: `github.event.${scoringEvent._id}.organization`,
      value: {
        eventId: scoringEvent._id.toString(),
        organizationName: 'seal-runtime-sandbox',
        ownerUsername: 'runtime-owner',
        enabled: false
      },
      isEncrypted: false,
      updatedBy: adminUser._id
    }),
    upsertOne(GitHubWebhookEvent, { deliveryId: `seed-runtime-${repositoryA._id}` }, {
      deliveryId: `seed-runtime-${repositoryA._id}`,
      eventType: 'push',
      repositoryFullName: repositoryA.repositoryFullName,
      repositoryId: repositoryA._id,
      teamId: scoringTeamA._id,
      branch: 'main',
      beforeCommitSha: 'runtimea0000000000',
      afterCommitSha: commitA.commitSha,
      payload: { seeded: true },
      signatureValid: true,
      status: 'PROCESSED',
      receivedAt: addTime(now, { hours: -2 }),
      processedAt: addTime(now, { hours: -2, minutes: 5 })
    }),
    upsertOne(GitHubWebhookEvent, { deliveryId: `seed-runtime-failed-${repositoryB._id}` }, {
      deliveryId: `seed-runtime-failed-${repositoryB._id}`,
      eventType: 'push',
      repositoryFullName: repositoryB.repositoryFullName,
      repositoryId: repositoryB._id,
      teamId: scoringTeamB._id,
      branch: 'main',
      beforeCommitSha: 'runtimeb0000000000',
      afterCommitSha: commitB.commitSha,
      payload: { seeded: true },
      signatureValid: true,
      status: 'FAILED',
      errorMessage: 'Seeded worker failure for operations dashboard coverage.',
      receivedAt: addTime(now, { hours: -8 }),
      processedAt: addTime(now, { hours: -8, minutes: 4 })
    }),
    upsertOne(Notification, { userId: registrationLead._id, title: 'Runtime sandbox invitation state changed' }, {
      userId: registrationLead._id,
      title: 'Runtime sandbox invitation state changed',
      message: 'A seeded invitation was declined so you can test replacement and cancellation UI.',
      type: 'SYSTEM',
      status: 'UNREAD',
      metadata: { eventId: registrationEvent._id, teamId: waitingTeam._id }
    }),
    upsertOne(Notification, { userId: judgeUserA._id, title: 'Runtime scoring round is active' }, {
      userId: judgeUserA._id,
      title: 'Runtime scoring round is active',
      message: 'Seeded scoring round is ready for judge UI testing.',
      type: 'SYSTEM',
      status: 'UNREAD',
      metadata: { eventId: scoringEvent._id, roundId: scoringRound._id, boardId: scoringBoard._id }
    }),
    upsertOne(AuditLog, { action: 'SEED_RUNTIME_SCENARIOS', resourceType: 'Event', resourceId: registrationEvent._id }, {
      userId: adminUser._id,
      action: 'SEED_RUNTIME_SCENARIOS',
      resourceType: 'Event',
      resourceId: registrationEvent._id,
      metadata: {
        registrationEventId: registrationEvent._id,
        scoringEventId: scoringEvent._id,
        note: 'Seeded runtime sandbox coverage for FE and BE flow testing.'
      }
    })
  ])
}

const seedSampleData = async () => {
  const permissionByCode = await seedPermissions()
  const roleByName = await seedRoles(permissionByCode)
  await migrateUsersOffRemovedUserRole({ userModel: User, roleModel: Role })

  const adminRole = roleByName.get('ADMIN')
  const coordinatorRole = roleByName.get('COORDINATOR')
  const judgeRole = roleByName.get('JUDGE')
  const mentorRole = roleByName.get('MENTOR')
  const speakerRole = roleByName.get('SPEAKER')
  const participantRole = roleByName.get('PARTICIPANT')

  const seededPasswordHash = await BCRYPT_UTILS.hashPassword('Password123!')
  const adminUser = await seedBaseUser({ email: buildSeedEmail('admin'), legacyEmail: 'admin@seal.local', fullName: 'Admin User', roleId: adminRole._id, passwordHash: seededPasswordHash })
  const coordinatorUser = await seedBaseUser({ email: buildSeedEmail('coordinator'), legacyEmail: 'coordinator@seal.local', fullName: 'Event Coordinator', roleId: coordinatorRole._id, passwordHash: seededPasswordHash })
  const judgeUserA = await seedBaseUser({ email: buildSeedEmail('judge.a'), legacyEmail: 'judge.a@seal.local', fullName: 'Judge A', roleId: judgeRole._id, passwordHash: seededPasswordHash })
  const judgeUserB = await seedBaseUser({ email: buildSeedEmail('judge.b'), legacyEmail: 'judge.b@seal.local', fullName: 'Judge B', roleId: judgeRole._id, passwordHash: seededPasswordHash })
  const mentorUser = await seedBaseUser({ email: buildSeedEmail('mentor'), legacyEmail: 'mentor@seal.local', fullName: 'Mentor User', roleId: mentorRole._id, passwordHash: seededPasswordHash })
  const speakerUser = await seedBaseUser({ email: buildSeedEmail('speaker'), legacyEmail: 'speaker@seal.local', fullName: 'Speaker User', roleId: speakerRole._id, passwordHash: seededPasswordHash })

  const event = await upsertOne(Event, { seriesName: 'SEAL Hackathon', season: 'FALL', year: 2025 }, {
    title: 'SEAL Hackathon Fall 2025',
    description: 'AI Agents for Software Innovation hackathon for IT students in Ho Chi Minh City.',
    semester: 'Fall 2025',
    seriesName: 'SEAL Hackathon',
    season: 'FALL',
    year: 2025,
    theme: 'AI Agents for Software Innovation',
    registrationStart: buildDate('2025-10-01T00:00:00+07:00'),
    registrationEnd: buildDate('2025-10-19T23:59:59+07:00'),
    startDate: buildDate('2025-10-29T19:30:00+07:00'),
    endDate: buildDate('2025-11-02T21:00:00+07:00'),
    maxTeams: 30,
    minTeamMembers: 3,
    maxTeamMembers: 5,
    competitionConfig: FALL_2025_SAMPLE_CONFIG,
    finalistSlotsPerTrack: FALL_2025_SAMPLE_CONFIG.finalistsPerBoard,
    totalFinalistSlots: FALL_2025_SAMPLE_CONFIG.finalistCount,
    status: 'COMPLETED',
    createdBy: coordinatorUser._id
  })

  const timelineItems = [
    ['Registration', 'Registration period', 'OTHER', 'COMPLETED', '2025-10-01T00:00:00+07:00', '2025-10-19T23:59:59+07:00'],
    ['Unleashing AI Agents in Software Engineering', 'Workshop before competition day', 'WORKSHOP', 'COMPLETED', '2025-10-29T19:30:00+07:00', '2025-10-29T21:30:00+07:00'],
    ['Opening - Track Draw - Team Meeting', 'Opening ceremony, preliminary group draw, and team briefing', 'CEREMONY', 'COMPLETED', '2025-11-01T14:00:00+07:00', '2025-11-01T17:00:00+07:00'],
    ['Coding and Preliminary Presentations', 'Eight-hour coding window followed by preliminary presentations', 'ROUND', 'COMPLETED', '2025-11-02T06:00:00+07:00', '2025-11-02T17:00:00+07:00'],
    ['Final Round and Award Ceremony', 'Final presentations, scoring, closing, and awards', 'RESULT_PUBLISHING', 'COMPLETED', '2025-11-02T17:00:00+07:00', '2025-11-02T21:00:00+07:00']
  ]

  const timelines = await Promise.all(timelineItems.map(([title, description, eventType, status, startTime, endTime]) => {
    return upsertOne(TimelineEvent, { eventId: event._id, title }, {
      eventId: event._id,
      title,
      description,
      eventType,
      status,
      startTime: buildDate(startTime),
      endTime: buildDate(endTime)
    })
  }))

  const workshopTimeline = timelines[1]
  const workshop = await upsertOne(Workshop, { eventId: event._id, title: 'Unleashing AI Agents in Software Engineering' }, {
    eventId: event._id,
    timelineEventId: workshopTimeline._id,
    title: 'Unleashing AI Agents in Software Engineering',
    description: 'Workshop about applying AI Agents in Software Engineering.',
    presenterId: mentorUser._id,
    speakerInfo: {
      name: mentorUser.fullName,
      title: 'AI Engineering Mentor',
      email: mentorUser.email
    },
    meetLink: 'https://meet.google.com/seal-fall-2025-workshop',
    startTime: buildDate('2025-10-29T19:30:00+07:00'),
    endTime: buildDate('2025-10-29T21:30:00+07:00'),
    questionnaire: [
      'What AI agent use case is your team considering?',
      'Which software engineering task should AI support in your project?'
    ],
    status: 'COMPLETED'
  })

  await upsertOne(Workshop, { eventId: event._id, title: 'Pitching AI Products to Judges' }, {
    eventId: event._id,
    title: 'Pitching AI Products to Judges',
    description: 'Speaker session focused on demo clarity, judging expectations, and presentation structure.',
    presenterId: speakerUser._id,
    speakerInfo: {
      name: speakerUser.fullName,
      title: 'Product storytelling speaker',
      email: speakerUser.email
    },
    meetLink: 'https://meet.google.com/seal-fall-2025-pitching-clinic',
    startTime: buildDate('2025-11-01T09:00:00+07:00'),
    endTime: buildDate('2025-11-01T10:30:00+07:00'),
    questionnaire: [
      'What proof point should your team emphasize to judges?',
      'Which product story can help your demo feel more convincing?'
    ],
    status: 'COMPLETED'
  })

  const trackA = await upsertOne(Track, { eventId: event._id, code: 'A' }, {
    eventId: event._id,
    code: 'A',
    name: 'Bảng A',
    description: 'AI cho Thu thập Yêu cầu & Thiết kế (Requirements and Designs)',
    type: 'PRELIMINARY_GROUP',
    maxTeams: 20,
    status: 'LOCKED'
  })

  const trackB = await upsertOne(Track, { eventId: event._id, code: 'B' }, {
    eventId: event._id,
    code: 'B',
    name: 'Bảng B',
    description: 'AI cho Phát triển, Kiểm thử & Vận hành (Development, Testing & Operations)',
    type: 'PRELIMINARY_GROUP',
    maxTeams: 20,
    status: 'LOCKED'
  })

  await Promise.all(FALL_2025_TRACK_SEEDS.map((trackSeed) => {
    return upsertOne(Track, { eventId: event._id, code: trackSeed.code }, {
      eventId: event._id,
      ...trackSeed,
      status: 'LOCKED'
    })
  }))

  const teamDefinitions = [
    ['Agent Pioneers', 'SE', trackA, 'Requirements Copilot', 92, 1, true],
    ['Prompt Builders', 'AI', trackA, 'AI Requirement Studio', 87, 2, true],
    ['Spec Sprint', 'SE', trackA, 'Design Agent Canvas', 84, 3, true],
    ['Flow Forge', 'UX', trackA, 'User Story Mapper', 81, 4, true],
    ['Vision Merge', 'AI', trackA, 'Architecture Reviewer', 79, 5, true],
    ['Idea Kernel', 'SE', trackA, 'Brief to Blueprint', 73, 6, false],
    ['Ops Automata', 'Cloud', trackB, 'DevTestOps Agent', 94, 1, true],
    ['Test Rangers', 'QA', trackB, 'AI Test Pilot', 89, 2, true],
    ['Deploy Ninjas', 'Cloud', trackB, 'Release Monitor Agent', 85, 3, true],
    ['Bug Hunters', 'QA', trackB, 'Defect Scout', 82, 4, true],
    ['Runtime Crew', 'SE', trackB, 'Ops Watchtower', 80, 5, true],
    ['Chain Coders', 'AI', trackB, 'Code Review Agent', 74, 6, false]
  ]

  const teamRecords = []
  const participantRecords = []

  for (const [teamName, chapterName, track, projectName, preliminaryScore, preliminaryRank, isFinalist] of teamDefinitions) {
    const assignedMentorIds = [mentorUser._id]
    let team = await upsertOne(Team, { eventId: event._id, name: teamName }, {
      eventId: event._id,
      trackId: track._id,
      mentorIds: assignedMentorIds,
      name: teamName,
      chapterName,
      projectName,
      trackAssignmentMethod: 'DRAW',
      trackAssignedAt: buildDate('2025-11-01T15:00:00+07:00'),
      qualificationStatus: isFinalist ? 'FINALIST' : 'ELIMINATED',
      status: 'CONFIRMED',
      confirmedAt: buildDate('2025-10-10T09:00:00+07:00')
    })

    const members = []
    for (let memberIndex = 1; memberIndex <= 3; memberIndex += 1) {
      const emailLocalPart = `${teamName.toLowerCase().replaceAll(' ', '.')}.member${memberIndex}`
      const email = buildSeedEmail(emailLocalPart)
      const legacyEmail = `${emailLocalPart}@seal.local`
      const extra = {
        studentType: memberIndex % 2 === 0 ? 'EXTERNAL' : 'FPT',
        studentId: `SEAL${teamRecords.length + 1}${memberIndex}`
      }

      if (extra.studentType === 'EXTERNAL') {
        extra.schoolName = 'Ho Chi Minh City University'
      }

      const user = await seedBaseUser({
        email,
        legacyEmail,
        fullName: `${teamName} Member ${memberIndex}`,
        roleId: participantRole._id,
        passwordHash: seededPasswordHash,
        extra
      })

      const participant = await upsertOne(Participant, { eventId: event._id, userId: user._id }, {
        eventId: event._id,
        userId: user._id,
        teamId: team._id,
        chapterName,
        teamRole: memberIndex === 1 ? 'LEADER' : 'MEMBER',
        isGraduated: false,
        consentMediaUse: true,
        eligibilityStatus: 'ELIGIBLE',
        attendedActivities: ['WORKSHOP', 'OPENING', 'TEAM_MEETING', 'CODING', 'PRESENTATION', 'CLOSING'],
        checkInStatus: 'CHECKED_IN',
        githubAccessStatus: 'GRANTED',
        status: 'JOINED',
        joinedAt: buildDate('2025-10-10T09:00:00+07:00')
      })

      members.push(user)
      participantRecords.push(participant)
    }

    team = await upsertOne(Team, { _id: team._id }, {
      leaderId: members[0]?._id,
      memberIds: members.map((member) => member._id)
    })

    teamRecords.push({ team, track, members, preliminaryScore, preliminaryRank, isFinalist })
  }

  const trackATeams = teamRecords.filter(({ track }) => track._id.equals(trackA._id)).map(({ team }) => team._id)
  const trackBTeams = teamRecords.filter(({ track }) => track._id.equals(trackB._id)).map(({ team }) => team._id)
  const finalistRecords = teamRecords.filter(({ isFinalist }) => isFinalist)
  const finalistTeams = finalistRecords.map(({ team }) => team._id)

  await upsertOne(Track, { _id: trackA._id }, { teamIds: trackATeams })
  await upsertOne(Track, { _id: trackB._id }, { teamIds: trackBTeams })

  const preliminaryRubric = await upsertOne(Rubric, { eventId: event._id, title: 'Fall 2025 Preliminary Rubric' }, {
    eventId: event._id,
    title: 'Fall 2025 Preliminary Rubric',
    description: 'Correctness, AI application, architecture, presentation, and teamwork.',
    totalScore: 100,
    createdBy: coordinatorUser._id
  })

  const finalRubric = await upsertOne(Rubric, { eventId: event._id, title: 'Fall 2025 Final Rubric' }, {
    eventId: event._id,
    title: 'Fall 2025 Final Rubric',
    description: 'Product quality, innovation, applicability, demo, teamwork, and rebuttal.',
    totalScore: 100,
    createdBy: coordinatorUser._id
  })

  const preliminaryCriteria = await Promise.all([
    ['Tính đúng đắn & Hoàn thiện chức năng', 'Functional correctness and completeness', 25],
    ['Ứng dụng AI trong giải pháp', 'Quality of AI usage in the solution', 25],
    ['Thiết kế & Kiến trúc phần mềm', 'Software design and architecture', 20],
    ['Thuyết trình & Demo', 'Presentation and product demo', 15],
    ['Teamwork & Tinh thần làm việc', 'Teamwork and working spirit', 15]
  ].map(([name, description, maxScore]) => {
    return upsertOne(Criterion, { rubricId: preliminaryRubric._id, name }, {
      rubricId: preliminaryRubric._id,
      name,
      description,
      maxScore,
      weight: 1
    })
  }))

  const finalCriteria = await Promise.all([
    ['Độ hoàn thiện & Chất lượng sản phẩm', 'Product completeness and quality', 30],
    ['Sáng tạo & Khả năng đổi mới', 'Creativity and innovation', 20],
    ['Tính ứng dụng & Khả năng triển khai', 'Practical applicability and deployability', 20],
    ['Trình bày & Demo sản phẩm', 'Product presentation and demo', 15],
    ['Làm việc nhóm & Trả lời phản biện', 'Teamwork and rebuttal', 15]
  ].map(([name, description, maxScore]) => {
    return upsertOne(Criterion, { rubricId: finalRubric._id, name }, {
      rubricId: finalRubric._id,
      name,
      description,
      maxScore,
      weight: 1
    })
  }))

  const preliminaryRoundA = await upsertOne(Round, { eventId: event._id, trackId: trackA._id, name: 'Vòng Sơ loại - Bảng A' }, {
    eventId: event._id,
    trackId: trackA._id,
    name: 'Vòng Sơ loại - Bảng A',
    roundType: 'PRELIMINARY',
    assignedTeamIds: trackATeams,
    promotedTeamIds: finalistRecords.filter(({ track }) => track._id.equals(trackA._id)).map(({ team }) => team._id),
    maxPromotedTeams: FALL_2025_SAMPLE_CONFIG.finalistsPerBoard,
    startTime: buildDate('2025-11-02T06:00:00+07:00'),
    endTime: buildDate('2025-11-02T17:00:00+07:00'),
    submissionDeadline: buildDate('2025-11-02T14:00:00+07:00'),
    publishTime: buildDate('2025-11-02T17:00:00+07:00'),
    assignedJudgeIds: [judgeUserA._id],
    rubricId: preliminaryRubric._id,
    promotionRule: 'Top 5 teams in Bảng A advance to the final round.',
    status: 'COMPLETED'
  })

  const preliminaryRoundB = await upsertOne(Round, { eventId: event._id, trackId: trackB._id, name: 'Vòng Sơ loại - Bảng B' }, {
    eventId: event._id,
    trackId: trackB._id,
    name: 'Vòng Sơ loại - Bảng B',
    roundType: 'PRELIMINARY',
    assignedTeamIds: trackBTeams,
    promotedTeamIds: finalistRecords.filter(({ track }) => track._id.equals(trackB._id)).map(({ team }) => team._id),
    maxPromotedTeams: FALL_2025_SAMPLE_CONFIG.finalistsPerBoard,
    startTime: buildDate('2025-11-02T06:00:00+07:00'),
    endTime: buildDate('2025-11-02T17:00:00+07:00'),
    submissionDeadline: buildDate('2025-11-02T14:00:00+07:00'),
    publishTime: buildDate('2025-11-02T17:00:00+07:00'),
    assignedJudgeIds: [judgeUserB._id],
    rubricId: preliminaryRubric._id,
    promotionRule: 'Top 5 teams in Bảng B advance to the final round.',
    status: 'COMPLETED'
  })

  const finalRound = await upsertOne(Round, { eventId: event._id, name: 'Vòng Chung kết' }, {
    eventId: event._id,
    name: 'Vòng Chung kết',
    roundType: 'FINAL',
    assignedTeamIds: finalistTeams,
    maxPromotedTeams: 6,
    startTime: buildDate('2025-11-02T17:00:00+07:00'),
    endTime: buildDate('2025-11-02T20:30:00+07:00'),
    submissionDeadline: buildDate('2025-11-02T18:30:00+07:00'),
    publishTime: buildDate('2025-11-02T20:30:00+07:00'),
    assignedJudgeIds: [judgeUserA._id, judgeUserB._id],
    rubricId: finalRubric._id,
    promotionRule: 'Final judges select 6 prize-winning teams according to the award structure.',
    tieBreakRule: 'If final teams have the same score, run a 10-minute penalty evaluation or mini test and use the result to assign unique ranks.',
    tieBreakDurationMinutes: 10,
    status: 'COMPLETED'
  })

  const [preliminaryBoardA, preliminaryBoardB, finalBoard] = await Promise.all([
    upsertOne(JudgingBoard, { eventId: event._id, roundId: preliminaryRoundA._id, boardNumber: 1 }, {
      eventId: event._id,
      roundId: preliminaryRoundA._id,
      trackId: trackA._id,
      name: 'Hội đồng Sơ loại - Bảng A',
      boardNumber: 1,
      teamIds: trackATeams,
      judgeIds: [judgeUserA._id],
      maxTeams: 20,
      status: 'COMPLETED'
    }),
    upsertOne(JudgingBoard, { eventId: event._id, roundId: preliminaryRoundB._id, boardNumber: 1 }, {
      eventId: event._id,
      roundId: preliminaryRoundB._id,
      trackId: trackB._id,
      name: 'Hội đồng Sơ loại - Bảng B',
      boardNumber: 1,
      teamIds: trackBTeams,
      judgeIds: [judgeUserB._id],
      maxTeams: 20,
      status: 'COMPLETED'
    }),
    upsertOne(JudgingBoard, { eventId: event._id, roundId: finalRound._id, boardNumber: 1 }, {
      eventId: event._id,
      roundId: finalRound._id,
      name: 'Hội đồng Chung kết',
      boardNumber: 1,
      teamIds: finalistTeams,
      judgeIds: [judgeUserA._id, judgeUserB._id],
      maxTeams: 10,
      status: 'COMPLETED'
    })
  ])

  const repositoryByTeamId = new Map()
  const aiReviewByTeamId = new Map()

  for (const record of teamRecords) {
    const round = record.track._id.equals(trackA._id) ? preliminaryRoundA : preliminaryRoundB
    const board = record.track._id.equals(trackA._id) ? preliminaryBoardA : preliminaryBoardB
    const judgeId = record.track._id.equals(trackA._id) ? judgeUserA._id : judgeUserB._id
    const repoName = record.team.name.toLowerCase().replaceAll(' ', '-')
    const repository = await upsertOne(Repository, { teamId: record.team._id }, {
      eventId: event._id,
      teamId: record.team._id,
      githubOrg: 'seal-fall-2025',
      repoName,
      repoUrl: `https://github.com/seal-fall-2025/${repoName}`,
      contributors: record.members.map((member) => member._id),
      defaultBranch: 'main',
      submissionStatus: 'SUBMITTED',
      lastSyncAt: buildDate('2025-11-02T14:30:00+07:00')
    })
    repositoryByTeamId.set(record.team._id.toString(), repository)

    const commit = await upsertOne(Commit, { commitSha: `fall-2025-${repoName}-initial` }, {
      repositoryId: repository._id,
      commitSha: `fall-2025-${repoName}-initial`,
      authorName: record.members[0].fullName,
      authorEmail: record.members[0].email,
      timestamp: buildDate('2025-11-02T13:30:00+07:00'),
      message: 'Initial hackathon submission',
      linesAdded: 1200,
      linesRemoved: 80,
      filesChanged: 45
    })

    const commitDiff = await upsertOne(CommitDiff, { repositoryId: repository._id, headCommitSha: commit.commitSha }, {
      repositoryId: repository._id,
      commitId: commit._id,
      baseCommitSha: 'main-before-hackathon',
      headCommitSha: commit.commitSha,
      provider: 'GITHUB',
      status: 'READY',
      diffHash: `diff-${repoName}`,
      diffText: `Seeded diff cache for ${record.team.name}.`,
      files: [
        {
          filePath: 'src/app.js',
          status: 'modified',
          additions: 120,
          deletions: 8,
          patch: '@@ seeded hackathon changes @@'
        }
      ],
      fetchedAt: buildDate('2025-11-02T14:25:00+07:00')
    })

    const preliminarySubmission = await upsertOne(Submission, { roundId: round._id, teamId: record.team._id }, {
      eventId: event._id,
      roundId: round._id,
      teamId: record.team._id,
      repositoryId: repository._id,
      demoUrl: `https://example.com/fall-2025/${repoName}/demo`,
      reportUrl: `https://example.com/fall-2025/${repoName}/report`,
      presentationUrl: `https://example.com/fall-2025/${repoName}/slides`,
      submittedAt: buildDate('2025-11-02T14:00:00+07:00'),
      status: 'ACCEPTED'
    })

    const aiReview = await upsertOne(AiReview, { repositoryId: repository._id, commitId: commit._id }, {
      repositoryId: repository._id,
      commitId: commit._id,
      commitDiffId: commitDiff._id,
      reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
      provider: 'SampleAI',
      model: 'fall-2025-evaluator',
      status: 'COMPLETED',
      summary: 'Seeded AI technical audit result for hackathon repository.',
      isScoreBased: false,
      isFinalDecision: false,
      requestedBy: coordinatorUser._id,
      requestedAt: buildDate('2025-11-02T14:30:00+07:00'),
      completedAt: buildDate('2025-11-02T14:35:00+07:00')
    })
    aiReviewByTeamId.set(record.team._id.toString(), aiReview)

    const preliminaryAiCriteria = await Promise.all(preliminaryCriteria.map((criterion, order) => {
      return upsertOne(AiReviewCriterion, { aiReviewId: aiReview._id, code: `PRELIMINARY_${order + 1}` }, {
        aiReviewId: aiReview._id,
        criterionId: criterion._id,
        code: `PRELIMINARY_${order + 1}`,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        qualitativeLevel: toQualitativeLevel(record.preliminaryScore, preliminaryRubric.totalScore),
        feedback: 'Seeded AI criterion feedback aligned with the preliminary rubric.',
        strengths: ['Highlights technical areas worth discussing with judges.'],
        weaknesses: ['This seeded data is qualitative only and does not influence official judging.'],
        suggestions: ['Judges should review AI findings as advisory context before finalizing official scores.'],
        evidence: [`Commit diff cache ${commitDiff.diffHash}`],
        risks: ['AI review is advisory and must not replace judge-entered scores.'],
        order: order + 1
      })
    }))
    void preliminaryAiCriteria

    const preliminaryScoreSheet = await upsertOne(ScoreSheet, { roundId: round._id, teamId: record.team._id, judgeId }, {
      eventId: event._id,
      roundId: round._id,
      boardId: board._id,
      teamId: record.team._id,
      submissionId: preliminarySubmission._id,
      judgeId,
      rubricId: preliminaryRubric._id,
      totalScore: record.preliminaryScore,
      weightedScore: record.preliminaryScore,
      finalScore: record.preliminaryScore,
      generalComment: 'Seeded preliminary score sheet.',
      status: 'SUBMITTED',
      submittedAt: buildDate('2025-11-02T16:30:00+07:00')
    })

    const preliminaryScoreLines = await Promise.all(preliminaryCriteria.map((criterion) => {
      const scoreValue = Math.min(criterion.maxScore, Math.round(record.preliminaryScore * (criterion.maxScore / preliminaryRubric.totalScore)))

      return upsertOne(Score, { submissionId: preliminarySubmission._id, judgeId, criterionId: criterion._id }, {
        submissionId: preliminarySubmission._id,
        scoreSheetId: preliminaryScoreSheet._id,
        judgeId,
        criterionId: criterion._id,
        scoreValue,
        isOverridden: false,
        overrideReason: null,
        comment: 'Seeded preliminary criterion score'
      })
    }))

    await upsertOne(ScoreSheet, { _id: preliminaryScoreSheet._id }, {
      scoreIds: preliminaryScoreLines.map((score) => score._id)
    })

    await upsertOne(Ranking, { eventId: event._id, rankingType: 'TEAM', roundId: round._id, teamId: record.team._id }, {
      eventId: event._id,
      rankingType: 'TEAM',
      roundId: round._id,
      trackId: record.track._id,
      teamId: record.team._id,
      score: record.preliminaryScore,
      rank: record.preliminaryRank,
      isSelectedForFinal: record.isFinalist,
      selectionReason: record.isFinalist ? 'Top 5 teams in the preliminary track advanced to the final round.' : 'Not selected because the team ranked outside the available final slots.',
      note: record.isFinalist ? 'Advanced to final round' : 'Eliminated after preliminary round',
      publishedAt: buildDate('2025-11-02T17:00:00+07:00')
    })
  }

  const finalScores = [95, 91, 88, 84, 82, 82, 78, 76, 74, 72]
  const finalTieBreakScores = [0, 0, 0, 0, 9, 7, 0, 0, 0, 0]
  for (let index = 0; index < finalistRecords.length; index += 1) {
    const record = finalistRecords[index]
    const repository = repositoryByTeamId.get(record.team._id.toString())
    const repoName = record.team.name.toLowerCase().replaceAll(' ', '-')

    const finalSubmission = await upsertOne(Submission, { roundId: finalRound._id, teamId: record.team._id }, {
      eventId: event._id,
      roundId: finalRound._id,
      teamId: record.team._id,
      repositoryId: repository._id,
      demoUrl: `https://example.com/fall-2025/${repoName}/final-demo`,
      presentationUrl: `https://example.com/fall-2025/${repoName}/final-slides`,
      submittedAt: buildDate('2025-11-02T18:30:00+07:00'),
      status: 'ACCEPTED'
    })

    const aiReview = aiReviewByTeamId.get(record.team._id.toString())
    const finalAiCriteria = await Promise.all(finalCriteria.map((criterion, order) => {
      return upsertOne(AiReviewCriterion, { aiReviewId: aiReview._id, code: `FINAL_${order + 1}` }, {
        aiReviewId: aiReview._id,
        criterionId: criterion._id,
        code: `FINAL_${order + 1}`,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        qualitativeLevel: toQualitativeLevel(finalScores[index], finalRubric.totalScore),
        feedback: 'Seeded AI criterion feedback aligned with the final rubric.',
        strengths: ['Summarizes technical talking points for judges and coordinators.'],
        weaknesses: ['Does not generate or store any official criterion score.'],
        suggestions: ['Judges should review AI findings as advisory context before finalizing official scores.'],
        evidence: [`Repository ${repository.repoName}`],
        risks: ['Official ranking must remain judge-driven even when AI commentary exists.'],
        order: preliminaryCriteria.length + order + 1
      })
    }))
    void finalAiCriteria

    for (const judge of [judgeUserA, judgeUserB]) {
      const finalScoreSheet = await upsertOne(ScoreSheet, { roundId: finalRound._id, teamId: record.team._id, judgeId: judge._id }, {
        eventId: event._id,
        roundId: finalRound._id,
        boardId: finalBoard._id,
        teamId: record.team._id,
        submissionId: finalSubmission._id,
        judgeId: judge._id,
        rubricId: finalRubric._id,
        totalScore: finalScores[index],
        weightedScore: finalScores[index],
        finalScore: finalScores[index],
        generalComment: 'Seeded final score sheet.',
        status: 'SUBMITTED',
        submittedAt: buildDate('2025-11-02T20:00:00+07:00')
      })

      const finalScoreLines = await Promise.all(finalCriteria.map((criterion) => {
        const scoreValue = Math.min(criterion.maxScore, Math.round(finalScores[index] * (criterion.maxScore / finalRubric.totalScore)))

        return upsertOne(Score, { submissionId: finalSubmission._id, judgeId: judge._id, criterionId: criterion._id }, {
          submissionId: finalSubmission._id,
          scoreSheetId: finalScoreSheet._id,
          judgeId: judge._id,
          criterionId: criterion._id,
          scoreValue,
          isOverridden: false,
          overrideReason: null,
          comment: 'Seeded final criterion score'
        })
      }))

      await upsertOne(ScoreSheet, { _id: finalScoreSheet._id }, {
        scoreIds: finalScoreLines.map((score) => score._id)
      })
    }

    await upsertOne(Ranking, { eventId: event._id, rankingType: 'TEAM', roundId: finalRound._id, teamId: record.team._id }, {
      eventId: event._id,
      rankingType: 'TEAM',
      roundId: finalRound._id,
      teamId: record.team._id,
      score: finalScores[index],
      tieBreakMethod: index === 4 || index === 5 ? 'MINI_TEST' : 'NONE',
      tieBreakScore: finalTieBreakScores[index],
      miniTestScore: finalTieBreakScores[index],
      rankSortScore: finalScores[index] + (finalTieBreakScores[index] / 100),
      rank: index + 1,
      isSelectedForFinal: true,
      selectionReason: 'Team competed in the final round after preliminary selection.',
      note: index === 4 || index === 5 ? 'Final tie resolved by 10-minute mini test.' : (index < 6 ? 'Prize-winning finalist' : 'Finalist'),
      publishedAt: buildDate('2025-11-02T20:30:00+07:00')
    })
  }

  await Promise.all([
    ['SE', 185, 1],
    ['AI', 177, 2],
    ['Cloud', 176, 3],
    ['QA', 171, 4],
    ['UX', 81, 5]
  ].map(([chapterName, score, rank]) => {
    return upsertOne(Ranking, { eventId: event._id, rankingType: 'CHAPTER', chapterName }, {
      eventId: event._id,
      rankingType: 'CHAPTER',
      chapterName,
      score,
      rank,
      note: 'Chapter ranking keeps the highest team achievement and seasonal point adjustments.',
      publishedAt: buildDate('2025-11-02T20:30:00+07:00')
    })
  }))

  await Promise.all(participantRecords.slice(0, 6).map((participant, index) => {
    return upsertOne(Ranking, { eventId: event._id, rankingType: 'INDIVIDUAL', participantId: participant._id }, {
      eventId: event._id,
      rankingType: 'INDIVIDUAL',
      participantId: participant._id,
      teamId: participant.teamId,
      chapterName: participant.chapterName,
      score: 100 - (index * 3),
      rank: index + 1,
      note: 'Individual score is accumulated from team results in each hackathon.',
      publishedAt: buildDate('2025-11-02T20:30:00+07:00')
    })
  }))

  await Promise.all([
    ['Giải Nhất', 'First prize', 7000000, 1, finalistRecords[0].team._id],
    ['Giải Nhì', 'Second prize', 5000000, 2, finalistRecords[1].team._id],
    ['Giải Ba', 'Third prize', 3000000, 3, finalistRecords[2].team._id],
    ['Giải Ý tưởng sáng tạo', 'Creative idea prize', 1000000, 4, finalistRecords[3].team._id],
    ['Giải Ứng dụng thực tiễn', 'Practical application prize', 1000000, 5, finalistRecords[4].team._id]
  ].map(([title, description, amount, rank, teamId]) => {
    return upsertOne(Prize, { eventId: event._id, title }, {
      eventId: event._id,
      title,
      description,
      prizeType: 'TEAM',
      rank,
      amount,
      sponsor: 'SEAL',
      teamId
    })
  }))

  await upsertOne(Prize, { eventId: event._id, title: 'Giải Cá nhân xuất sắc' }, {
    eventId: event._id,
    title: 'Giải Cá nhân xuất sắc',
    description: 'Outstanding individual prize',
    prizeType: 'INDIVIDUAL',
    rank: 1,
    amount: 1000000,
    sponsor: 'SEAL',
    participantId: participantRecords[0]._id
  })

  await upsertOne(WorkshopQuestion, { workshopId: workshop._id, content: 'How are teams assigned into preliminary groups?' }, {
    workshopId: workshop._id,
    authorId: participantRecords[0].userId,
    content: 'How are teams assigned into preliminary groups?',
    voteCount: 3
  })

  await upsertOne(WorkshopFeedback, { workshopId: workshop._id, authorId: participantRecords[0].userId }, {
    workshopId: workshop._id,
    authorId: participantRecords[0].userId,
    comment: 'Useful workshop for AI agent ideas.'
  })

  await upsertOne(WorkshopRating, { workshopId: workshop._id, authorId: participantRecords[0].userId }, {
    workshopId: workshop._id,
    authorId: participantRecords[0].userId,
    rating: 5
  })

  await upsertOne(Notification, { userId: participantRecords[0].userId, title: 'Final results published' }, {
    userId: participantRecords[0].userId,
    title: 'Final results published',
    message: 'SEAL Hackathon Fall 2025 final rankings and prizes have been published.',
    type: 'RESULT',
    status: 'UNREAD',
    metadata: { eventId: event._id }
  })

  const seedMediaStoragePath = 'samples/landscapes/beach-boat'
  const seedMedia = await upsertOne(Media, { title: 'SEAL Hackathon Fall 2025 award ceremony' }, {
    eventId: event._id,
    uploadedBy: coordinatorUser._id,
    title: 'SEAL Hackathon Fall 2025 award ceremony',
    description: 'Award ceremony gallery item for the seeded event.',
    mediaType: 'IMAGE',
    storageProvider: 'CLOUDINARY',
    bucketName: 'event-media',
    storagePath: seedMediaStoragePath,
    fileUrl: 'https://res.cloudinary.com/dlpuoczic/image/upload/v1769832930/samples/landscapes/beach-boat.jpg',
    originalFileName: 'seal-fall-2025-awards.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    fileExtension: 'jpg',
    tags: ['event', 'fall-2025', 'awards'],
    status: 'ACTIVE',
    reviewedBy: coordinatorUser._id,
    reviewedAt: buildDate('2025-11-02T20:30:00+07:00'),
    uploadedAt: buildDate('2025-11-02T20:00:00+07:00')
  })

  await upsertOne(MediaActivity, { mediaId: seedMedia._id, action: 'UPLOAD' }, {
    mediaId: seedMedia._id,
    eventId: event._id,
    userId: coordinatorUser._id,
    action: 'UPLOAD',
    metadata: { seeded: true },
    createdAt: buildDate('2025-11-02T20:00:00+07:00')
  })

  await upsertOne(AuditLog, { action: 'SEED_INIT', resourceType: 'Event', resourceId: event._id }, {
    userId: adminUser._id,
    action: 'SEED_INIT',
    resourceType: 'Event',
    resourceId: event._id,
    metadata: {
      note: 'Seeded SEAL Hackathon Fall 2025 with tracks, teams, rankings, and prizes.',
      registrationTimelineId: timelines[0]._id
    }
  })

  await upsertOne(SystemConfiguration, { key: 'GITHUB_INTEGRATION' }, {
    key: 'GITHUB_INTEGRATION',
    value: { org: 'seal-fall-2025', enabled: true },
    isEncrypted: false,
    updatedBy: adminUser._id
  })

  await upsertOne(SystemConfiguration, { key: 'FALL_2025_RULES' }, {
    key: 'FALL_2025_RULES',
    value: {
      minTeamMembers: 3,
      maxTeamMembers: 5,
      preliminaryTracks: ['A', 'B'],
      competitionConfig: FALL_2025_SAMPLE_CONFIG,
      finalistSlotsPerTrack: FALL_2025_SAMPLE_CONFIG.finalistsPerBoard,
      totalFinalistSlots: FALL_2025_SAMPLE_CONFIG.finalistCount,
      prizeSlots: 6
    },
    isEncrypted: false,
    updatedBy: adminUser._id
  })

  await Promise.all([
    ['media.storage_provider', 'CLOUDINARY'],
    ['media.supabase_bucket', 'event-media'],
    ['media.cloudinary_folder', 'event-media'],
    ['media.bucket_visibility', 'private'],
    ['media.max_image_size_mb', 10],
    ['media.max_video_size_mb', 200],
    ['media.max_document_size_mb', 50],
    ['media.allowed_image_types', ['jpg', 'jpeg', 'png', 'webp']],
    ['media.allowed_video_types', ['mp4', 'mov', 'webm']],
    ['media.allowed_document_types', ['pdf', 'doc', 'docx', 'ppt', 'pptx']]
  ].map(([key, value]) => upsertOne(SystemConfiguration, { key }, {
    key,
    value,
    isEncrypted: false,
    updatedBy: adminUser._id
  })))

  await seedRuntimeDevScenarios({
    roleByName,
    seededPasswordHash,
    adminUser,
    coordinatorUser,
    judgeUserA,
    judgeUserB,
    mentorUser,
    speakerUser
  })
}

const run = async () => {
  try {
    await connect()
    await initIndexes()
    await seedSampleData()
    // eslint-disable-next-line no-console
    console.log('Database initialized with historical sample data and runtime dev scenarios successfully.')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()
