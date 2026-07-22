# SEAL Database Design (MongoDB)

This document defines the MongoDB data model for the SEAL backend based on the SRS and architecture documents. The schema is organized by core modules and uses Mongoose-style collection naming (singular models, plural collections).

---

## 1. Conventions

- ObjectId references are named with suffix `Id`.
- Timestamps use `createdAt` and `updatedAt` (Mongoose timestamps).
- Status values are stored as uppercase strings that map to constants.
- Soft deletion can be implemented with `isDeleted` and `deletedAt` where needed.
- Arrays of subdocuments are used only for small, bounded lists; large or growing datasets use separate collections with references.

---

## 2. Collections

### 2.1 users

**Purpose:** Store user accounts and profile details.

**Fields**
- `_id` (ObjectId)
- `email` (string, unique, required)
- `googleId` (string, unique, sparse)
- `authProvider` (string, enum: GOOGLE, LOCAL)
- `googleAuth` (object: `googleId`, `email`, `name`, `picture`)
- `googleCalendar` (object: `connected`, `googleId`, `email`, encrypted `accessToken`, encrypted `refreshToken`, `tokenExpiryDate`, `scope`)
- `passwordHash` (string)
- `fullName` (string, required)
- `status` (string, enum: PENDING, APPROVED, REJECTED, SUSPENDED)
- `roles` (ObjectId[], ref: roles)
- `avatarUrl` (string)
- `phone` (string)
- `bio` (string)
- `createdAt`, `updatedAt`

**Authorization behavior**
- Users store assigned role references in `roles`.
- Resolved permission codes are derived from populated role permissions at login/request time.
- The current schema does not store direct user permissions.
- Google Calendar access and refresh tokens are encrypted at rest and must not be returned by API responses.

**Indexes**
- `email` unique
- `googleId` unique sparse
- `roles`

---

### 2.2 roles

**Purpose:** RBAC role definitions used only as permission groups.

**Fields**
- `_id` (ObjectId)
- `name` (string, unique, uppercase)
- `description` (string)
- `permissions` (ObjectId[], ref: permissions)
- `createdAt`, `updatedAt`

**Indexes**
- `name` unique

**Seeded role-permission groups**
- `ADMIN`: all permissions.
- `COMPETITION_COORDINATOR` and `COORDINATOR`: competition, track, workshop, team view, participant approval, judging assignment, GitHub, AI review, result publishing, audit view, and user management permissions.
- `JUDGE`: competition, track, workshop, team view, scoring, and AI review view permissions.
- `MENTOR`: competition, track, workshop, team view, and AI review view permissions.
- `PARTICIPANT`: competition, track, workshop, team create, and team view permissions.

Routes must not authorize by role name. Routes authorize through permission codes.

---

### 2.3 permissions

**Purpose:** Fine-grained permission catalog.

**Fields**
- `_id` (ObjectId)
- `code` (string, unique, uppercase)
- `description` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `code` unique

**Current permission constants**
- `COMPETITION_CREATE`, `COMPETITION_VIEW`, `COMPETITION_UPDATE`, `COMPETITION_DELETE`
- `TRACK_CREATE`, `TRACK_VIEW`, `TRACK_UPDATE`, `TRACK_DELETE`
- `WORKSHOP_CREATE`, `WORKSHOP_VIEW`, `WORKSHOP_UPDATE`, `WORKSHOP_DELETE`
- `WORKSHOP_QUESTION_CREATE`, `WORKSHOP_QUESTION_VIEW`, `WORKSHOP_QUESTION_VOTE`
- `WORKSHOP_RATING_CREATE`, `WORKSHOP_RATING_VIEW`
- `WORKSHOP_FEEDBACK_CREATE`, `WORKSHOP_FEEDBACK_VIEW`
- `WORKSHOP_MEET_CREATE`, `WORKSHOP_MEET_VIEW`, `WORKSHOP_MEET_DELETE`
- `GOOGLE_CONNECT`
- `TEAM_CREATE`, `TEAM_VIEW`, `TEAM_UPDATE`, `TEAM_DELETE`
- `PARTICIPANT_VIEW`, `PARTICIPANT_APPROVE`
- `USER_CREATE`, `USER_VIEW`, `USER_UPDATE`, `USER_ROLE_ASSIGN`
- `JUDGING_ASSIGN`, `SCORE_CREATE`, `SCORE_VIEW`
- `GITHUB_CONFIGURE`, `GITHUB_REPOSITORY_CREATE`, `GITHUB_ACCESS_REVOKE`
- `AI_REVIEW_TRIGGER`, `AI_REVIEW_VIEW`
- `RESULT_PUBLISH`
- `AUDIT_LOG_VIEW`
- `SYSTEM_CONFIG_MANAGE`

