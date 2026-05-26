# SOFTWARE REQUIREMENT SPECIFICATION (SRS)

# SEAL – Hackathon Management Platform with AI-assisted Repository Evaluation

---

# 1. Introduction

## 1.1 Purpose

SEAL is a hackathon lifecycle management platform designed to support academic software engineering hackathons from registration to final result publishing.

The system supports:

- hackathon event management,
- registration and invitation management,
- team formation and team leader workflows,
- check-in and seminar/workshop attendance,
- GitHub repository automation,
- preliminary and final judging,
- ranking and result publishing,
- AI-assisted repository evaluation through third-party AI services as a supporting feature.

The platform aims to improve transparency, automation, operational control, and collaboration during the full hackathon lifecycle.

---

## 1.2 Scope

SEAL focuses on hackathon lifecycle management. AI is not the core identity of the system; it is a supporting capability used to help judges and coordinators review repositories more efficiently.

The system includes:

- event creation and lifecycle management,
- registration forms and invitation emails,
- participant and team management,
- check-in and seminar/workshop attendance tracking,
- preliminary board assignment and final round management,
- rubric-based judging,
- ranking and finalist selection,
- GitHub integration,
- repository provisioning, collaborator invitations, and access revocation,
- AI-assisted repository evaluation,
- result publishing,
- notification system.

The AI functionality uses third-party AI APIs and does not develop or train custom AI models.

---

## 1.3 Objectives

The system aims to:

- automate hackathon lifecycle processes,
- centralize event communication and tracking,
- integrate GitHub repository management,
- support check-in, judging, finalist selection, and result publishing,
- support AI-assisted repository evaluation as a secondary feature,
- improve transparency and auditability.

---

# 2. Current Problems

Current hackathon management processes are mostly manual and contain several limitations:

- team registration is handled using separate forms or spreadsheets,
- scoring is performed manually using Excel files,
- judges work independently without centralized tracking,
- organizers manually calculate rankings,
- communication between organizers, mentors, judges, and participants is fragmented,
- repository creation and access control are handled manually,
- there is no centralized event timeline management,
- check-in and seminar attendance are not integrated,
- result publishing is not automated,
- there is no supporting AI-assisted repository review for judges,
- there is no audit tracking for critical actions.

---

# 3. Roles, Permissions, Participants, and Hackathon Workflow

This section separates **authorization roles (RBAC)** from the **Participant** domain model. The simplified domain uses `Participant` for event registration, team assignment, check-in, and GitHub access status.

## 3.1 Permission-based Authorization

The backend uses permission-based access control. Routes and business actions check permission codes such as `EVENT_CREATE`, `WORKSHOP_CREATE`, `TEAM_VIEW`, or `USER_ROLE_ASSIGN`.

Roles are only containers for permissions. A route must not check role names such as `ADMIN`, `COORDINATOR`, or `JUDGE` directly. After login and on authenticated requests, the system resolves permissions from assigned roles, merges them, removes duplicates, and exposes them through the authenticated user context.

Example:

```js
router.post(
  '/',
  authorizationMiddleware,
  permissionMiddleware(PERMISSIONS.EVENT_CREATE),
  eventController.createEvent
)
```

## 3.2 RBAC Roles (Permission Groups Only)

RBAC roles group permissions for easier administration. They are assigned by administrators and do not represent event participation status.

- **ADMIN**: system configuration, external integrations, role and permission management, audit oversight.
- **EVENT_COORDINATOR / COORDINATOR**: event lifecycle management, timelines, workshops, tracks and rounds, assignments, results publishing.
- **JUDGE**: access assigned submissions, scoring, and review summaries.
- **MENTOR**: access assigned teams and mentoring functions.
- **USER / PARTICIPANT**: baseline authenticated participant access.

Seeded role-permission mapping:

