import mongoose from 'mongoose'
import { env } from '#configs/environment.js'
import { ALL_PERMISSIONS, ROLE_PERMISSION_MAP } from '#constants/permissions.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'

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
import Submission from '#models/submission.model.js'
import Rubric from '#models/rubric.model.js'
import Criterion from '#models/criterion.model.js'
import Score from '#models/score.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'
import Ranking from '#models/ranking.model.js'
import Prize from '#models/prize.model.js'
import AiReview from '#models/aiReview.model.js'
import AiReviewCriterion from '#models/aiReviewCriterion.model.js'
import Notification from '#models/notification.model.js'
import Media from '#models/media.model.js'
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
  Submission,
  Rubric,
  Criterion,
  ScoreSheet,
  Score,
  Ranking,
  Prize,
  AiReview,
  AiReviewCriterion,
  Notification,
  Media,
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

const buildPermissionDescription = (code) => {
  return code
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (char) => char.toUpperCase())
}

const ROLE_SEEDS = [
  ['ADMIN', 'System administrator'],
  ['COORDINATOR', 'Event coordinator'],
  ['EVENT_COORDINATOR', 'Event coordinator'],
  ['JUDGE', 'Judge role'],
  ['MENTOR', 'Mentor role'],
  ['SPEAKER', 'Workshop speaker role'],
  ['USER', 'Basic authenticated user'],
  ['PARTICIPANT', 'Hackathon participant']
]

const LEGACY_ROLE_NAME_MAP = {
  ADMIN: 'ADMIN',
  COORDINATOR: 'COORDINATOR',
  EVENT_COORDINATOR: 'EVENT_COORDINATOR',
  JUDGE: 'JUDGE',
  MENTOR: 'MENTOR',
  SPEAKER: 'SPEAKER',
  USER: 'USER',
  PARTICIPANT: 'PARTICIPANT',
  TEAM_LEADER: 'PARTICIPANT'
}

const SEED_EMAIL_DOMAIN = 'seal-hackathon.example.com'

const buildSeedEmail = (localPart) => `${localPart}@${SEED_EMAIL_DOMAIN}`

const getLegacyRoleName = (value) => {
  if (!value) return null
  if (typeof value === 'object' && value.name) {
    return getLegacyRoleName(value.name)
  }

  const normalizedRole = String(value).trim().toUpperCase()
  return LEGACY_ROLE_NAME_MAP[normalizedRole] || null
}

const seedPermissions = async () => {
  const permissionRecords = await Promise.all(ALL_PERMISSIONS.map((code) => {
    return upsertOne(Permission, { code }, {
      code,
      description: buildPermissionDescription(code)
    })
  }))

  return new Map(permissionRecords.map((permission) => [permission.code, permission]))
}

const seedRoles = async (permissionByCode) => {
  const roleRecords = await Promise.all(ROLE_SEEDS.map(([name, description]) => {
    const permissionIds = (ROLE_PERMISSION_MAP[name] || []).map((code) => {
      const permission = permissionByCode.get(code)
      if (!permission) {
        throw new Error(`Missing permission seed for ${code}`)
      }
      return permission._id
    })

    return upsertOne(Role, { name }, {
      name,
      description,
      permissions: permissionIds
    })
  }))

  return new Map(roleRecords.map((role) => [role.name, role]))
}

const normalizeLegacyRoleIds = (user, roleByName) => {
  const roleIds = []
  const seenRoleIds = new Set()
  const rawRoles = Array.isArray(user.roles) ? user.roles : []
  const roleValues = [user.role, ...rawRoles]

  for (const roleValue of roleValues) {
    if (!roleValue) continue

    let roleId = null
    if (roleValue instanceof mongoose.Types.ObjectId) {
      roleId = roleValue
    } else if (typeof roleValue === 'object' && roleValue._id) {
      roleId = roleValue._id
    } else if (typeof roleValue === 'string' && mongoose.Types.ObjectId.isValid(roleValue)) {
      roleId = new mongoose.Types.ObjectId(roleValue)
    } else {
      const roleName = getLegacyRoleName(roleValue)
      roleId = roleName ? roleByName.get(roleName)?._id : null
    }

    if (!roleId) continue
    const roleIdValue = roleId.toString()
    if (seenRoleIds.has(roleIdValue)) continue
    seenRoleIds.add(roleIdValue)
    roleIds.push(roleId)
  }

  return roleIds
}