---

### 2.4 competitions

**Purpose:** Hackathon competition container.

**Fields**
- `_id` (ObjectId)
- `title` (string, required)
- `description` (string)
- `semester` (string)
- `startDate` (date)
- `endDate` (date)
- `status` (string, enum: DRAFT, OPEN_REGISTRATION, ONGOING, SCORING, COMPLETED, ARCHIVED)
- `createdBy` (ObjectId, ref: users)
- `createdAt`, `updatedAt`

**Indexes**
- `status`
- `startDate`

---

### 2.5 timelineActivitys

**Purpose:** Scheduled activities within an competition.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `title` (string, required)
- `description` (string)
- `startTime` (date)
- `endTime` (date)
- `eventType` (string, enum: WORKSHOP, CHECK_IN, ROUND, RESULT_PUBLISHING, CEREMONY, OTHER)
- `status` (string, enum: SCHEDULED, ONGOING, COMPLETED, CANCELLED)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, startTime`
- `eventType`

---

### 2.6 workshops

**Purpose:** Workshop details and schedule.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `timelineCompetitionId` (ObjectId, ref: timelineActivitys)
- `title` (string, required)
- `description` (string)
- `presenterId` (ObjectId, ref: users)
- `speakerInfo` (object: `name`, `title`, `bio`, `email`)
- `meetLink` (string)
- `googleMeet` (object: `enabled`, `meetLink`, `calendarCompetitionId`, `htmlLink`, `organizerUserId`, `organizerEmail`, `createdAt`)
- `startTime` (date, required)
- `endTime` (date, required)
- `questionnaire` (string[])
- `status` (string, enum: SCHEDULED, LIVE, COMPLETED, CANCELLED)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, startTime`
- `presenterId`
- `status`

---

### 2.7 workshopQuestions

**Purpose:** Participant questions and votes.

**Fields**
- `_id` (ObjectId)
- `workshopId` (ObjectId, ref: workshops, required)
- `authorId` (ObjectId, ref: users)
- `content` (string, required)
- `votes` (array of `{ voterId, votedAt }`)
- `voteCount` (number, default: 0)
- `createdAt`, `updatedAt`

**Indexes**
- `workshopId, createdAt`
- `voteCount`
- `workshopId, voteCount`

---

### 2.8 workshopRatings

**Purpose:** Participant ratings for workshops.

**Fields**
- `_id` (ObjectId)
- `workshopId` (ObjectId, ref: workshops, required)
- `authorId` (ObjectId, ref: users, required)
- `rating` (number, required, min: 1, max: 5)
- `createdAt`, `updatedAt`

**Indexes**
- `workshopId, authorId` unique
- `workshopId, rating`

---

### 2.9 workshopFeedback

**Purpose:** Textual feedback for workshops.

**Fields**
- `_id` (ObjectId)
- `workshopId` (ObjectId, ref: workshops, required)
- `authorId` (ObjectId, ref: users, required)
- `comment` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `workshopId, authorId` unique
- `workshopId, createdAt`

---

### 2.10 tracks

**Purpose:** Competition categories within an competition.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `name` (string, required)
- `description` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, name` unique

---

### 2.11 rounds

**Purpose:** Competition rounds per track.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `trackId` (ObjectId, ref: tracks)
- `name` (string, required)
- `submissionDeadline` (date)
- `publishTime` (date)
- `assignedJudgeIds` (ObjectId[], ref: users)
- `rubricId` (ObjectId, ref: rubrics)
- `promotionRule` (string)
- `status` (string, enum: DRAFT, OPEN, CLOSED, SCORING, COMPLETED)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, trackId`
- `submissionDeadline`

---

### 2.12 judgingBoards