- **ADMIN**: all permissions.
- **EVENT_COORDINATOR / COORDINATOR**: `EVENT_CREATE`, `EVENT_VIEW`, `EVENT_UPDATE`, `TRACK_CREATE`, `TRACK_VIEW`, `TRACK_UPDATE`, `TRACK_DELETE`, `WORKSHOP_CREATE`, `WORKSHOP_VIEW`, `WORKSHOP_UPDATE`, `TEAM_VIEW`, `PARTICIPANT_VIEW`, `PARTICIPANT_APPROVE`, `USER_CREATE`, `USER_VIEW`, `USER_UPDATE`, `JUDGING_ASSIGN`, GitHub permissions, AI review permissions, `RESULT_PUBLISH`, and `AUDIT_LOG_VIEW`.
- **JUDGE**: `EVENT_VIEW`, `TRACK_VIEW`, `WORKSHOP_VIEW`, `TEAM_VIEW`, `SCORE_CREATE`, `SCORE_VIEW`, and `AI_REVIEW_VIEW`.
- **MENTOR**: `EVENT_VIEW`, `TRACK_VIEW`, `WORKSHOP_VIEW`, `TEAM_VIEW`, and `AI_REVIEW_VIEW`.
- **USER / PARTICIPANT**: `EVENT_VIEW`, `TRACK_VIEW`, `WORKSHOP_VIEW`, `TEAM_CREATE`, and `TEAM_VIEW`.

## 3.3 User Roles

### Participant

Participant is a user who joins a hackathon event.

Participants can:

- register for events,
- join teams,
- check in,
- attend seminars/workshops,
- code in GitHub repositories,
- submit projects through their team,
- view results.

There is no separate team-member actor or entity.

### Team Leader

Team Leader is a participant with additional team management permissions.

Responsibilities:

- create/register team,
- invite participants,
- manage repository access,
- submit project materials,
- communicate with coordinators.

### Event Coordinator

Responsibilities:

- create hackathon events,
- configure registration forms,
- send invitation emails,
- manage participants and teams,
- configure judging boards,
- manage GitHub integration,
- publish results.

### Mentor

Responsibilities:

- support assigned teams,
- monitor progress,
- provide technical guidance.

### Judge

Responsibilities:

- evaluate assigned teams,
- score submissions using rubrics,
- review repositories,
- submit evaluation comments.

## 3.4 Participant Domain Model

**Participant**
- `userId`
- `eventId`
- `teamId`
- `teamRole` (`MEMBER`, `LEADER`)
- `checkInStatus`
- `githubAccessStatus`

This model replaces the previous separated event-participation and team-membership records. A team leader is represented as a participant whose `teamRole = LEADER`.

## 3.5 Actors and Use Cases (UML-Oriented)

The use case diagram models **User** as the base actor, with specialized actors that inherit from User. The `Participant` model determines event registration, team membership, team leadership, check-in, and GitHub access state.

**Actor hierarchy**
- **Participant**
- **Team Leader**
- **Mentor**
- **Judge**
- **Event Coordinator**
- **Admin**

**Use cases by actor**
- **Participant**
	- Register/Login
	- View events, timelines, and workshops
	- View notifications and published results
	- Join workshops
	- Submit questions and vote
	- Rate workshops and submit feedback
	- Check in to events
	- Access team repository info and activity
	- View team progress and submissions
- **Team Leader**
	- Create/manage team
	- Invite/remove members
	- Register team to track/category
	- Manage submissions (repo/demo/report/presentation)
- **Mentor**
	- View assigned teams
	- Provide feedback and support
	- Monitor team progress
- **Judge**
	- View assigned submissions
	- Score submissions using rubrics
	- Submit comments
	- View AI review summaries
- **Event Coordinator**
	- Create/manage events and timelines
	- Configure registration forms and invitation emails
	- Manage workshops, tracks, and rounds
	- Manage participants and teams
	- Assign judges and mentors
	- Configure judging boards
	- Manage rankings and results publishing
	- Configure GitHub integration
	- Monitor repository activity
	- Trigger AI-assisted repository reviews
	- Manage media
- **Admin**
	- Approve/reject accounts
	- Manage roles and permissions
	- Configure external integrations
	- Monitor audit logs and system settings

---

## 3.6 Updated Hackathon Workflow

### Phase 1 — Registration

- Coordinator creates event.
- Participants register via form.
- Invitation emails are sent.
- Users authenticate using Google Login.

### Phase 2 — Team Formation

- Participants create or join teams.
- Team Leader manages team registration.
- Each event supports a maximum of 30 teams.

### Phase 3 — Check-in & Seminar

- Participants check in.
- Participants attend seminar/workshop sessions.
- Attendance is recorded.

### Phase 4 — Coding Phase

