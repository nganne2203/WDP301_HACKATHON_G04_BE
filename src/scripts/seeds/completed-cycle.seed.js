import User from '#models/user.model.js'
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
import StaticAnalysisResult from '#models/staticAnalysisResult.model.js'
import Submission from '#models/submission.model.js'
import Rubric from '#models/rubric.model.js'
import Criterion from '#models/criterion.model.js'
import Score from '#models/score.model.js'
import ScoreSheet from '#models/scoreSheet.model.js'
import Ranking from '#models/ranking.model.js'
import Prize from '#models/prize.model.js'
import AiReview from '#models/aiReview.model.js'
import TechnicalFinding from '#models/technicalFinding.model.js'
import Notification from '#models/notification.model.js'
import Media from '#models/media.model.js'
import MediaActivity from '#models/mediaActivity.model.js'
import AuditLog from '#models/auditLog.model.js'
import SystemConfiguration from '#models/systemConfiguration.model.js'
import ChatRoom from '#models/chatRoom.model.js'
import ChatParticipant from '#models/chatParticipant.model.js'
import ChatMessage from '#models/chatMessage.model.js'
import GitHubWebhookEvent from '#models/githubWebhookEvent.model.js'
import CheckInQrSession from '#models/checkInQrSession.model.js'

const upsertOne = async (Model, filter, data) => {
  return await Model.findOneAndUpdate(
    filter,
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  )
}

const at = (value) => new Date(value)
const COMPETITION_KEY = { seriesName: 'SEAL Hackathon', season: 'SPRING', year: 2026 }
const EMAIL_DOMAIN = 'spring-2026.seal.example.com'

const TRACK_DEFINITIONS = [
  {
    code: 'A',
    name: 'Requirement & Architecture',
    description: 'Domain analysis, requirements, RAG architecture, and solution design.',
    examDriveUrl: 'https://drive.google.com/drive/folders/1SEALSpring2026TrackA',
    judges: ['Demo Judge A1', 'Demo Judge A2'],
    teams: [
      ['Đẹp trai có gì sai', 79.75, 3], ['Epoch 0', 68.25, 5], ['food enjoyer', 0, 8],
      ['NEWBIES', 67.25, 6], ['ORTT', 70.1, 4], ['Slothub', 82.825, 2],
      ['THE ORCA', 85, 1], ['Try', 66.05, 7]
    ]
  },
  {
    code: 'B',
    name: 'Coding, Testing & Deployment',
    description: 'Implementation, testing, execution, reporting, and deployment of the RAG solution.',
    examDriveUrl: 'https://drive.google.com/drive/folders/1SEALSpring2026TrackB',
    judges: ['Demo Judge B1', 'Demo Judge B2'],
    teams: [
      ['5 anh em siêu nhân', 73, 5], ['APX', 74.5, 4], ['Aqua team', 78, 1],
      ['FULI', 65, 7], ['NGUHANHSON', 65, 7], ['RAGnarok', 77, 2],
      ['VAIK', 75.5, 3], ['WhaleDone', 65.5, 6]
    ]
  },
  {
    code: 'C',
    name: 'AI RAG Product & Experience',
    description: 'Domain-specific RAG product quality, interaction experience, and practical impact.',
    examDriveUrl: 'https://drive.google.com/drive/folders/1SEALSpring2026TrackC',
    judges: ['Demo Judge C1', 'Demo Judge C2'],
    teams: [
      ['404NotFound', 74.25, 3], ['BitMindz', 58.5, 8], ['KQL', 74, 4],
      ['LearningAgent', 72.75, 5], ['Passion Ducks', 0, 9], ['Red Team Gang', 81, 2],
      ['Underrated', 59.5, 7], ['WORKA GANG', 87.25, 1], ['YAG', 65.25, 6]
    ]
  }
]

const FINAL_RESULTS = [
  ['Aqua team', 84.1, 1],
  ['THE ORCA', 80.3, 2],
  ['RAGnarok', 72.2, 3],
  ['Slothub', 71, 4],
  ['Red Team Gang', 70.1, 5],
  ['WORKA GANG', 60.6, 6]
]

const PRELIMINARY_CRITERIA = [
  ['Domain accuracy and relevance', 'Accuracy, evidence quality, and fit with the selected domain.', 30],
  ['Agentic RAG architecture and algorithms', 'Retrieval, agent design, grounding, and technical reasoning.', 30],
  ['Idea and presentation', 'Originality, communication, and demonstration quality.', 15],
  ['Feasibility and creativity', 'Implementation feasibility and creative problem solving.', 15],
  ['User experience and interaction', 'Usability and quality of the interactive experience.', 10]
]

const FINAL_CRITERIA = [
  ['Data processing and retrieval quality', 'Quality of ingestion, indexing, retrieval, and response construction.', 30],
  ['Reliability and hallucination resistance', 'Grounding, evaluation, citations, and hallucination control.', 20],
  ['Agent reasoning and multi-stage processing', 'Agent workflow quality and multi-step reasoning.', 20],
  ['Practicality and operational optimization', 'Deployment feasibility, performance, and operations.', 20],
  ['Scalability and innovation', 'Ability to extend the solution and originality of the approach.', 10]
]

const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const seedParticipantUser = async ({ localPart, fullName, participantRoleId, passwordHash, studentId }) => {
  const email = `${localPart}@${EMAIL_DOMAIN}`
  const githubUsername = `sp26-${localPart.replaceAll('.', '-')}`
  return await upsertOne(User, { email }, {
    email,
    authProvider: 'LOCAL',
    passwordHash,
    fullName,
    githubUsername,
    status: 'ACTIVE',
    roles: [participantRoleId],
    studentType: 'FPT',
    studentId
  })
}