**Purpose:** Preliminary and final judging board assignments.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `roundId` (ObjectId, ref: rounds, required)
- `name` (string, required)
- `boardNumber` (number, required)
- `teamIds` (ObjectId[], ref: teams)
- `judgeIds` (ObjectId[], ref: users)
- `maxTeams` (number, default: 10)
- `status` (string, enum: DRAFT, ASSIGNED, SCORING, COMPLETED)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, roundId, boardNumber` unique
- `judgeIds`
- `teamIds`

---

### 2.13 participants

**Purpose:** Hackathon participant records for competition registration, team assignment, check-in, and GitHub access.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `userId` (ObjectId, ref: users, required)
- `teamId` (ObjectId, ref: teams)
- `teamRole` (string, enum: MEMBER, LEADER)
- `checkInStatus` (string, enum: NOT_CHECKED_IN, CHECKED_IN)
- `githubAccessStatus` (string, enum: NOT_GRANTED, GRANTED, REVOKED)
- `status` (string, enum: INVITED, REGISTERED, ACTIVE, WITHDRAWN)
- `joinedAt` (date)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, userId` unique
- `competitionId, teamId`
- `checkInStatus`
- `githubAccessStatus`
- `teamId, teamRole` unique for `teamRole = LEADER`

---

### 2.14 teams

**Purpose:** Team registration and team-level metadata.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `trackId` (ObjectId, ref: tracks)
- `name` (string, required)
- `status` (string, enum: ACTIVE, INACTIVE, DISQUALIFIED)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, trackId`
- `name`

---

### 2.15 repositories

**Purpose:** GitHub repository metadata per team.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions)
- `teamId` (ObjectId, ref: teams, required)
- `githubOrg` (string)
- `repoName` (string)
- `repoUrl` (string, required)
- `contributors` (ObjectId[], ref: users)
- `defaultBranch` (string)
- `submissionStatus` (string, enum: NOT_SUBMITTED, SUBMITTED, APPROVED)
- `lastSyncAt` (date)
- `createdAt`, `updatedAt`

**Indexes**
- `teamId` unique
- `repoUrl` unique

---

### 2.16 commits

**Purpose:** Repository activity tracking.

**Fields**
- `_id` (ObjectId)
- `repositoryId` (ObjectId, ref: repositories, required)
- `commitSha` (string, required)
- `authorName` (string)
- `authorEmail` (string)
- `timestamp` (date)
- `message` (string)
- `linesAdded` (number)
- `linesRemoved` (number)
- `filesChanged` (number)
- `createdAt`, `updatedAt`

**Indexes**
- `repositoryId, timestamp`
- `commitSha` unique

---

### 2.17 submissions

**Purpose:** Team submission artifacts.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions)
- `roundId` (ObjectId, ref: rounds, required)
- `teamId` (ObjectId, ref: teams, required)
- `repositoryId` (ObjectId, ref: repositories)
- `demoUrl` (string)
- `reportUrl` (string)
- `presentationUrl` (string)
- `submittedAt` (date)
- `status` (string, enum: DRAFT, SUBMITTED, ACCEPTED, REJECTED)
- `createdAt`, `updatedAt`

**Indexes**
- `roundId, teamId` unique
- `submittedAt`

---

### 2.18 rubrics

**Purpose:** Scoring rubrics.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions)
- `title` (string, required)
- `description` (string)
- `totalScore` (number)
- `createdBy` (ObjectId, ref: users)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId`

---

### 2.19 criteria

**Purpose:** Scoring criteria for rubrics.

**Fields**
- `_id` (ObjectId)
- `rubricId` (ObjectId, ref: rubrics, required)
- `name` (string, required)
- `description` (string)
- `maxScore` (number, required)
- `weight` (number, default: 1)
- `createdAt`, `updatedAt`

**Indexes**
- `rubricId`

---

### 2.20 scores

**Purpose:** Judge scores per submission and criterion.

**Fields**
- `_id` (ObjectId)
- `submissionId` (ObjectId, ref: submissions, required)
- `scoreSheetId` (ObjectId, ref: scoreSheets)
- `judgeId` (ObjectId, ref: users, required)
- `criterionId` (ObjectId, ref: criteria)
- `scoreValue` (number, required)
- `isOverridden` (boolean, default: false)
- `overrideReason` (string)
- `comment` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `submissionId, judgeId, criterionId` unique
- `scoreSheetId`
- `judgeId`

---

### 2.21 rankings