- System automatically provisions GitHub repositories.
- Repository access is granted to team participants.
- Participants begin coding.

### Phase 5 — Preliminary Judging

- System randomly divides 30 teams into 3 boards with 10 teams per board.
- Judges evaluate assigned boards.
- Evaluation uses predefined rubrics.

### Phase 6 — Final Round

- Top teams are selected from each board.
- 3 boards x 2 top teams = 6 finalists.
- Final evaluation is conducted.
- If finalist teams have equal scores, coordinators run a 10-minute penalty evaluation or mini test as a tie-breaker.

### Phase 7 — Repository Locking

- Repository access is revoked after the deadline.
- Participants can no longer push code.
- Submissions are frozen.

### Phase 8 — Result Publishing

- System calculates scores.
- Rankings are generated.
- Tie-breaker results are applied so final ranks do not duplicate.
- Final results are published.

---

# 4. Functional Requirements

# 4.1 Authentication & Authorization Module

## Features

- Google OAuth login,
- JWT authentication,
- permission-based authorization,
- RBAC role-permission grouping,
- account approval.

## Requirements

### FR-AUTH-01

Users can authenticate using Google Login.

### FR-AUTH-02

The system uses JWT authentication. Access tokens include the user id, email, assigned role names, and resolved permission codes.

### FR-AUTH-03

Passwords must be securely hashed.

For Google-only accounts, password hash is optional.

### FR-AUTH-04

Coordinators/Admins can approve or reject accounts when approval is required.

### FR-AUTH-05

The system supports permission-based access control. Routes use permission middleware and permission constants instead of checking role names.

### FR-AUTH-06

Admins can dynamically assign roles and permissions. Roles remain in the database as permission groups.

### FR-AUTH-07

When a user has multiple roles, the system merges and deduplicates permissions from all assigned roles before authorization checks.

---

# 4.2 Event Management Module

## Features

- event creation,
- event lifecycle management,
- registration form configuration,
- participant invitation,
- schedule management,
- event status management.

## Requirements

### FR-EVT-01

Coordinators can create hackathon events.

### FR-EVT-02

An event contains:

- title,
- description,
- semester,
- start date,
- end date,
- event status.

### FR-EVT-03

Event statuses include:

- Draft,
- Open Registration,
- Ongoing,
- Scoring,
- Completed,
- Archived.

### FR-EVT-04

The system supports multiple events per year.

### FR-EVT-05

Coordinators can configure registration forms and send invitation emails.

---

# 4.3 Timeline Management Module

## Features

- timeline scheduling,
- activity tracking,
- automatic notifications.

## Requirements

### FR-TM-01

Coordinators can create timeline events.

### FR-TM-02

Timeline events may include:

- workshops,
- check-ins,
- competition rounds,
- result publishing,
- ceremonies.

### FR-TM-03

Each timeline event contains:

- title,
- description,
- start time,
- end time,
- event type,
- status.

### FR-TM-04

The system automatically triggers notifications based on scheduled timeline events.

---

# 4.4 Workshop Management Module

## Features

- workshop scheduling,
- Google Meet integration,
- questionnaire management,
- workshop interaction,
- rating and feedback.

## Requirements

### FR-WS-01

Coordinators can create workshops.

### FR-WS-02

A workshop may contain:

- Google Meet link,
- presenter information,
- questionnaires,
- workshop schedule.

### FR-WS-03

Participants can:

- submit questions,
- vote questions,
- rate workshops,
- submit feedback.

### FR-WS-04

Mentors or coordinators can view:

- submitted questions,
- ratings,
- participant feedback.

### FR-WS-05

The system stores workshop interaction history.

---

# 4.5 Team & Competition Management Module

## Features

- team registration,
- participant team joining,
- track management,
- round management,
- competition workflow management.

## Requirements

### FR-COMP-01

Team leaders can create teams.

### FR-COMP-02

A team contains participants and is managed by one team leader.

### FR-COMP-03

An event supports a maximum of 30 teams.

### FR-COMP-04

Teams can register into competition tracks/categories.

### FR-COMP-05

An event may contain multiple competition rounds.

### FR-COMP-06

Each round contains:

- round name,
- submission deadline,
- judging boards,
- assigned judges,
- scoring rubric,
- publish time.

### FR-COMP-07

