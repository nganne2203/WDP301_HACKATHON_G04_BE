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
- `passwordHash` (string)
- `fullName` (string, required)
- `status` (string, enum: PENDING, APPROVED, REJECTED, SUSPENDED)
- `roles` (ObjectId[], ref: roles)
- `avatarUrl` (string)
- `phone` (string)
- `bio` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `email` unique
- `googleId` unique sparse
- `roles`

---

### 2.2 roles

**Purpose:** RBAC role definitions.

**Fields**
- `_id` (ObjectId)
- `name` (string, unique)
- `description` (string)
- `permissions` (ObjectId[], ref: permissions)
- `createdAt`, `updatedAt`

**Indexes**
- `name` unique

---

### 2.3 permissions

**Purpose:** Fine-grained permission catalog.

**Fields**
- `_id` (ObjectId)
- `code` (string, unique)
- `description` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `code` unique

---

### 2.4 events

**Purpose:** Hackathon event container.

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

### 2.5 timelineEvents

**Purpose:** Scheduled activities within an event.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
- `title` (string, required)
- `description` (string)
- `startTime` (date)
- `endTime` (date)
- `eventType` (string, enum: WORKSHOP, CHECK_IN, ROUND, RESULT_PUBLISHING, CEREMONY, OTHER)
- `status` (string, enum: SCHEDULED, ONGOING, COMPLETED, CANCELLED)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId, startTime`
- `eventType`

---

### 2.6 workshops

**Purpose:** Workshop details and schedule.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events)
- `timelineEventId` (ObjectId, ref: timelineEvents)
- `title` (string, required)
- `description` (string)
- `presenterId` (ObjectId, ref: users)
- `meetLink` (string)
- `startTime` (date)
- `endTime` (date)
- `status` (string, enum: SCHEDULED, LIVE, COMPLETED, CANCELLED)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId, startTime`
- `presenterId`

---

### 2.7 workshopQuestions

**Purpose:** Participant questions and votes.

**Fields**
- `_id` (ObjectId)
- `workshopId` (ObjectId, ref: workshops, required)
- `authorId` (ObjectId, ref: users)
- `content` (string, required)
- `voteCount` (number, default: 0)
- `createdAt`, `updatedAt`

**Indexes**
- `workshopId, createdAt`
- `voteCount`

---

### 2.8 workshopFeedback

**Purpose:** Ratings and textual feedback for workshops.

**Fields**
- `_id` (ObjectId)
- `workshopId` (ObjectId, ref: workshops, required)
- `authorId` (ObjectId, ref: users)
- `rating` (number, min: 1, max: 5)
- `comment` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `workshopId, authorId` unique

---

### 2.9 tracks

**Purpose:** Competition categories within an event.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
- `name` (string, required)
- `description` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId, name` unique

---

### 2.10 rounds

**Purpose:** Competition rounds per track.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
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
- `eventId, trackId`
- `submissionDeadline`

---

### 2.11 judgingBoards

**Purpose:** Preliminary and final judging board assignments.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
- `roundId` (ObjectId, ref: rounds, required)
- `name` (string, required)
- `boardNumber` (number, required)
- `teamIds` (ObjectId[], ref: teams)
- `judgeIds` (ObjectId[], ref: users)
- `maxTeams` (number, default: 10)
- `status` (string, enum: DRAFT, ASSIGNED, SCORING, COMPLETED)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId, roundId, boardNumber` unique
- `judgeIds`
- `teamIds`

---

### 2.12 participants

**Purpose:** Hackathon participant records for event registration, team assignment, check-in, and GitHub access.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
- `userId` (ObjectId, ref: users, required)
- `teamId` (ObjectId, ref: teams)
- `teamRole` (string, enum: MEMBER, LEADER)
- `checkInStatus` (string, enum: NOT_CHECKED_IN, CHECKED_IN)
- `githubAccessStatus` (string, enum: NOT_GRANTED, GRANTED, REVOKED)
- `status` (string, enum: INVITED, REGISTERED, ACTIVE, WITHDRAWN)
- `joinedAt` (date)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId, userId` unique
- `eventId, teamId`
- `checkInStatus`
- `githubAccessStatus`
- `teamId, teamRole` unique for `teamRole = LEADER`

---

### 2.13 teams

**Purpose:** Team registration and team-level metadata.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
- `trackId` (ObjectId, ref: tracks)
- `name` (string, required)
- `status` (string, enum: ACTIVE, INACTIVE, DISQUALIFIED)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId, trackId`
- `name`

---

### 2.14 repositories

**Purpose:** GitHub repository metadata per team.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events)
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

### 2.15 commits

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

### 2.16 submissions

**Purpose:** Team submission artifacts.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events)
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

### 2.17 rubrics

