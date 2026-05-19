import mongoose from 'mongoose'
import { env } from '#configs/environment.js'

import User from '#models/user.model.js'
import Role from '#models/role.model.js'
import Permission from '#models/permission.model.js'
import Event from '#models/event.model.js'
import TimelineEvent from '#models/timelineEvent.model.js'
import Workshop from '#models/workshop.model.js'
import WorkshopQuestion from '#models/workshopQuestion.model.js'
import WorkshopFeedback from '#models/workshopFeedback.model.js'
import Track from '#models/track.model.js'
import Round from '#models/round.model.js'
import JudgingBoard from '#models/judgingBoard.model.js'
import Participant from '#models/participant.model.js'
import Team from '#models/team.model.js'
import Repository from '#models/repository.model.js'
import Commit from '#models/commit.model.js'
import Submission from '#models/submission.model.js'
import Rubric from '#models/rubric.model.js'
import Criterion from '#models/criterion.model.js'
import Score from '#models/score.model.js'
import Ranking from '#models/ranking.model.js'
import Prize from '#models/prize.model.js'
import AiReview from '#models/aiReview.model.js'
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
  Track,
  Round,
  JudgingBoard,
  Participant,
  Team,
  Repository,
  Commit,
  Submission,
  Rubric,
  Criterion,
  Score,
  Ranking,
  Prize,
  AiReview,
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