The system supports preliminary-to-final promotion rules.

Example:

Top 2 teams from each preliminary board advance to the final round.

---

# 4.6 Submission & Repository Management Module

## Features

- repository registration,
- GitHub integration,
- commit tracking,
- repository monitoring.

## Requirements

### FR-SUB-01

The system supports GitHub repository integration for submissions.

### FR-SUB-02

Coordinators can configure GitHub Organization integration.

### FR-SUB-03

The system can automatically create repositories for participating teams.

### FR-SUB-04

The system can automatically invite team participants into repositories.

### FR-SUB-05

The system stores repository metadata including:

- repository URL,
- contributors,
- commit activity,
- submission status.

### FR-SUB-06

Teams can submit:

- repository link,
- demo URL,
- report URL,
- presentation URL.

### FR-SUB-07

The system stores submission history.

---

# 4.7 GitHub Integration Module

## Features

- GitHub organization management,
- webhook integration,
- repository synchronization,
- commit tracking,
- commit diff caching,
- repository access revocation.

## Requirements

### FR-GH-01

The system integrates with GitHub APIs.

### FR-GH-02

The system exposes webhook endpoints.

### FR-GH-03

The system processes GitHub webhook events.

### FR-GH-04

Webhook events may include:

- push events,
- commit events,
- pull request events.

### FR-GH-05

The system synchronizes commit data into the internal database.

### FR-GH-06

Commit data includes:

- author,
- timestamp,
- commit message,
- lines added,
- lines removed.

### FR-GH-07

The system stores commit diff snapshots in `CommitDiff` so AI review retries can reuse cached diff data instead of repeatedly requesting or rebuilding the same diff.

### FR-GH-08

The system tracks repository activity metrics.

### FR-GH-09

Coordinators can revoke repository access after the deadline so submissions are frozen.

---

# 4.8 AI-assisted Repository Evaluation Module

## Features

- third-party AI integration,
- supporting repository evaluation,
- repository analysis,
- AI-generated feedback.

## Requirements

### FR-AI-01

Admins can configure third-party AI providers.

### FR-AI-02

Configuration includes:

- API key,
- API endpoint,
- model name,
- provider name.

### FR-AI-03

The system sends repository metadata and cached commit diff information to third-party AI services as a supporting evaluation aid.

### FR-AI-04

The system stores AI-generated review results.

### FR-AI-05

AI review results may include:

- code quality analysis,
- maintainability comments,
- issue detection,
- improvement suggestions,
- optional AI score.

### FR-AI-06

The system stores AI review criterion details in `AIReviewCriterion`, including linked rubric criterion, criterion name, max score, AI score, feedback, evidence, strengths, weaknesses, and suggestions.

### FR-AI-07

Judges and coordinators can view AI-generated review summaries. AI output supports evaluation but does not replace rubric scoring.

### FR-AI-08

Coordinators can retry failed AI review requests. Retry requests should reuse `CommitDiff` records when available to reduce backend calls after AI provider errors.

### FR-AI-09

The system does not develop or train custom AI models.

---

# 4.9 Scoring & Ranking Module

## Features

- judging board assignment,
- rubric-based scoring,
- judge score sheets,
- finalist selection,
- ranking generation,
- automatic score calculation.

## Requirements

### FR-SCORE-01

Judges can only access submissions assigned to their judging board.

### FR-SCORE-02

Judges can score submissions using criteria-based rubrics.

### FR-SCORE-03

Judges can submit comments.

Judge score rows can store an AI-suggested score and the linked `AIReviewCriterion`. If a judge changes the score from the AI suggestion, the row stores override status and the reason.

### FR-SCORE-04

Scores from different judges are stored separately.

### FR-SCORE-05

The system groups a judge's criterion score rows into one `ScoreSheet` for one team in one round. A score sheet stores the judge, team, round, submission, rubric, score row references, total score, final score, comments, and submission status.

### FR-SCORE-06

The system calculates final scores automatically from submitted score sheets.

### FR-SCORE-07

The system generates rankings based on scores.

### FR-SCORE-08

Rankings can be generated by:

- track,
- round,
- event.

### FR-SCORE-09

The system randomly assigns up to 30 teams into 3 preliminary boards with up to 10 teams per board.

### FR-SCORE-10

