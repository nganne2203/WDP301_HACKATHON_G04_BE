import mongoose from 'mongoose'

import { env } from '#configs/environment.js'
import { ALL_PERMISSIONS, ROLE_PERMISSION_MAP } from '#constants/permissions.js'
import { BCRYPT_UTILS } from '#utils/bcryptUtil.js'
import { migrateUsersOffRemovedUserRole } from '#utils/removeUserRoleMigration.js'
import User from '#models/user.model.js'
import Role from '#models/role.model.js'
import Permission from '#models/permission.model.js'
import Competition from '#models/competition.model.js'
import TimelineActivity from '#models/timelineActivity.model.js'
import Workshop from '#models/workshop.model.js'
import WorkshopQuestion from '#models/workshopQuestion.model.js'
import WorkshopFeedback from '#models/workshopFeedback.model.js'
import WorkshopRating from '#models/workshopRating.model.js'
import Track from '#models/track.model.js'
import Round from '#models/round.model.js'
import JudgingBoard from '#models/judgingBoard.model.js'
import RoundTeamPlacement from '#models/roundTeamPlacement.model.js'
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
import TechnicalFinding from '#models/technicalFinding.model.js'
import StaticAnalysisResult from '#models/staticAnalysisResult.model.js'
import Notification from '#models/notification.model.js'
import Media from '#models/media.model.js'
import MediaActivity from '#models/mediaActivity.model.js'
import AuditLog from '#models/auditLog.model.js'
import SystemConfiguration from '#models/systemConfiguration.model.js'
import ChatRoom from '#models/chatRoom.model.js'
import ChatParticipant from '#models/chatParticipant.model.js'
import ChatMessage from '#models/chatMessage.model.js'
import CheckInQrSession from '#models/checkInQrSession.model.js'
import { seedCompletedCycleShowcase } from './seeds/completed-cycle.seed.js'

const MODELS = [
  User,
  Role,
  Permission,
  Competition,
  TimelineActivity,
  Workshop,
  WorkshopQuestion,
  WorkshopFeedback,
  WorkshopRating,
  Track,
  Round,
  JudgingBoard,
  RoundTeamPlacement,
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
  Score,
  ScoreSheet,
  Ranking,
  Prize,
  AiReview,
  TechnicalFinding,
  StaticAnalysisResult,
  Notification,
  Media,
  MediaActivity,
  AuditLog,
  SystemConfiguration,
  ChatRoom,
  ChatParticipant,
  ChatMessage,
  CheckInQrSession
]

const ROLE_SEEDS = [
  ['ADMIN', 'System administrator'],
  ['COORDINATOR', 'Competition coordinator'],
  ['COMPETITION_COORDINATOR', 'Competition coordinator'],
  ['JUDGE', 'Judge role'],
  ['MENTOR', 'Mentor role'],
  ['SPEAKER', 'Workshop speaker role'],
  ['PARTICIPANT', 'Hackathon participant']
]

const SEED_EMAIL_DOMAIN = 'seal-hackathon.example.com'

const upsertOne = async (Model, filter, data) => {
  return await Model.findOneAndUpdate(
    filter,
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  )
}

const buildPermissionDescription = (code) => {
  return code
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, char => char.toUpperCase())
}

const seedPermissions = async () => {
  const records = await Promise.all(ALL_PERMISSIONS.map(code => upsertOne(Permission, { code }, {
    code,
    name: buildPermissionDescription(code),
    description: buildPermissionDescription(code),
    module: code.split('_')[0] || 'GENERAL',
    isActive: true
  })))
  return new Map(records.map(permission => [permission.code, permission]))
}

const seedRoles = async (permissionByCode) => {
  const allPermissionIds = [...permissionByCode.values()].map(permission => permission._id)
  const records = await Promise.all(ROLE_SEEDS.map(([name, description]) => {
    const permissionIds = name === 'ADMIN'
      ? allPermissionIds
      : (ROLE_PERMISSION_MAP[name] || []).map(code => {
        const permission = permissionByCode.get(code)
        if (!permission) throw new Error(`Missing permission seed for ${code}`)
        return permission._id
      })

    return upsertOne(Role, { name }, {
      name,
      code: name,
      description,
      permissions: permissionIds,
      isSystemRole: true,
      isActive: true
    })
  }))
  return new Map(records.map(role => [role.name, role]))
}

const seedBaseUser = async ({ localPart, legacyEmail, fullName, roleId, passwordHash }) => {
  const email = `${localPart}@${SEED_EMAIL_DOMAIN}`
  const filter = legacyEmail ? { $or: [{ email }, { email: legacyEmail }] } : { email }
  return await upsertOne(User, filter, {
    email,
    authProvider: 'LOCAL',
    passwordHash,
    fullName,
    githubUsername: `seal-demo-${localPart.replaceAll('.', '-')}`,
    status: 'ACTIVE',
    roles: [roleId]
  })
}

const initIndexes = async () => {
  for (const model of MODELS) await model.syncIndexes()
}

const seedRequiredData = async () => {
  const permissionByCode = await seedPermissions()
  const roleByName = await seedRoles(permissionByCode)
  await migrateUsersOffRemovedUserRole({ userModel: User, roleModel: Role })

  const passwordHash = await BCRYPT_UTILS.hashPassword('Password123!')
  const [adminUser, coordinatorUser, mentorUser, speakerUser] = await Promise.all([
    seedBaseUser({ localPart: 'admin', legacyEmail: 'admin@seal.local', fullName: 'Admin User', roleId: roleByName.get('ADMIN')._id, passwordHash }),
    seedBaseUser({ localPart: 'coordinator', legacyEmail: 'coordinator@seal.local', fullName: 'Competition Coordinator', roleId: roleByName.get('COORDINATOR')._id, passwordHash }),
    seedBaseUser({ localPart: 'mentor', legacyEmail: 'mentor@seal.local', fullName: 'Mentor User', roleId: roleByName.get('MENTOR')._id, passwordHash }),
    seedBaseUser({ localPart: 'speaker', legacyEmail: 'speaker@seal.local', fullName: 'Speaker User', roleId: roleByName.get('SPEAKER')._id, passwordHash })
  ])

  await seedCompletedCycleShowcase({
    roleByName,
    seededPasswordHash: passwordHash,
    adminUser,
    coordinatorUser,
    mentorUser,
    speakerUser
  })
}

const run = async () => {
  try {
    if (!env.db?.uri) throw new Error('MONGODB_URI is not set')
    await mongoose.connect(env.db.uri)
    await initIndexes()
    await seedRequiredData()
    // eslint-disable-next-line no-console
    console.log('Database initialized with required RBAC/accounts and the completed SEAL Hackathon Spring 2026 competition successfully.')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

void run()