**Purpose:** Scoring rubrics.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events)
- `title` (string, required)
- `description` (string)
- `totalScore` (number)
- `createdBy` (ObjectId, ref: users)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId`

---

### 2.18 criteria

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

### 2.19 scores

**Purpose:** Judge scores per submission and criterion.

**Fields**
- `_id` (ObjectId)
- `submissionId` (ObjectId, ref: submissions, required)
- `scoreSheetId` (ObjectId, ref: scoreSheets)
- `judgeId` (ObjectId, ref: users, required)
- `criterionId` (ObjectId, ref: criteria)
- `aiReviewCriterionId` (ObjectId, ref: aiReviewCriteria)
- `aiSuggestedScore` (number)
- `scoreValue` (number, required)
- `isOverridden` (boolean, default: false)
- `overrideReason` (string)
- `comment` (string)
- `createdAt`, `updatedAt`

**Indexes**
- `submissionId, judgeId, criterionId` unique
- `scoreSheetId`
- `judgeId`
- `aiReviewCriterionId`

---

### 2.20 rankings

**Purpose:** Precomputed rankings by round or track.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
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
- `eventId, rankingType, roundId, trackId`
- `eventId, rankingType, teamId`
- `eventId, rankingType, participantId`
- `eventId, rankingType, chapterName`
- `eventId, rankingType, roundId, trackId, rank` unique
- `eventId, roundId, isSelectedForFinal`
- `rank`

---

### 2.21 prizes

**Purpose:** Prize definitions and assignment.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events, required)
- `title` (string, required)
- `description` (string)
- `amount` (number)
- `sponsor` (string)
- `teamId` (ObjectId, ref: teams)
- `createdAt`, `updatedAt`

**Indexes**
- `eventId`

---

### 2.22 aiReviews

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
- `score` (number)
- `requestedBy` (ObjectId, ref: users)
- `requestedAt` (date)
- `completedAt` (date)
- `createdAt`, `updatedAt`

**Indexes**
- `repositoryId, requestedAt`
- `status`

---

### 2.23 aiReviewCriteria

**Purpose:** Store rubric-aligned AI criterion details and suggestions.

**Fields**
- `_id` (ObjectId)
- `aiReviewId` (ObjectId, ref: aiReviews, required)
- `criterionId` (ObjectId, ref: criteria, required)
- `name` (string, required)
- `code` (string)
- `description` (string)
- `maxScore` (number, required)
- `score` (number)
- `weight` (number, default: 1)
- `feedback` (string)
- `strengths` (string[])
- `weaknesses` (string[])
- `suggestions` (string[])
- `evidence` (string[])
- `order` (number, default: 0)
- `createdAt`, `updatedAt`

**Indexes**
- `aiReviewId, order`
- `aiReviewId, code`

---

### 2.24 notifications

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

### 2.25 media

**Purpose:** Uploaded media and gallery items.

**Fields**
- `_id` (ObjectId)
- `eventId` (ObjectId, ref: events)
- `uploadedBy` (ObjectId, ref: users)
- `url` (string, required)
- `caption` (string)
- `tags` (string[])
- `createdAt`, `updatedAt`

**Indexes**
- `eventId, createdAt`
- `tags`

---

### 2.26 auditLogs

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

### 2.27 systemConfigurations

**Purpose:** Admin-managed external integration settings.

**Fields**
- `_id` (ObjectId)
- `key` (string, unique, required)
- `value` (object, required)
- `isEncrypted` (boolean, default: true)
- `updatedBy` (ObjectId, ref: users)
- `updatedAt` (date)
- `createdAt` (date)

**Indexes**
- `key` unique

---

## 3. Relationships Summary

- One `event` has many `participants`, `timelineEvents`, `workshops`, `tracks`, `rounds`, `judgingBoards`, `teams`, `repositories`, `submissions`, `rubrics`, `rankings`, `prizes`, `media`.
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
- One `user` can have multiple `participants` across events.

---

## 4. Suggested Aggregations

- **Team progress:** join `teams` -> `participants` -> `repositories` -> `commits` (count, lastCommitAt).
- **Round leaderboard:** aggregate `scores` by `submissionId` and compute final ranking.
- **Finalist selection:** filter `rankings` by `isSelectedForFinal` and review `selectionReason`.
- **Workshop rating:** average `workshopFeedback.rating` by `workshopId`.
- **Dashboard totals:** precompute counts for participants, teams, submissions, commits, pending AI reviews.

---

## 5. Data Integrity Notes

- Enforce maximum 30 teams per event using application-level validation.
- Enforce team size using `participants` counts per team.
- Enforce exactly one leader per team with a unique constraint on `teamId + teamRole = LEADER` or application-level validation.
- Ensure `roundId + teamId` uniqueness for submissions.
- Store external secrets in `systemConfigurations` with encryption at rest.
- For webhook reliability, store processing status in `auditLogs` or a dedicated webhook log collection if needed.