The system selects the top 2 teams from each preliminary board for the final round.

Ranking rows store whether a team is selected for the final round and the selection reason.

### FR-SCORE-11

If final-round teams have equal scores, coordinators can record a penalty evaluation or 10-minute mini test result. Ranking generation uses the tie-breaker result to assign unique final ranks.

---

# 4.10 Result Publishing Module

## Features

- realtime result publishing,
- scheduled publishing,
- external scoring integration.

## Requirements

### FR-RES-01

The system supports external scoring integration.

### FR-RES-02

The system can receive result webhooks from external systems.

### FR-RES-03

Coordinators can configure result publishing schedules.

### FR-RES-04

The system automatically publishes results at configured times.

### FR-RES-05

The system stores result publishing history.

---

# 4.11 Rating & Feedback Module

## Features

- rating forms,
- feedback collection,
- notification reminders.

## Requirements

### FR-RATE-01

Coordinators can create rating forms.

### FR-RATE-02

Rating forms contain:

- open time,
- close time,
- evaluation questions.

### FR-RATE-03

The system sends reminder notifications for pending feedback.

---

# 4.12 Check-in & Seminar Module

## Features

- event check-in,
- seminar attendance tracking,
- workshop attendance tracking.

## Requirements

### FR-MD-01

Participants can check in to events.

### FR-MD-02

Participants can attend seminars and workshops.

### FR-MD-03

The system records attendance for seminars and workshops.

### FR-MD-04

Coordinators can view attendance reports.

### FR-MD-05

Participant check-in status is stored in the Participant model.

---

# 4.13 Dashboard Module

## Features

- realtime analytics,
- competition monitoring,
- repository activity visualization.

## Requirements

### FR-DB-01

Coordinator dashboards display:

- total teams,
- total participants,
- total submissions,
- commit count,
- repository activity,
- AI review status,
- rankings.

### FR-DB-02

Judge dashboards display:

- assigned submissions,
- scoring progress,
- AI review summaries.

### FR-DB-03

Participant dashboards display:

- repository status,
- GitHub access status,
- submission status,
- commit activity.

---

# 4.14 Notification Module

## Features

- realtime notifications,
- scheduled notifications,
- event reminders.

## Requirements

### FR-NOTI-01

The system sends notifications for:

- deadlines,
- workshops,
- result publishing,
- feedback reminders.

### FR-NOTI-02

Notifications may be delivered through:

- in-app notifications,
- email.

---

# 4.15 Audit Log Module

## Features

- action tracking,
- transparency management.

## Requirements

### FR-AUDIT-01

The system records audit logs for critical actions.

### FR-AUDIT-02

Audit logs include:

- user information,
- action type,
- timestamp,
- affected resources.

### FR-AUDIT-03

Audit logs must be searchable.

---

# 4.16 Admin Configuration Module

## Features

- external integration configuration,
- API management,
- system settings management.

## Requirements

### FR-ADMIN-01

Admins can configure external services.

### FR-ADMIN-02

Configurations include:

- GitHub token,
- AI API key,
- webhook secret,
- external scoring API configuration.

### FR-ADMIN-03

Configuration data is stored in the database.

---

# 5. Non-functional Requirements

## 5.1 Security

- JWT authentication,
- password hashing,
- permission-based authorization,
- webhook signature validation,
- encrypted API credentials.

---

## 5.2 Scalability

The system must support:

- webhook processing,
- asynchronous background jobs,
- realtime event handling,
- queue-based processing.

---

## 5.3 Reliability

The system must support:

- retryable webhook processing,
- logging and monitoring,
- error recovery mechanisms.

---

## 5.4 Usability

The system should provide:

- user-friendly interfaces,
- responsive dashboards,
- intuitive scoring interfaces,
- accessible navigation.

---

## 5.5 Integration Capability

The system must support integration with:

- GitHub API,
- third-party AI APIs,
- Google Meet,
- external scoring systems.

---

# 6. Core Entities

The main entities include:

- User
- Role
- Permission
- Event
- TimelineEvent
- Workshop
- WorkshopQuestion
- WorkshopFeedback
- Track
- Round
- JudgingBoard
- Team
- Participant
- Repository
- Commit
- CommitDiff
- Submission
- Rubric
- Criterion
- ScoreSheet
- Score
- Ranking
- Prize
- AIReview
- AIReviewCriterion
- Notification
- AuditLog
- Media
- SystemConfiguration