const seedRubric = async ({ competitionId, title, createdBy, definitions }) => {
  const rubric = await upsertOne(Rubric, { competitionId, title }, {
    competitionId,
    title,
    description: 'Official judge-only rubric for the completed-cycle showcase.',
    totalScore: 100,
    version: 1,
    status: 'ACTIVE',
    createdBy
  })

  const criteria = await Promise.all(definitions.map(([name, description, weight], index) => {
    return upsertOne(Criterion, { rubricId: rubric._id, name }, {
      rubricId: rubric._id,
      name,
      description,
      maxScore: 10,
      weight: weight / 10,
      order: index + 1,
      judgeOnly: true,
      aiSupportForAudit: true,
      aiInstruction: 'Use AI findings only as supporting evidence; the judge decides the official score.'
    })
  }))

  return { rubric, criteria }
}

const seedScoreSheet = async ({
  competitionId,
  roundId,
  boardId,
  teamId,
  submissionId,
  judgeId,
  rubricId,
  criteria,
  targetScore,
  criterionDeltas,
  submittedAt
}) => {
  const sheet = await upsertOne(ScoreSheet, { roundId, teamId, judgeId }, {
    competitionId,
    roundId,
    boardId,
    teamId,
    submissionId,
    judgeId,
    rubricId,
    scoreIds: [],
    generalComment: 'Complete submission with traceable evidence. Scores were entered by the assigned judge.',
    status: 'LOCKED',
    submittedAt,
    lockedAt: submittedAt
  })

  const baseValue = Number(targetScore) / 10
  const values = criteria.map((criterion, index) => {
    return Number(Math.max(0, Math.min(10, baseValue + (criterionDeltas[index] || 0))).toFixed(3))
  })
  const scoreLines = await Promise.all(criteria.map((criterion, index) => {
    return upsertOne(Score, { submissionId, judgeId, criterionId: criterion._id }, {
      submissionId,
      scoreSheetId: sheet._id,
      judgeId,
      criterionId: criterion._id,
      scoreValue: values[index],
      comment: `Evidence reviewed for ${criterion.name}.`,
      isOverridden: false
    })
  }))
  const total = values.reduce((sum, value) => sum + value, 0)
  const weightedTotal = values.reduce((sum, value, index) => {
    return sum + (value * Number(criteria[index].weight || 1))
  }, 0)

  return await upsertOne(ScoreSheet, { _id: sheet._id }, {
    scoreIds: scoreLines.map(item => item._id),
    totalScore: total,
    weightedScore: Number(weightedTotal.toFixed(3)),
    finalScore: Number(weightedTotal.toFixed(3))
  })
}