const repairLegacyUserRoles = async (roleByName) => {
  const users = await User.collection.find({}, { projection: { _id: 1, role: 1, roles: 1 } }).toArray()
  const operations = users
    .map((user) => {
      const roleIds = normalizeLegacyRoleIds(user, roleByName)
      if (roleIds.length === 0) return null

      const currentRoleIds = (Array.isArray(user.roles) ? user.roles : []).map(role => role?.toString()).filter(Boolean)
      const nextRoleIds = roleIds.map(role => role.toString())
      const hasSameRoles = currentRoleIds.length === nextRoleIds.length &&
        currentRoleIds.every((roleId, index) => roleId === nextRoleIds[index])
      const hasLegacyRoleField = Object.prototype.hasOwnProperty.call(user, 'role')

      if (hasSameRoles && !hasLegacyRoleField) return null

      return {
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: { roles: roleIds },
            $unset: { role: '' }
          }
        }
      }
    })
    .filter(Boolean)

  if (operations.length > 0) {
    await User.collection.bulkWrite(operations)
  }
}

const seedBaseUser = async ({ email, legacyEmail, fullName, roleId, passwordHash, extra = {} }) => {
  const filter = legacyEmail ? { $or: [{ email }, { email: legacyEmail }] } : { email }

  return await upsertOne(User, filter, {
    email,
    authProvider: 'LOCAL',
    passwordHash,
    fullName,
    status: 'APPROVED',
    roles: [roleId],
    ...extra
  })
}