---

## 6.1 Entity Notes

- `CommitDiff`: cached diff payload for a repository commit or commit range. It prevents repeated backend/GitHub diff requests when AI review responses fail and need retrying.
- `AIReviewCriterion`: criterion-level AI review detail linked to an `AIReview`. It supports detailed feedback similar to research-project evaluation rubrics.
- `ScoreSheet`: one judging form submitted by one judge for one team in one round. Individual `Score` rows remain criterion-level details under the sheet.
- `Ranking`: stores primary score plus tie-breaker fields such as penalty evaluation or 10-minute mini test score so published final ranks are unique.

---

## 6.2 Database Schema Documentation

The backend uses MongoDB with Mongoose. Each model uses `createdAt` and `updatedAt` timestamps unless otherwise noted.

### User, Role, and Permission

**User**
- Stores authenticated accounts and profile data.
- Key fields: `email`, `authProvider`, `passwordHash`, `googleId`, `fullName`, `avatarUrl`, `phone`, `studentId`, `studentType`, `schoolName`, `status`, `roles`.
- Relationships: many users can reference many `Role` records through `roles`.
- API responses include resolved `permissions`, derived from assigned roles. Permissions are not stored directly on the user document in the current schema.

**Role**
- Stores RBAC role names such as `ADMIN`, `EVENT_COORDINATOR`, `COORDINATOR`, `JUDGE`, `MENTOR`, `USER`, and `PARTICIPANT`.
- Key fields: `name`, `description`, `permissions`.
- Relationships: roles reference `Permission` records through `permissions`.
- Purpose: roles are permission groups only; routes do not authorize by role name.

**Permission**
- Stores fine-grained access permissions.
- Key fields: `code`, `description`.
- Example codes: `EVENT_CREATE`, `EVENT_VIEW`, `TRACK_CREATE`, `WORKSHOP_CREATE`, `TEAM_VIEW`, `PARTICIPANT_APPROVE`, `USER_ROLE_ASSIGN`, `SCORE_CREATE`, `AI_REVIEW_VIEW`, `RESULT_PUBLISH`, `SYSTEM_CONFIG_MANAGE`.

### Event and Schedule

**Event**
- Stores one hackathon season or event.
- Key fields: `title`, `description`, `semester`, `seriesName`, `season`, `year`, `theme`, `registrationStart`, `registrationEnd`, `startDate`, `endDate`, `minTeamMembers`, `maxTeamMembers`, `finalistSlotsPerTrack`, `totalFinalistSlots`, `status`, `createdBy`.
- Relationships: one event has many tracks, rounds, teams, participants, workshops, submissions, rankings, prizes, and media items.

**TimelineEvent**
- Stores event timeline items such as registration, workshops, coding sessions, rounds, ceremonies, and result publishing.
- Key fields: `eventId`, `title`, `description`, `eventType`, `startTime`, `endTime`, `status`.

**Workshop**
- Stores workshop or seminar sessions.
- Key fields: `eventId`, `timelineEventId`, `title`, `description`, `presenterId`, `startTime`, `endTime`, `status`.

**WorkshopQuestion**
- Stores participant questions for workshops.
- Key fields: `workshopId`, `authorId`, `content`, `voteCount`.

**WorkshopFeedback**
- Stores participant feedback and ratings for workshops.
- Key fields: `workshopId`, `authorId`, `rating`, `comment`.

### Team, Participant, Track, and Round

**Track**
- Stores preliminary groups or competition tracks.
- Key fields: `eventId`, `code`, `name`, `description`, `type`, `maxTeams`, `teamIds`, `status`.
- Relationships: tracks contain teams and can be attached to preliminary rounds.

**Team**
- Stores team registration and project metadata.
- Key fields: `eventId`, `trackId`, `name`, `chapterName`, `projectName`, `leaderId`, `memberIds`, `trackAssignmentMethod`, `trackAssignedAt`, `qualificationStatus`, `status`.
- Relationships: one team has participants, repository, submissions, rankings, and prizes.