**Purpose:** Precomputed rankings by round or track.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `rankingType` (string, enum: TEAM, CHAPTER, INDIVIDUAL)
- `roundId` (ObjectId, ref: rounds)
- `trackId` (ObjectId, ref: tracks)
- `teamId` (ObjectId, ref: teams)
- `participantId` (ObjectId, ref: participants)
- `chapterName` (string)
- `score` (number, required)
- `pointDelta` (number, default: 0)
- `tieBreakMethod` (string, enum: NONE, PENALTY_EVALUATION, MINI_TEST)
- `tieBreakScore` (number, default: 0)
- `penaltyScore` (number, default: 0)
- `miniTestScore` (number, default: 0)
- `rankSortScore` (number)
- `rank` (number, required)
- `isSelectedForFinal` (boolean, default: false)
- `selectionReason` (string)
- `note` (string)
- `publishedAt` (date)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId, rankingType, roundId, trackId`
- `competitionId, rankingType, teamId`
- `competitionId, rankingType, participantId`
- `competitionId, rankingType, chapterName`
- `competitionId, rankingType, roundId, trackId, rank` unique
- `competitionId, roundId, isSelectedForFinal`
- `rank`

---

### 2.22 prizes

**Purpose:** Prize definitions and assignment.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `title` (string, required)
- `description` (string)
- `amount` (number)
- `sponsor` (string)
- `teamId` (ObjectId, ref: teams)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId`

---

### 2.23 aiReviews

**Purpose:** Store AI-assisted repository evaluation results.

**Fields**
- `_id` (ObjectId)
- `repositoryId` (ObjectId, ref: repositories, required)
- `commitId` (ObjectId, ref: commits)
- `provider` (string)
- `model` (string)
- `status` (string, enum: PENDING, COMPLETED, FAILED)
- `summary` (string)
- `details` (object)
- `requestedBy` (ObjectId, ref: users)
- `requestedAt` (date)
- `completedAt` (date)
- `createdAt`, `updatedAt`

**Indexes**
- `repositoryId, requestedAt`
- `status`

---

### 2.24 aiReviewCriteria

**Purpose:** Store rubric-aligned AI criterion details and suggestions.

**Fields**
- `_id` (ObjectId)
- `aiReviewId` (ObjectId, ref: aiReviews, required)
- `criterionId` (ObjectId, ref: criteria, required)
- `name` (string, required)
- `code` (string)
- `description` (string)
- `maxScore` (number, required)
- `weight` (number, default: 1)
- `qualitativeLevel` (string, enum: EXCELLENT, GOOD, FAIR, AVERAGE, WEAK, NOT_ENOUGH_EVIDENCE)
- `feedback` (string)
- `strengths` (string[])
- `weaknesses` (string[])
- `suggestions` (string[])
- `evidence` (string[])
- `risks` (string[])
- `order` (number, default: 0)
- `createdAt`, `updatedAt`

**Indexes**
- `aiReviewId, order`
- `aiReviewId, code`

---

### 2.25 notifications

**Purpose:** In-app notification storage.

**Fields**
- `_id` (ObjectId)
- `userId` (ObjectId, ref: users, required)
- `title` (string, required)
- `message` (string)
- `type` (string, enum: DEADLINE, WORKSHOP, RESULT, FEEDBACK, SYSTEM)
- `status` (string, enum: UNREAD, READ)
- `metadata` (object)
- `createdAt`, `updatedAt`

**Indexes**
- `userId, status`
- `createdAt`

---

### 2.26 media

**Purpose:** Uploaded competition media metadata for Supabase Storage-backed galleries, participant upload history, and moderation.

**Fields**
- `_id` (ObjectId)
- `competitionId` (ObjectId, ref: competitions, required)
- `uploadedBy` (ObjectId, ref: users, required)
- `teamId` (ObjectId, ref: teams)
- `title` (string)
- `description` (string)
- `mediaType` (string, enum: IMAGE, VIDEO, DOCUMENT)
- `storageProvider` (string, default: SUPABASE)
- `bucketName` (string, required)
- `storagePath` (string, required)
- `fileUrl` (string)
- `originalFileName` (string, required)
- `mimeType` (string, required)
- `fileSize` (number, required)
- `fileExtension` (string, required)
- `tags` (string[])
- `status` (string, enum: PENDING, APPROVED, REJECTED)
- `reviewedBy` (ObjectId, ref: users)
- `reviewedAt` (date)
- `rejectReason` (string)
- `uploadedAt` (date)
- `createdAt`, `updatedAt`