export const seedCompletedCycleShowcase = async ({
  roleByName,
  seededPasswordHash,
  adminUser,
  coordinatorUser,
  mentorUser,
  speakerUser
}) => {
  const participantRole = roleByName.get('PARTICIPANT')
  const judgeRole = roleByName.get('JUDGE')
  const judgeNames = [...new Set([
    ...TRACK_DEFINITIONS.flatMap(track => track.judges),
    'Demo Final Judge 1',
    'Demo Final Judge 2',
    'Demo Final Judge 3',
    'Demo Final Judge 4',
    'Demo Final Judge 5'
  ])]
  const judgeUsers = await Promise.all(judgeNames.map((fullName, index) => {
    return upsertOne(User, { email: `judge.sp26.${index + 1}@${EMAIL_DOMAIN}` }, {
      email: `judge.sp26.${index + 1}@${EMAIL_DOMAIN}`,
      authProvider: 'LOCAL',
      passwordHash: seededPasswordHash,
      fullName,
      githubUsername: `seal-sp26-judge-${String(index + 1).padStart(2, '0')}`,
      status: 'ACTIVE',
      roles: [judgeRole._id]
    })
  }))
  const judgeByName = new Map(judgeUsers.map(user => [user.fullName, user]))
  const finalJudges = judgeNames.slice(6).map(name => judgeByName.get(name))
  const competition = await upsertOne(Competition, COMPETITION_KEY, {
    ...COMPETITION_KEY,
    title: 'SEAL Hackathon Spring 2026',
    description: 'The second season of the Software Engineering Agile League, focused on building reliable domain-specific Retrieval-Augmented Generation systems for complex knowledge problems.',
    semester: 'Spring 2026',
    theme: 'Mastering Domain-Specific AI RAG Systems',
    registrationStart: at('2026-03-16T08:00:00+07:00'),
    registrationEnd: at('2026-04-05T23:59:59+07:00'),
    registrationClosedAt: at('2026-04-06T00:00:00+07:00'),
    registrationCloseReason: 'REGISTRATION_ENDED',
    startDate: at('2026-04-09T20:00:00+07:00'),
    endDate: at('2026-04-12T19:00:00+07:00'),
    maxTeams: 30,
    minTeamMembers: 3,
    maxTeamMembers: 5,
    competitionConfig: {
      boardCount: 3,
      trackCount: 3,
      maxTeamsPerBoard: 9,
      finalistCount: 6,
      finalistsPerBoard: 2,
      finalistSelectionMode: 'FIXED_PER_BOARD',
      fillRemainingFinalistsByOverallScore: false,
      rankingScopes: ['TEAM'],
      tieBreakRule: 'Penalty evaluation through judge questions or a 10-minute mini test.',
      tieBreakDurationMinutes: 10
    },
    finalistSlotsPerTrack: 2,
    totalFinalistSlots: 6,
    status: 'COMPLETED',
    createdBy: coordinatorUser._id
  })

  const timelineDefinitions = [
    ['Registration period', 'OTHER', 'COMPLETED', '2026-03-16T08:00:00+07:00', '2026-04-05T23:59:59+07:00'],
    ['The RAG Revolution Workshop', 'WORKSHOP', 'COMPLETED', '2026-04-09T20:00:00+07:00', '2026-04-09T21:30:00+07:00'],
    ['Opening, track draw and team meeting', 'CEREMONY', 'COMPLETED', '2026-04-11T14:00:00+07:00', '2026-04-11T17:00:00+07:00'],
    ['Competition-day check-in', 'CHECK_IN', 'COMPLETED', '2026-04-12T05:30:00+07:00', '2026-04-12T07:00:00+07:00'],
    ['Seven-hour coding window', 'ROUND', 'COMPLETED', '2026-04-12T07:00:00+07:00', '2026-04-12T14:00:00+07:00'],
    ['Preliminary presentations and scoring', 'ROUND', 'COMPLETED', '2026-04-12T14:00:00+07:00', '2026-04-12T16:15:00+07:00'],
    ['Final presentations and scoring', 'ROUND', 'COMPLETED', '2026-04-12T16:30:00+07:00', '2026-04-12T18:30:00+07:00'],
    ['Closing and awards', 'RESULT_PUBLISHING', 'COMPLETED', '2026-04-12T18:30:00+07:00', '2026-04-12T19:00:00+07:00']
  ]
  const timelines = await Promise.all(timelineDefinitions.map(([title, activityType, status, startTime, endTime]) => {
    return upsertOne(TimelineActivity, { competitionId: competition._id, title }, {
      competitionId: competition._id,
      title,
      description: `${title} for the completed-cycle showcase.`,
      activityType,
      status,
      startTime: at(startTime),
      endTime: at(endTime)
    })
  }))

  const workshop = await upsertOne(Workshop, { competitionId: competition._id, title: 'The RAG Revolution: Transforming Complex Data into Actionable Domain Insights' }, {
    competitionId: competition._id,
    timelineActivityId: timelines[1]._id,
    title: 'The RAG Revolution: Transforming Complex Data into Actionable Domain Insights',
    description: 'Official online training on domain-specific datasets, retrieval, grounding, agentic RAG, evaluation, and actionable domain insights.',
    presenterId: speakerUser._id,
    speakerInfo: { name: speakerUser.fullName, title: 'Program Speaker', email: speakerUser.email },
    meetLink: 'https://meet.google.com/seal-spring-2026',
    startTime: timelines[1].startTime,
    endTime: timelines[1].endTime,
    questionnaire: ['How should a team evaluate retrieval quality?', 'How can a RAG system reduce hallucinations?'],
    status: 'COMPLETED'
  })

  const tracks = await Promise.all(TRACK_DEFINITIONS.map(({ code, name, description, teams }) => {
    return upsertOne(Track, { competitionId: competition._id, code }, {
      competitionId: competition._id,
      code,
      name: `Board ${code} — ${name}`,
      description,
      type: 'PRELIMINARY_GROUP',
      teamIds: [],
      maxTeams: teams.length,
      status: 'COMPLETED'
    })
  }))

  const officialTeams = []
  for (const [trackIndex, track] of tracks.entries()) {
    const trackDefinition = TRACK_DEFINITIONS[trackIndex]
    for (const [definitionIndex, [name, preliminaryScore, preliminaryRank]] of trackDefinition.teams.entries()) {
      const teamIndex = definitionIndex + 1
      const boardCode = trackDefinition.code
      const padded = String(teamIndex).padStart(2, '0')
      const memberCount = 3 + ((teamIndex - 1) % 3)
      let team = await upsertOne(Team, { competitionId: competition._id, name }, {
        competitionId: competition._id,
        trackId: track._id,
        mentorIds: [mentorUser._id],
        name,
        chapterName: ['SE', 'AI', 'Cloud', 'QA', 'UX'][teamIndex % 5],
        projectName: `${name} Domain-Specific RAG`,
        trackAssignmentMethod: 'DRAW',
        boardNumber: trackIndex + 1,
        placementSlot: teamIndex,
        trackAssignedAt: at('2026-04-11T15:00:00+07:00'),
        qualificationStatus: preliminaryRank <= 2 ? 'FINALIST' : 'ELIMINATED',
        status: 'CONFIRMED',
        confirmedAt: at('2026-04-04T10:00:00+07:00')
      })

      const members = []
      const participants = []
      for (let memberIndex = 1; memberIndex <= memberCount; memberIndex += 1) {
        const user = await seedParticipantUser({
          localPart: `showcase.${boardCode.toLowerCase()}${padded}.member${memberIndex}`,
          fullName: `${name} Member ${memberIndex}`,
          participantRoleId: participantRole._id,
          passwordHash: seededPasswordHash,
          studentId: `SC26${boardCode}${padded}${memberIndex}`
        })
        const participant = await upsertOne(Participant, { competitionId: competition._id, userId: user._id }, {
          competitionId: competition._id,
          userId: user._id,
          teamId: team._id,
          chapterName: team.chapterName,
          teamRole: memberIndex === 1 ? 'LEADER' : 'MEMBER',
          isGraduated: false,
          consentMediaUse: true,
          eligibilityStatus: 'ELIGIBLE',
          attendedActivities: ['WORKSHOP', 'OPENING', 'TEAM_MEETING', 'CODING', 'PRESENTATION', 'CLOSING'],
          checkInStatus: 'CHECKED_IN',
          checkedInAt: at(`2026-04-12T06:${String((trackIndex * 10 + teamIndex + memberIndex) % 55).padStart(2, '0')}:00+07:00`),
          checkedInBy: coordinatorUser._id,
          githubAccessStatus: 'REVOKED',
          status: 'JOINED',
          joinedAt: at('2026-04-03T09:00:00+07:00')
        })
        members.push(user)
        participants.push(participant)
      }
      team = await upsertOne(Team, { _id: team._id }, {
        leaderId: members[0]._id,
        memberIds: members.map(member => member._id)
      })
      officialTeams.push({
        team,
        track,
        trackIndex,
        teamIndex,
        preliminaryScore,
        preliminaryRank,
        members,
        participants
      })
    }
  }

  for (const [trackIndex, track] of tracks.entries()) {
    const boardCode = TRACK_DEFINITIONS[trackIndex].code
    for (const scenario of ['REJECTED', 'CANCELLED']) {
      const name = `Showcase ${boardCode} ${scenario === 'REJECTED' ? 'Rejected' : 'Late Cancelled'}`
      let team = await upsertOne(Team, { competitionId: competition._id, name }, {
        competitionId: competition._id,
        trackId: track._id,
        name,
        chapterName: 'SE',
        projectName: `${scenario} registration scenario`,
        trackAssignmentMethod: 'MANUAL',
        qualificationStatus: 'REGISTERED',
        status: scenario,
        ...(scenario === 'REJECTED'
          ? { rejectedAt: at('2026-04-06T00:05:00+07:00'), rejectionReason: 'Team did not satisfy eligibility requirements before registration closed.' }
          : { cancelledAt: at('2026-04-12T08:01:00+07:00'), cancellationReason: 'Team was more than 60 minutes late and was treated as having withdrawn under the official rules.' })
      })
      const members = []
      for (let memberIndex = 1; memberIndex <= 3; memberIndex += 1) {
        const user = await seedParticipantUser({
          localPart: `showcase.${boardCode.toLowerCase()}.${scenario.toLowerCase()}.member${memberIndex}`,
          fullName: `${name} Member ${memberIndex}`,
          participantRoleId: participantRole._id,
          passwordHash: seededPasswordHash,
          studentId: `SC26${boardCode}${scenario[0]}${memberIndex}`
        })
        await upsertOne(Participant, { competitionId: competition._id, userId: user._id }, {
          competitionId: competition._id,
          userId: user._id,
          teamId: team._id,
          chapterName: 'SE',
          teamRole: memberIndex === 1 ? 'LEADER' : 'MEMBER',
          eligibilityStatus: scenario === 'REJECTED' ? 'INELIGIBLE' : 'PENDING',
          checkInStatus: 'NOT_CHECKED_IN',
          githubAccessStatus: 'NOT_GRANTED',
          status: scenario === 'CANCELLED' ? 'WITHDRAWN' : 'INVITED'
        })
        members.push(user)
      }
      team = await upsertOne(Team, { _id: team._id }, { leaderId: members[0]._id, memberIds: members.map(user => user._id) })
      await upsertOne(TeamInvitation, { teamId: team._id, invitedEmail: members[1].email }, {
        teamId: team._id,
        invitedEmail: members[1].email,
        invitedBy: members[0]._id,
        tokenHash: `seed-${competition._id}-${trackIndex}-${scenario}`,
        status: scenario === 'CANCELLED' ? 'EXPIRED' : 'CANCELLED',
        expiresAt: at('2026-04-05T23:59:59+07:00'),
        respondedAt: at('2026-04-06T00:00:00+07:00'),
        metadata: { seedScenario: scenario, reason: team.cancellationReason || team.rejectionReason }
      })
    }
  }

  await Promise.all(tracks.map(track => upsertOne(Track, { _id: track._id }, {
    teamIds: officialTeams.filter(record => record.track._id.equals(track._id)).map(record => record.team._id)
  })))

  await upsertOne(CheckInQrSession, { competitionId: competition._id }, {
    competitionId: competition._id,
    tokenHash: `expired-seal-spring-2026-${competition._id}`,
    expiresAt: at('2026-04-12T07:00:00+07:00'),
    createdBy: coordinatorUser._id
  })

  for (const record of officialTeams) {
    const room = await upsertOne(ChatRoom, { teamId: record.team._id }, {
      teamId: record.team._id,
      roomKey: `team:${record.team._id}`
    })
    await Promise.all([
      ...record.members.map(member => upsertOne(ChatParticipant, { chatRoomId: room._id, userId: member._id }, {
        chatRoomId: room._id,
        userId: member._id,
        role: 'member',
        joinedAt: at('2026-04-06T09:00:00+07:00'),
        lastReadAt: at('2026-04-12T19:00:00+07:00')
      })),
      upsertOne(ChatParticipant, { chatRoomId: room._id, userId: mentorUser._id }, {
        chatRoomId: room._id,
        userId: mentorUser._id,
        role: 'mentor',
        joinedAt: at('2026-04-06T09:00:00+07:00'),
        lastReadAt: at('2026-04-12T19:00:00+07:00')
      })
    ])
    await Promise.all([
      upsertOne(ChatMessage, { chatRoomId: room._id, senderId: mentorUser._id, clientMessageId: 'seed-mentor-guidance' }, {
        chatRoomId: room._id,
        teamId: record.team._id,
        senderId: mentorUser._id,
        senderRole: 'mentor',
        message: 'Please verify your submission links, evidence, and final demo checklist before the deadline.',
        messageType: 'text',
        clientMessageId: 'seed-mentor-guidance',
        isSeen: true
      }),
      upsertOne(ChatMessage, { chatRoomId: room._id, senderId: record.members[0]._id, clientMessageId: 'seed-team-confirmation' }, {
        chatRoomId: room._id,
        teamId: record.team._id,
        senderId: record.members[0]._id,
        senderRole: 'member',
        message: 'The team has completed the checklist and is ready to submit.',
        messageType: 'text',
        clientMessageId: 'seed-team-confirmation',
        isSeen: true
      })
    ])
  }

  const { rubric: preliminaryRubric, criteria: preliminaryCriteria } = await seedRubric({
    competitionId: competition._id,
    title: 'SEAL Spring 2026 Preliminary Rubric',
    createdBy: coordinatorUser._id,
    definitions: PRELIMINARY_CRITERIA
  })
  const { rubric: finalRubric, criteria: finalCriteria } = await seedRubric({
    competitionId: competition._id,
    title: 'SEAL Spring 2026 Final Rubric',
    createdBy: coordinatorUser._id,
    definitions: FINAL_CRITERIA
  })

  const preliminaryRounds = []
  const preliminaryBoards = []
  for (const [trackIndex, track] of tracks.entries()) {
    const boardTeams = officialTeams.filter(record => record.trackIndex === trackIndex)
    const promotedTeams = boardTeams.filter(record => record.preliminaryRank <= 2)
    const assignedJudges = TRACK_DEFINITIONS[trackIndex].judges.map(name => judgeByName.get(name))
    const round = await upsertOne(Round, { competitionId: competition._id, trackId: track._id, name: `Preliminary Board ${TRACK_DEFINITIONS[trackIndex].code}` }, {
      competitionId: competition._id,
      trackId: track._id,
      name: `Preliminary Board ${TRACK_DEFINITIONS[trackIndex].code}`,
      roundType: 'PRELIMINARY',
      problemStatement: track.description,
      examDriveUrl: TRACK_DEFINITIONS[trackIndex].examDriveUrl,
      assignedTeamIds: boardTeams.map(record => record.team._id),
      promotedTeamIds: promotedTeams.map(record => record.team._id),
      maxPromotedTeams: 2,
      startTime: at('2026-04-12T07:00:00+07:00'),
      endTime: at('2026-04-12T16:15:00+07:00'),
      submissionOpenAt: at('2026-04-12T07:00:00+07:00'),
      submissionCloseAt: at('2026-04-12T14:00:00+07:00'),
      submissionDeadline: at('2026-04-12T14:00:00+07:00'),
      publishTime: at('2026-04-12T16:20:00+07:00'),
      assignedJudgeIds: assignedJudges.map(user => user._id),
      rubricId: preliminaryRubric._id,
      promotionRule: 'Top two teams in each board advance to the final.',
      tieBreakRule: 'Penalty evaluation or 10-minute mini test.',
      tieBreakDurationMinutes: 10,
      status: 'COMPLETED'
    })
    const board = await upsertOne(JudgingBoard, { competitionId: competition._id, roundId: round._id, boardNumber: trackIndex + 1 }, {
      competitionId: competition._id,
      roundId: round._id,
      trackId: track._id,
      name: `Judging Board ${TRACK_DEFINITIONS[trackIndex].code}`,
      boardNumber: trackIndex + 1,
      teamIds: boardTeams.map(record => record.team._id),
      judgeIds: assignedJudges.map(user => user._id),
      maxTeams: boardTeams.length,
      status: 'COMPLETED'
    })
    preliminaryRounds.push(round)
    preliminaryBoards.push(board)
    await Promise.all(boardTeams.map((record, index) => upsertOne(RoundTeamPlacement, { roundId: round._id, teamId: record.team._id }, {
      competitionId: competition._id,
      roundId: round._id,
      teamId: record.team._id,
      boardId: board._id,
      boardNumber: trackIndex + 1,
      placementSlot: index + 1
    })))
  }

  const finalists = FINAL_RESULTS.map(([teamName]) => officialTeams.find(record => record.team.name === teamName))
  const finalRound = await upsertOne(Round, { competitionId: competition._id, name: 'SEAL Spring 2026 Final' }, {
    competitionId: competition._id,
    name: 'SEAL Spring 2026 Final',
    roundType: 'FINAL',
    problemStatement: 'Present a production-ready solution and defend its measurable impact.',
    examDriveUrl: 'https://drive.google.com/drive/folders/1SEALSpring2026Final',
    assignedTeamIds: finalists.map(record => record.team._id),
    promotedTeamIds: [],
    startTime: at('2026-04-12T16:30:00+07:00'),
    endTime: at('2026-04-12T18:30:00+07:00'),
    submissionOpenAt: at('2026-04-12T16:15:00+07:00'),
    submissionCloseAt: at('2026-04-12T16:45:00+07:00'),
    submissionDeadline: at('2026-04-12T16:45:00+07:00'),
    publishTime: at('2026-04-12T18:40:00+07:00'),
    assignedJudgeIds: finalJudges.map(user => user._id),
    rubricId: finalRubric._id,
    promotionRule: 'Final ranking determines awards.',
    tieBreakRule: 'Mini test and documented judge decision.',
    tieBreakDurationMinutes: 10,
    status: 'COMPLETED'
  })
  const finalBoard = await upsertOne(JudgingBoard, { competitionId: competition._id, roundId: finalRound._id, boardNumber: 1 }, {
    competitionId: competition._id,
    roundId: finalRound._id,
    name: 'Final Judging Board',
    boardNumber: 1,
    teamIds: finalists.map(record => record.team._id),
    judgeIds: finalJudges.map(user => user._id),
    maxTeams: 6,
    status: 'COMPLETED'
  })
  await Promise.all(finalists.map((record, index) => upsertOne(RoundTeamPlacement, { roundId: finalRound._id, teamId: record.team._id }, {
    competitionId: competition._id,
    roundId: finalRound._id,
    teamId: record.team._id,
    boardId: finalBoard._id,
    boardNumber: 1,
    placementSlot: index + 1
  })))

  for (const record of officialTeams) {
    const slug = slugify(record.team.name)
    const repo = await upsertOne(Repository, { teamId: record.team._id }, {
      competitionId: competition._id,
      teamId: record.team._id,
      roundId: preliminaryRounds[record.trackIndex]._id,
      githubOwner: 'seal-hackathon-spring-2026',
      githubRepo: slug,
      repositoryFullName: `seal-hackathon-spring-2026/${slug}`,
      repositoryUrl: `https://github.com/seal-hackathon-spring-2026/${slug}`,
      repoUrl: `https://github.com/seal-hackathon-spring-2026/${slug}`,
      contributors: record.members.map(member => member._id),
      defaultBranch: 'main',
      latestCommitSha: `spring2026${record.trackIndex}${String(record.teamIndex).padStart(2, '0')}`,
      lastProcessedCommitSha: `spring2026${record.trackIndex}${String(record.teamIndex).padStart(2, '0')}`,
      status: 'ARCHIVED',
      accessState: 'REVOKED',
      submissionStatus: 'APPROVED',
      accessGrantedAt: at('2026-04-06T10:00:00+07:00'),
      accessRevokedAt: at('2026-04-13T09:00:00+07:00'),
      webhookStatus: 'REGISTERED',
      webhookRegisteredAt: at('2026-04-06T10:05:00+07:00')
    })
    const sha = repo.latestCommitSha
    const commit = await upsertOne(Commit, { commitSha: sha }, {
      repositoryId: repo._id,
      commitSha: sha,
      branch: 'main',
      provider: 'GITHUB',
      repositoryFullName: repo.repositoryFullName,
      authorName: record.members[0].fullName,
      authorEmail: record.members[0].email,
      timestamp: at('2026-04-12T13:30:00+07:00'),
      message: 'Complete final implementation and presentation evidence',
      commitUrl: `${repo.repositoryUrl}/commit/${sha}`,
      linesAdded: 420 + record.teamIndex,
      linesRemoved: 35,
      filesChanged: 18
    })
    const diff = await upsertOne(CommitDiff, { repositoryId: repo._id, headCommitSha: sha }, {
      repositoryId: repo._id,
      commitId: commit._id,
      baseCommitSha: `${sha}-base`,
      headCommitSha: sha,
      status: 'READY',
      diffHash: `${sha}-diff`,
      diffText: 'Representative source changes for the completed showcase.',
      cleanDiffText: 'Sanitized representative source changes.',
      totalFiles: 18,
      includedFiles: 18,
      excludedFiles: 0,
      fetchedAt: at('2026-04-12T13:35:00+07:00')
    })
    await upsertOne(GitHubWebhookEvent, { deliveryId: `seal-spring-2026-${slug}` }, {
      deliveryId: `seal-spring-2026-${slug}`,
      activityType: 'push',
      repositoryFullName: repo.repositoryFullName,
      repositoryId: repo._id,
      teamId: record.team._id,
      branch: 'main',
      beforeCommitSha: `${sha}-base`,
      afterCommitSha: sha,
      payload: { ref: 'refs/heads/main', seeded: true },
      signatureValid: true,
      status: 'PROCESSED',
      receivedAt: at('2026-04-12T13:30:00+07:00'),
      processedAt: at('2026-04-12T13:38:00+07:00')
    })
    await upsertOne(StaticAnalysisResult, { repositoryId: repo._id, commitSha: sha, source: 'COMMAND_HOOK_ESLINT' }, {
      repositoryId: repo._id,
      commitSha: sha,
      source: 'COMMAND_HOOK_ESLINT',
      status: 'COMPLETED',
      errorCount: 0,
      warningCount: record.teamIndex % 3,
      findings: record.teamIndex % 3 === 0 ? [] : [{
        type: 'STYLE',
        severity: 'LOW',
        filePath: 'src/app.js',
        title: 'Minor maintainability warning',
        message: 'Extract repeated UI logic into a helper.',
        evidence: ['src/app.js']
      }]
    })
    const review = await upsertOne(AiReview, { repositoryId: repo._id, commitSha: sha, reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT' }, {
      competitionId: competition._id,
      teamId: record.team._id,
      roundId: preliminaryRounds[record.trackIndex]._id,
      repositoryId: repo._id,
      commitId: commit._id,
      commitDiffId: diff._id,
      reviewKind: 'TEAM_AGGREGATE_TECHNICAL_AUDIT',
      provider: 'n8n',
      model: 'gemini',
      modelName: 'gemini-2.5-flash',
      promptVersion: 'seal-spring-2026-rag-v1',
      promptInput: { repository: repo.repositoryFullName, objective: record.track.description },
      rawResponse: JSON.stringify({ summary: 'Implementation is complete and demo-ready.', risks: ['Add more load tests before production.'] }),
      normalizedOutput: {
        summary: 'The solution demonstrates a coherent architecture, working end-to-end flow, and traceable evidence.',
        strengths: ['Clear module boundaries', 'Functional test coverage', 'No exposed secrets'],
        risks: ['Load testing depth can be improved'],
        recommendation: 'Accept for judge review; AI evidence must not alter official scores.'
      },
      tokenUsage: { inputTokens: 3200, outputTokens: 780, totalTokens: 3980 },
      commitSha: sha,
      status: 'COMPLETED',
      isScoreBased: false,
      isFinalDecision: false,
      needsHumanReview: true,
      summary: 'Complete implementation with one low-risk performance recommendation.',
      overallSummary: 'AI technical review completed. Official scoring remains judge-only.',
      techStackDetected: ['Node.js', 'React', 'MongoDB'],
      riskSummary: [{ severity: 'LOW', area: 'PERFORMANCE', summary: 'Add peak-load validation.' }],
      details: { architecture: 'Layered modular application', security: 'No critical findings', testing: 'Core flows covered' },
      requestedBy: coordinatorUser._id,
      requestedAt: at('2026-04-12T13:36:00+07:00'),
      completedAt: at('2026-04-12T13:38:00+07:00')
    })
    await upsertOne(TechnicalFinding, { aiReviewId: review._id, title: 'Add peak-load validation' }, {
      aiReviewId: review._id,
      type: 'PERFORMANCE',
      severity: 'LOW',
      title: 'Add peak-load validation',
      evidence: ['Current tests cover functional paths but not competition-day peak concurrency.'],
      comment: 'This is advisory and does not determine the official judge score.',
      recommendedAction: 'Run a small load test before production deployment.'
    })

    const preliminaryRound = preliminaryRounds[record.trackIndex]
    const preliminarySubmission = await upsertOne(Submission, { roundId: preliminaryRound._id, teamId: record.team._id }, {
      competitionId: competition._id,
      roundId: preliminaryRound._id,
      teamId: record.team._id,
      repositoryId: repo._id,
      demoUrl: `https://demo.seal.example.com/${slug}`,
      reportUrl: `https://docs.seal.example.com/${slug}/report.pdf`,
      presentationUrl: `https://docs.seal.example.com/${slug}/slides.pdf`,
      submittedAt: at('2026-04-12T13:50:00+07:00'),
      status: 'ACCEPTED'
    })
    const assignedJudges = TRACK_DEFINITIONS[record.trackIndex].judges.map(name => judgeByName.get(name))
    const judgeTargets = record.preliminaryScore === 0
      ? [0, 0]
      : [record.preliminaryScore - 0.5, record.preliminaryScore + 0.5]
    for (const [judgeIndex, judge] of assignedJudges.entries()) {
      await seedScoreSheet({
        competitionId: competition._id,
        roundId: preliminaryRound._id,
        boardId: preliminaryBoards[record.trackIndex]._id,
        teamId: record.team._id,
        submissionId: preliminarySubmission._id,
        judgeId: judge._id,
        rubricId: preliminaryRubric._id,
        criteria: preliminaryCriteria,
        targetScore: judgeTargets[judgeIndex],
        criterionDeltas: record.preliminaryScore === 0
          ? [0, 0, 0, 0, 0]
          : (judgeIndex === 0 ? [0.4, -0.4, 0.2, -0.2, 0] : [-0.4, 0.4, -0.2, 0.2, 0]),
        submittedAt: at(`2026-04-12T15:${judgeIndex === 0 ? '20' : '30'}:00+07:00`)
      })
    }
    await upsertOne(Ranking, { competitionId: competition._id, rankingType: 'TEAM', roundId: preliminaryRound._id, teamId: record.team._id }, {
      competitionId: competition._id,
      rankingType: 'TEAM',
      roundId: preliminaryRound._id,
      trackId: record.track._id,
      teamId: record.team._id,
      score: record.preliminaryScore,
      rankSortScore: record.preliminaryScore,
      rank: record.preliminaryRank,
      calculationSource: 'OFFICIAL_JUDGE_SCORES_ONLY',
      calculationSummary: { assignedJudges: 2, lockedSheets: 2, aiInfluence: false },
      calculatedAt: at('2026-04-12T16:15:00+07:00'),
      isSelectedForFinal: record.preliminaryRank <= 2,
      selectionReason: record.preliminaryRank <= 2 ? 'Top two team in the preliminary board.' : 'Completed preliminary round.',
      publishedAt: at('2026-04-12T16:20:00+07:00'),
      publishedBy: coordinatorUser._id
    })
  }

  for (const [index, record] of finalists.entries()) {
    const [, actualFinalScore, actualFinalRank] = FINAL_RESULTS[index]
    const repo = await Repository.findOne({ teamId: record.team._id })
    const slug = slugify(record.team.name)
    const submission = await upsertOne(Submission, { roundId: finalRound._id, teamId: record.team._id }, {
      competitionId: competition._id,
      roundId: finalRound._id,
      teamId: record.team._id,
      repositoryId: repo._id,
      demoUrl: `https://demo.seal.example.com/${slug}/final`,
      reportUrl: `https://docs.seal.example.com/${slug}/final-report.pdf`,
      presentationUrl: `https://docs.seal.example.com/${slug}/final-slides.pdf`,
      submittedAt: at('2026-04-12T16:40:00+07:00'),
      status: 'ACCEPTED'
    })
    const judgeOffsets = [-1, -0.5, 0, 0.5, 1]
    for (const [judgeIndex, judge] of finalJudges.entries()) {
      await seedScoreSheet({
        competitionId: competition._id,
        roundId: finalRound._id,
        boardId: finalBoard._id,
        teamId: record.team._id,
        submissionId: submission._id,
        judgeId: judge._id,
        rubricId: finalRubric._id,
        criteria: finalCriteria,
        targetScore: actualFinalScore + judgeOffsets[judgeIndex],
        criterionDeltas: judgeIndex % 2 === 0
          ? [0.4, -0.4, 0.2, -0.4, 0]
          : [-0.4, 0.4, -0.2, 0.4, 0],
        submittedAt: at(`2026-04-12T18:${String(10 + judgeIndex * 3).padStart(2, '0')}:00+07:00`)
      })
    }
    await upsertOne(Ranking, { competitionId: competition._id, rankingType: 'TEAM', roundId: finalRound._id, teamId: record.team._id }, {
      competitionId: competition._id,
      rankingType: 'TEAM',
      roundId: finalRound._id,
      teamId: record.team._id,
      score: actualFinalScore,
      rankSortScore: actualFinalScore,
      rank: actualFinalRank,
      calculationSource: 'OFFICIAL_JUDGE_SCORES_ONLY',
      calculationSummary: { assignedJudges: 5, lockedSheets: 5, aiInfluence: false },
      calculatedAt: at('2026-04-12T18:30:00+07:00'),
      isSelectedForFinal: true,
      selectionReason: 'Advanced as a top-two preliminary team.',
      note: index < 4 ? 'Award-winning finalist.' : 'Finalist.',
      publishedAt: at('2026-04-12T18:40:00+07:00'),
      publishedBy: coordinatorUser._id
    })
    await upsertOne(Team, { _id: record.team._id }, {
      qualificationStatus: index < 4 ? 'AWARDED' : 'FINALIST'
    })
  }

  const prizes = [
    ['First Prize', 7000000, 1, finalists[0]],
    ['Second Prize', 5000000, 2, finalists[1]],
    ['Third Prize', 3000000, 3, finalists[2]],
    ['Creative Idea Prize', 1500000, 4, finalists[3]]
  ]
  await Promise.all(prizes.map(([title, amount, rank, record]) => upsertOne(Prize, { competitionId: competition._id, title }, {
    competitionId: competition._id,
    title,
    description: `${title} for SEAL Hackathon Spring 2026.`,
    prizeType: 'TEAM',
    rank,
    amount,
    sponsor: 'SEAL',
    teamId: record.team._id
  })))

  const question = await upsertOne(WorkshopQuestion, { workshopId: workshop._id, content: 'Can AI review change the official judge score?' }, {
    workshopId: workshop._id,
    authorId: officialTeams[0].members[0]._id,
    content: 'Can AI review change the official judge score?',
    voteCount: 18,
    votes: officialTeams.slice(0, 3).map(record => ({ voterId: record.members[0]._id, votedAt: at('2026-04-09T21:00:00+07:00') }))
  })
  void question
  await upsertOne(WorkshopFeedback, { workshopId: workshop._id, authorId: officialTeams[0].members[0]._id }, {
    workshopId: workshop._id,
    authorId: officialTeams[0].members[0]._id,
    comment: 'The workflow and submission checklist were clear and practical.'
  })
  await upsertOne(WorkshopRating, { workshopId: workshop._id, authorId: officialTeams[0].members[0]._id }, {
    workshopId: workshop._id,
    authorId: officialTeams[0].members[0]._id,
    rating: 5
  })

  const media = await upsertOne(Media, { competitionId: competition._id, title: 'SEAL Hackathon Spring 2026 Award Ceremony' }, {
    competitionId: competition._id,
    uploadedBy: coordinatorUser._id,
    teamId: finalists[0].team._id,
    title: 'SEAL Hackathon Spring 2026 Award Ceremony',
    description: 'Approved gallery media for the closing and award ceremony.',
    mediaType: 'IMAGE',
    storageProvider: 'CLOUDINARY',
    bucketName: 'competition-media',
    storagePath: 'seal-spring-2026/award-ceremony.jpg',
    fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    originalFileName: 'seal-spring-2026-award-ceremony.jpg',
    mimeType: 'image/jpeg',
    fileSize: 245760,
    fileExtension: 'jpg',
    tags: ['seal', 'spring-2026', 'rag', 'awards'],
    status: 'APPROVED',
    reviewedBy: coordinatorUser._id,
    reviewedAt: at('2026-04-12T18:55:00+07:00'),
    uploadedAt: at('2026-04-12T18:50:00+07:00')
  })
  await upsertOne(MediaActivity, { mediaId: media._id, action: 'UPLOAD' }, {
    mediaId: media._id,
    competitionId: competition._id,
    userId: coordinatorUser._id,
    action: 'UPLOAD',
    metadata: { seeded: true, approved: true },
    createdAt: at('2026-04-12T18:50:00+07:00')
  })

  await Promise.all(finalists.map(record => upsertOne(Notification, { userId: record.members[0]._id, title: 'Final results published' }, {
    userId: record.members[0]._id,
    title: 'Final results published',
    message: `${record.team.name} completed the final round. Results are now available.`,
    type: 'RESULT',
    status: 'UNREAD',
    metadata: { competitionId: competition._id, teamId: record.team._id, roundId: finalRound._id }
  })))

  await upsertOne(AuditLog, { action: 'SEED_COMPLETED_CYCLE', resourceType: 'Competition', resourceId: competition._id }, {
    userId: adminUser._id,
    action: 'SEED_COMPLETED_CYCLE',
    resourceType: 'Competition',
    resourceId: competition._id,
    metadata: {
      confirmedTeams: officialTeams.length,
      rejectedTeams: 3,
      cancelledTeams: 3,
      preliminaryBoards: 3,
      teamsPerBoard: TRACK_DEFINITIONS.map(track => track.teams.length),
      finalistsPerBoard: 2,
      finalists: 6,
      preliminaryJudgesPerTeam: 2,
      finalJudgesPerTeam: 5,
      allConfirmedParticipantsCheckedIn: true,
      officialScoresExcludeAi: true
    }
  })
  await upsertOne(SystemConfiguration, { key: 'SEAL_SPRING_2026_SEED_SUMMARY' }, {
    key: 'SEAL_SPRING_2026_SEED_SUMMARY',
    value: {
      competitionId: competition._id.toString(),
      accountPassword: 'Password123!',
      participantEmailDomain: EMAIL_DOMAIN,
      confirmedTeams: officialTeams.length,
      exceptionTeams: 6,
      finalists: 6
    },
    isEncrypted: false,
    updatedBy: adminUser._id
  })

  return {
    competition,
    tracks,
    confirmedTeams: officialTeams.map(record => record.team),
    finalists: finalists.map(record => record.team),
    preliminaryRounds,
    finalRound
  }
}