**Participant**
- Stores event registration, team membership, team leader status, check-in state, eligibility, and GitHub access state.
- Key fields: `eventId`, `userId`, `teamId`, `chapterName`, `teamRole`, `isGraduated`, `consentMediaUse`, `eligibilityStatus`, `attendedActivities`, `checkInStatus`, `githubAccessStatus`, `status`, `joinedAt`.
- Relationships: each participant references one user and may reference one team.

**Round**
- Stores preliminary and final rounds.
- Key fields: `eventId`, `trackId`, `name`, `roundType`, `assignedTeamIds`, `promotedTeamIds`, `maxPromotedTeams`, `startTime`, `endTime`, `submissionDeadline`, `publishTime`, `assignedJudgeIds`, `rubricId`, `promotionRule`, `tieBreakRule`, `tieBreakDurationMinutes`, `status`.
- Tie-break policy: final rounds can store a penalty evaluation or 10-minute mini-test rule so tied finalist teams can be ranked without duplicate ranks.

**JudgingBoard**
- Stores judge/team assignment groups.
- Key fields: `eventId`, `roundId`, `trackId`, `name`, `boardNumber`, `teamIds`, `judgeIds`, `maxTeams`, `status`.

### Repository and Submission

**Repository**
- Stores GitHub repository ownership and submission state.
- Key fields: `eventId`, `teamId`, `githubOrg`, `repoName`, `repoUrl`, `contributors`, `defaultBranch`, `submissionStatus`, `lastSyncAt`.
- Constraints: `teamId` and `repoUrl` are unique.

**Commit**
- Stores synchronized commit metadata.
- Key fields: `repositoryId`, `commitSha`, `authorName`, `authorEmail`, `timestamp`, `message`, `linesAdded`, `linesRemoved`, `filesChanged`.
- Constraints: `commitSha` is unique.

**CommitDiff**
- Stores cached diff data for a repository commit or commit range.
- Key fields: `repositoryId`, `commitId`, `baseCommitSha`, `headCommitSha`, `provider`, `status`, `diffHash`, `diffText`, `files`, `fetchedAt`, `lastError`, `expiresAt`.
- Purpose: AI review retries reuse this cached payload instead of calling backend/GitHub repeatedly when an AI response fails.
- Constraints: one diff per `repositoryId` and `headCommitSha`.

**Submission**
- Stores team submission material for a specific round.
- Key fields: `eventId`, `roundId`, `teamId`, `repositoryId`, `demoUrl`, `reportUrl`, `presentationUrl`, `submittedAt`, `status`.
- Constraints: one submission per `roundId` and `teamId`.

### Rubric, Scoring, and Ranking

**Rubric**
- Stores a scoring rubric for an event.
- Key fields: `eventId`, `title`, `description`, `totalScore`, `createdBy`.

**Criterion**
- Stores one scoring criterion under a rubric.
- Key fields: `rubricId`, `name`, `description`, `maxScore`, `weight`.

**ScoreSheet**
- Stores one judge's complete scoring form for one team in one round.
- Key fields: `eventId`, `roundId`, `boardId`, `teamId`, `submissionId`, `judgeId`, `rubricId`, `scoreIds`, `totalScore`, `weightedScore`, `finalScore`, `generalComment`, `status`, `submittedAt`, `lockedAt`.
- Purpose: groups individual criterion `Score` rows into one auditable judge/team/round sheet.
- Constraints: one score sheet per `roundId`, `teamId`, and `judgeId`.

**Score**
- Stores one criterion-level score line.
- Key fields: `submissionId`, `scoreSheetId`, `judgeId`, `criterionId`, `aiReviewCriterionId`, `aiSuggestedScore`, `scoreValue`, `isOverridden`, `overrideReason`, `comment`.
- AI fields: `aiSuggestedScore` and `aiReviewCriterionId` preserve the AI suggestion reviewed by the judge; `isOverridden` and `overrideReason` record judge changes.
- Constraints: one score per `submissionId`, `judgeId`, and `criterionId`.