const seedSampleData = async () => {
  const permissionByCode = await seedPermissions()
  const roleByName = await seedRoles(permissionByCode)
  await repairLegacyUserRoles(roleByName)

  const adminRole = roleByName.get('ADMIN')
  const coordinatorRole = roleByName.get('COORDINATOR')
  const judgeRole = roleByName.get('JUDGE')
  const mentorRole = roleByName.get('MENTOR')
  const userRole = roleByName.get('USER')

  const seededPasswordHash = await BCRYPT_UTILS.hashPassword('Password123!')
  const adminUser = await seedBaseUser({ email: buildSeedEmail('admin'), legacyEmail: 'admin@seal.local', fullName: 'Admin User', roleId: adminRole._id, passwordHash: seededPasswordHash })
  const coordinatorUser = await seedBaseUser({ email: buildSeedEmail('coordinator'), legacyEmail: 'coordinator@seal.local', fullName: 'Event Coordinator', roleId: coordinatorRole._id, passwordHash: seededPasswordHash })
  const judgeUserA = await seedBaseUser({ email: buildSeedEmail('judge.a'), legacyEmail: 'judge.a@seal.local', fullName: 'Judge A', roleId: judgeRole._id, passwordHash: seededPasswordHash })
  const judgeUserB = await seedBaseUser({ email: buildSeedEmail('judge.b'), legacyEmail: 'judge.b@seal.local', fullName: 'Judge B', roleId: judgeRole._id, passwordHash: seededPasswordHash })
  const mentorUser = await seedBaseUser({ email: buildSeedEmail('mentor'), legacyEmail: 'mentor@seal.local', fullName: 'Mentor User', roleId: mentorRole._id, passwordHash: seededPasswordHash })

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
    finalistSlotsPerTrack: 5,
    totalFinalistSlots: 10,
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
    const team = await upsertOne(Team, { eventId: event._id, name: teamName }, {
      eventId: event._id,
      trackId: track._id,
      name: teamName,
      chapterName,
      projectName,
      trackAssignmentMethod: 'DRAW',
      trackAssignedAt: buildDate('2025-11-01T15:00:00+07:00'),
      qualificationStatus: isFinalist ? 'FINALIST' : 'ELIMINATED',
      status: 'ACTIVE'
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
        roleId: userRole._id,
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
        status: 'ACTIVE',
        joinedAt: buildDate('2025-10-10T09:00:00+07:00')
      })

      members.push(user)
      participantRecords.push(participant)
    }

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
    maxPromotedTeams: 5,
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
    maxPromotedTeams: 5,
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
      provider: 'SampleAI',
      model: 'fall-2025-evaluator',
      status: 'COMPLETED',
      summary: 'Seeded AI review result for hackathon repository.',
      score: record.preliminaryScore,
      requestedBy: coordinatorUser._id,
      requestedAt: buildDate('2025-11-02T14:30:00+07:00'),
      completedAt: buildDate('2025-11-02T14:35:00+07:00')
    })
    aiReviewByTeamId.set(record.team._id.toString(), aiReview)

    const preliminaryAiCriteria = await Promise.all(preliminaryCriteria.map((criterion, order) => {
      const aiSuggestedScore = Math.min(criterion.maxScore, Math.round(record.preliminaryScore * (criterion.maxScore / preliminaryRubric.totalScore)))

      return upsertOne(AiReviewCriterion, { aiReviewId: aiReview._id, code: `PRELIMINARY_${order + 1}` }, {
        aiReviewId: aiReview._id,
        criterionId: criterion._id,
        code: `PRELIMINARY_${order + 1}`,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        score: aiSuggestedScore,
        weight: criterion.weight,
        feedback: 'Seeded AI criterion feedback aligned with the preliminary rubric.',
        suggestions: ['Judges should review AI suggestions before submitting final scores.'],
        evidence: [`Commit diff cache ${commitDiff.diffHash}`],
        order: order + 1
      })
    }))
    const preliminaryAiCriterionByCriterionId = new Map(preliminaryAiCriteria.map((aiCriterion) => [aiCriterion.criterionId.toString(), aiCriterion]))

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
      const aiReviewCriterion = preliminaryAiCriterionByCriterionId.get(criterion._id.toString())
      const isOverridden = Boolean(aiReviewCriterion && aiReviewCriterion.score !== scoreValue)

      return upsertOne(Score, { submissionId: preliminarySubmission._id, judgeId, criterionId: criterion._id }, {
        submissionId: preliminarySubmission._id,
        scoreSheetId: preliminaryScoreSheet._id,
        judgeId,
        criterionId: criterion._id,
        aiReviewCriterionId: aiReviewCriterion?._id,
        aiSuggestedScore: aiReviewCriterion?.score,
        scoreValue,
        isOverridden,
        overrideReason: isOverridden ? 'Judge adjusted the AI-suggested score after review.' : null,
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
      const aiSuggestedScore = Math.min(criterion.maxScore, Math.round(finalScores[index] * (criterion.maxScore / finalRubric.totalScore)))

      return upsertOne(AiReviewCriterion, { aiReviewId: aiReview._id, code: `FINAL_${order + 1}` }, {
        aiReviewId: aiReview._id,
        criterionId: criterion._id,
        code: `FINAL_${order + 1}`,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        score: aiSuggestedScore,
        weight: criterion.weight,
        feedback: 'Seeded AI criterion feedback aligned with the final rubric.',
        suggestions: ['Judges should review AI suggestions before submitting final scores.'],
        evidence: [`Repository ${repository.repoName}`],
        order: preliminaryCriteria.length + order + 1
      })
    }))
    const finalAiCriterionByCriterionId = new Map(finalAiCriteria.map((aiCriterion) => [aiCriterion.criterionId.toString(), aiCriterion]))

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
        const aiReviewCriterion = finalAiCriterionByCriterionId.get(criterion._id.toString())
        const isOverridden = Boolean(aiReviewCriterion && aiReviewCriterion.score !== scoreValue)

        return upsertOne(Score, { submissionId: finalSubmission._id, judgeId: judge._id, criterionId: criterion._id }, {
          submissionId: finalSubmission._id,
          scoreSheetId: finalScoreSheet._id,
          judgeId: judge._id,
          criterionId: criterion._id,
          aiReviewCriterionId: aiReviewCriterion?._id,
          aiSuggestedScore: aiReviewCriterion?.score,
          scoreValue,
          isOverridden,
          overrideReason: isOverridden ? 'Judge adjusted the AI-suggested score after review.' : null,
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

  await upsertOne(Media, { url: 'https://example.com/media/seal-fall-2025-awards.jpg' }, {
    eventId: event._id,
    uploadedBy: coordinatorUser._id,
    url: 'https://example.com/media/seal-fall-2025-awards.jpg',
    caption: 'SEAL Hackathon Fall 2025 award ceremony',
    tags: ['event', 'fall-2025', 'awards']
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
      finalistSlotsPerTrack: 5,
      totalFinalistSlots: 10,
      prizeSlots: 6
    },
    isEncrypted: false,
    updatedBy: adminUser._id
  })
}

const run = async () => {
  try {
    await connect()
    await initIndexes()
    await seedSampleData()
    // eslint-disable-next-line no-console
    console.log('Database initialized with SEAL Hackathon Fall 2025 sample data successfully.')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()