**Indexes**
- `competitionId`
- `uploadedBy`
- `teamId`
- `mediaType`
- `status`
- `uploadedAt`
- `competitionId, uploadedAt`
- `uploadedBy, uploadedAt`
- `tags`

---

### 2.27 mediaActivities

**Purpose:** Track media upload, view, moderation, and delete activity.

**Fields**
- `_id` (ObjectId)
- `mediaId` (ObjectId, ref: media, required)
- `competitionId` (ObjectId, ref: competitions, required)
- `userId` (ObjectId, ref: users, required)
- `action` (string, enum: UPLOAD, VIEW, DOWNLOAD, APPROVE, REJECT, DELETE)
- `metadata` (object)
- `createdAt` (date)

**Indexes**
- `mediaId, createdAt`
- `competitionId, createdAt`
- `userId, createdAt`
- `action, createdAt`

---

### 2.28 auditLogs

**Purpose:** Track critical actions.

**Fields**
- `_id` (ObjectId)
- `userId` (ObjectId, ref: users)
- `action` (string, required)
- `resourceType` (string)
- `resourceId` (ObjectId)
- `metadata` (object)
- `createdAt` (date, required)

**Indexes**
- `userId, createdAt`
- `resourceType, resourceId`

---

### 2.29 systemConfigurations

**Purpose:** Admin-managed external integration settings.

**Fields**
- `_id` (ObjectId)
- `key` (string, unique, required)
- `value` (mixed, required)
- `isEncrypted` (boolean, default: true)
- `updatedBy` (ObjectId, ref: users)
- `updatedAt` (date)
- `createdAt` (date)

**Indexes**
- `key` unique

---

## 3. Relationships Summary

- One `competition` has many `participants`, `timelineActivitys`, `workshops`, `tracks`, `rounds`, `judgingBoards`, `teams`, `repositories`, `submissions`, `rubrics`, `rankings`, `prizes`, `media`.
- One `user` can have many assigned `roles`.
- One `role` has many `permissions`.
- One `track` has many `rounds` and `teams`.
- One `round` has many `judgingBoards`, `submissions`, and `rankings`.
- One `judgingBoard` has many `teams` and many `judges`.
- One `team` has many `participants`, one `repository`, and many `submissions`.
- One `repository` has many `commits` and `aiReviews`.
- One `workshop` has many `workshopQuestions` and `workshopFeedback`.
- One `submission` has many `scores`.
- One `scoreSheet` has many `scores`.
- One `score` can reference one `aiReviewCriterion` as an AI-suggested criterion score for judge review.
- One `rubric` has many `criteria`.
- One `aiReview` has many `aiReviewCriteria`.
- One `user` can have multiple `participants` across competitions.
- One `media` item has many `mediaActivities`.

---

## 4. Suggested Aggregations

- **Team progress:** join `teams` -> `participants` -> `repositories` -> `commits` (count, lastCommitAt).
- **Round leaderboard:** aggregate `scores` by `submissionId` and compute final ranking.
- **Finalist selection:** filter `rankings` by `isSelectedForFinal` and review `selectionReason`.
- **Workshop rating:** average `workshopFeedback.rating` by `workshopId`.
- **Dashboard totals:** precompute counts for participants, teams, submissions, commits, pending AI reviews.
- **Media statistics:** aggregate `media` by competition, team, uploader, status, media type, and upload date; aggregate `mediaActivities` by `VIEW` action for most-viewed media.

---

## 5. Data Integrity Notes

- Enforce maximum 30 teams per competition using application-level validation.
- Enforce team size using `participants` counts per team.
- Enforce exactly one leader per team with a unique constraint on `teamId + teamRole = LEADER` or application-level validation.
- Ensure `roundId + teamId` uniqueness for submissions.
- Store external secrets in `systemConfigurations` with encryption at rest.
- Store actual competition media files in Supabase Storage, and store only metadata in `media`.
- Store `media.supabase_service_role_key_encrypted` encrypted in `systemConfigurations`; never return the service role key from APIs.
- Keep authorization checks permission-based. Roles should remain permission groups, not route-level access conditions.
- For webhook reliability, store processing status in `auditLogs` or a dedicated webhook log collection if needed.