**Ranking**
- Stores published rankings for teams, chapters, or individuals.
- Key fields: `eventId`, `rankingType`, `roundId`, `trackId`, `teamId`, `participantId`, `chapterName`, `score`, `pointDelta`, `tieBreakMethod`, `tieBreakScore`, `penaltyScore`, `miniTestScore`, `rankSortScore`, `rank`, `isSelectedForFinal`, `selectionReason`, `note`, `publishedAt`.
- Finalist selection fields: `isSelectedForFinal` marks ranking rows selected for final advancement, and `selectionReason` explains the decision.
- Tie-break fields: `tieBreakMethod`, `penaltyScore`, and `miniTestScore` store the final-round penalty evaluation or 10-minute mini-test result.
- Constraints: ranks are unique within the same `eventId`, `rankingType`, `roundId`, and `trackId` scope.

### AI-assisted Review

**AIReview**
- Stores one AI review request/result for a repository commit.
- Key fields: `repositoryId`, `commitId`, `commitDiffId`, `provider`, `model`, `status`, `summary`, `details`, `score`, `retryCount`, `lastError`, `requestedBy`, `requestedAt`, `completedAt`.
- Purpose: stores top-level AI review summary and retry state. It references `CommitDiff` so retries can reuse cached diff content.

**AIReviewCriterion**
- Stores criterion-level AI evaluation details.
- Key fields: `aiReviewId`, `criterionId`, `name`, `code`, `description`, `maxScore`, `score`, `weight`, `feedback`, `strengths`, `weaknesses`, `suggestions`, `evidence`, `order`.
- Purpose: provides detailed AI feedback per criterion, similar to research-project evaluation forms.

### Result, Media, Notification, and Audit

**Prize**
- Stores awards for teams or individuals.
- Key fields: `eventId`, `title`, `description`, `prizeType`, `rank`, `amount`, `sponsor`, `teamId`, `participantId`.

**Notification**
- Stores user notifications.
- Key fields: `userId`, `title`, `message`, `type`, `status`, `metadata`.

**Media**
- Stores event media records.
- Key fields: `eventId`, `uploadedBy`, `url`, `caption`, `tags`.

**AuditLog**
- Stores critical system activity.
- Key fields: `userId`, `action`, `resourceType`, `resourceId`, `metadata`.

**SystemConfiguration**
- Stores system-level configuration such as GitHub and AI provider settings.
- Key fields: `key`, `value`, `isEncrypted`, `updatedBy`.

### Main Database Flows

**AI review retry flow**
- `Repository` has many `Commit` records.
- `CommitDiff` caches the diff for a commit or commit range.
- `AIReview` references `Repository`, `Commit`, and `CommitDiff`.
- `AIReviewCriterion` stores detailed AI scoring and feedback for each `AIReview`.
- If the AI provider fails, the retry increases `retryCount` and reuses the existing `CommitDiff`.

**Judging flow**
- `Round` defines assigned teams, judges, rubric, and tie-break rules.
- `JudgingBoard` assigns teams to judges.
- `Submission` stores one team's material for a round.
- `ScoreSheet` stores one judge's submitted sheet for one team in that round.
- `Score` stores criterion-level score rows under the score sheet, including optional AI suggestions and judge override metadata.
- `Ranking` aggregates submitted score sheets and stores final rank output, including finalist selection flags and reasons.

**Final tie-break flow**
- If finalists have equal `score`, coordinators record a `PENALTY_EVALUATION` or `MINI_TEST` tie-break result.
- `Ranking.tieBreakScore`, `penaltyScore`, or `miniTestScore` stores the tie-break value.
- `Ranking.rankSortScore` can be used by services to sort by score plus tie-break value.
- The unique rank index prevents duplicate ranks inside the same ranking scope.

---

# 7. Suggested Technology Stack

## Backend

- Node.js
- Express.js
- JavaScript
- MongoDB
- Mongoose
- JWT Authentication
- Permission-based Authorization
- RBAC Role-Permission Grouping
- GitHub API Integration
- Webhook Processing

---

## Frontend

- React TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query
- React Hook Form
- Zod

---

## External Services

- GitHub API
- OpenAI API / Gemini API / Claude API
- Google Meet
- External Scoring Systems

---

# 8. Conclusion

SEAL is designed as a hackathon lifecycle management platform that combines:

- hackathon management,
- registration and invitation management,
- team formation,
- check-in and seminar attendance,
- GitHub automation,
- judging board assignment,
- finalist selection,
- AI-assisted repository evaluation as a supporting feature,
- analytics and dashboards,
- result publishing.

The system aims to improve transparency, automation, realtime monitoring, and collaboration for software engineering competitions.