const seedSampleData = async () => {
  const existingUsers = await User.countDocuments()
  if (existingUsers > 0) {
    return
  }

  const adminRole = await Role.create({
    name: 'ADMIN',
    description: 'System administrator'
  })

  const coordinatorRole = await Role.create({
    name: 'COORDINATOR',
    description: 'Event coordinator'
  })

  const judgeRole = await Role.create({
    name: 'JUDGE',
    description: 'Judge role'
  })

  const mentorRole = await Role.create({
    name: 'MENTOR',
    description: 'Mentor role'
  })

  const userRole = await Role.create({
    name: 'USER',
    description: 'Basic authenticated user'
  })

  const adminUser = await User.create({
    email: 'admin@seal.local',
    passwordHash: 'seeded',
    fullName: 'Admin User',
    status: 'APPROVED',
    roles: [adminRole._id]
  })

  const coordinatorUser = await User.create({
    email: 'coordinator@seal.local',
    passwordHash: 'seeded',
    fullName: 'Event Coordinator',
    status: 'APPROVED',
    roles: [coordinatorRole._id]
  })

  const judgeUser = await User.create({
    email: 'judge@seal.local',
    passwordHash: 'seeded',
    fullName: 'Judge User',
    status: 'APPROVED',
    roles: [judgeRole._id]
  })

  const mentorUser = await User.create({
    email: 'mentor@seal.local',
    passwordHash: 'seeded',
    fullName: 'Mentor User',
    status: 'APPROVED',
    roles: [mentorRole._id]
  })

  const participantUser = await User.create({
    email: 'participant@seal.local',
    passwordHash: 'seeded',
    fullName: 'Participant User',
    status: 'APPROVED',
    roles: [userRole._id]
  })

  const event = await Event.create({
    title: 'SEAL Hackathon 2026',
    description: 'Sample event for database modeling',
    semester: '2026A',
    status: 'ONGOING',
    createdBy: coordinatorUser._id
  })

  const timelineEvent = await TimelineEvent.create({
    eventId: event._id,
    title: 'Opening Workshop',
    description: 'Kickoff session',
    eventType: 'WORKSHOP',
    status: 'SCHEDULED'
  })

  const workshop = await Workshop.create({
    eventId: event._id,
    timelineEventId: timelineEvent._id,
    title: 'Intro to SEAL',
    description: 'Workshop for participants',
    presenterId: mentorUser._id,
    status: 'SCHEDULED'
  })

  await WorkshopQuestion.create({
    workshopId: workshop._id,
    authorId: participantUser._id,
    content: 'What is the submission deadline?',
    voteCount: 3
  })

  await WorkshopFeedback.create({
    workshopId: workshop._id,
    authorId: participantUser._id,
    rating: 5,
    comment: 'Great workshop'
  })

  const track = await Track.create({
    eventId: event._id,
    name: 'Web Development',
    description: 'Web-focused projects'
  })

  const round = await Round.create({
    eventId: event._id,
    trackId: track._id,
    name: 'Preliminary',
    assignedJudgeIds: [judgeUser._id],
    status: 'OPEN'
  })

  const team = await Team.create({
    eventId: event._id,
    trackId: track._id,
    name: 'Team Alpha',
    status: 'ACTIVE'
  })

  await JudgingBoard.create({
    eventId: event._id,
    roundId: round._id,
    name: 'Preliminary Board 1',
    boardNumber: 1,
    teamIds: [team._id],
    judgeIds: [judgeUser._id],
    status: 'ASSIGNED'
  })

  await Participant.create({
    eventId: event._id,
    userId: participantUser._id,
    teamId: team._id,
    teamRole: 'LEADER',
    checkInStatus: 'CHECKED_IN',
    githubAccessStatus: 'GRANTED',
    status: 'ACTIVE',
    joinedAt: new Date()
  })

  const repository = await Repository.create({
    eventId: event._id,
    teamId: team._id,
    githubOrg: 'seal-org',
    repoName: 'team-alpha',
    repoUrl: 'https://github.com/seal-org/team-alpha',
    contributors: [participantUser._id],
    submissionStatus: 'SUBMITTED'
  })

  const commit = await Commit.create({
    repositoryId: repository._id,
    commitSha: 'seeded-commit-sha',
    authorName: 'Participant User',
    authorEmail: 'participant@seal.local',
    message: 'Initial commit'
  })

  const submission = await Submission.create({
    eventId: event._id,
    roundId: round._id,
    teamId: team._id,
    repositoryId: repository._id,
    demoUrl: 'https://example.com/demo',
    reportUrl: 'https://example.com/report',
    presentationUrl: 'https://example.com/presentation',
    submittedAt: new Date(),
    status: 'SUBMITTED'
  })

  const rubric = await Rubric.create({
    eventId: event._id,
    title: 'Default Rubric',
    description: 'Sample rubric',
    totalScore: 100,
    createdBy: coordinatorUser._id
  })

  const criterion = await Criterion.create({
    rubricId: rubric._id,
    name: 'Innovation',
    description: 'Originality and creativity',
    maxScore: 10,
    weight: 1
  })

  await Score.create({
    submissionId: submission._id,
    judgeId: judgeUser._id,
    criterionId: criterion._id,
    scoreValue: 8,
    comment: 'Solid idea'
  })

  await Ranking.create({
    eventId: event._id,
    roundId: round._id,
    trackId: track._id,
    teamId: team._id,
    score: 80,
    rank: 1,
    publishedAt: new Date()
  })

  await Prize.create({
    eventId: event._id,
    title: 'Best Prototype',
    description: 'Top prototype award',
    amount: 500,
    sponsor: 'SEAL',
    teamId: team._id
  })

  await AiReview.create({
    repositoryId: repository._id,
    commitId: commit._id,
    provider: 'SampleAI',
    model: 'v1',
    status: 'COMPLETED',
    summary: 'Codebase looks healthy',
    score: 85,
    requestedBy: coordinatorUser._id,
    requestedAt: new Date(),
    completedAt: new Date()
  })

  await Notification.create({
    userId: participantUser._id,
    title: 'Submission received',
    message: 'Your submission has been recorded.',
    type: 'RESULT',
    status: 'UNREAD'
  })

  await Media.create({
    eventId: event._id,
    uploadedBy: participantUser._id,
    url: 'https://example.com/media/photo.jpg',
    caption: 'Opening ceremony',
    tags: ['event', 'opening']
  })

  await AuditLog.create({
    userId: adminUser._id,
    action: 'SEED_INIT',
    resourceType: 'Event',
    resourceId: event._id,
    metadata: { note: 'Seed data initialization' }
  })

  await SystemConfiguration.create({
    key: 'GITHUB_INTEGRATION',
    value: { org: 'seal-org', enabled: true },
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
    console.log('Database initialized with sample data successfully.')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()
