# SEAL Backend Architecture

## 1. Overview

This document describes the backend architecture for **SEAL – Hackathon Management Platform with AI-assisted Repository Evaluation**.

The backend is built with:

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
- Third-party AI API Integration as a supporting evaluation feature

The backend follows a **Module-based Architecture** combined with the **Repository Pattern**.

---

## 2. Architecture Style

The backend is organized by business modules.  
Each module contains its own:

- route
- controller
- service
- repository
- validation

This structure helps separate responsibilities clearly.

```txt
Route → Controller → Service → Repository → Model → Database
```

### Responsibility of each layer

| Layer | Responsibility |
|---|---|
| Route | Define API endpoints |
| Controller | Handle request and response |
| Service | Handle business logic |
| Repository | Query database using Mongoose |
| Model | Define MongoDB schema |
| Middleware | Handle authentication, authorization, validation, and errors |

Authorization is permission-based. Roles are stored in MongoDB only as groups of permissions. Routes use `permissionMiddleware(PERMISSIONS.X)` and do not check role names directly.

---

## 3. Recommended Folder Structure

```txt
seal-be/
├── src/
│   ├── config/
│   │   ├── db.js
│   │   ├── env.js
│   │   ├── cloudinary.js
│   │   ├── github.js
│   │   └── aiProvider.js
│   │
│   ├── constants/
│   │   ├── permissions.js
│   │   ├── status.js
│   │   ├── eventTypes.js
│   │   └── webhookTypes.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── permission.middleware.js
│   │   ├── error.middleware.js
│   │   ├── validate.middleware.js
│   │   ├── upload.middleware.js
│   │   └── githubWebhook.middleware.js
│   │
│   ├── utils/
│   │   ├── jwt.util.js
│   │   ├── password.util.js
│   │   ├── response.util.js
│   │   ├── audit.util.js
│   │   ├── exportCsv.util.js
│   │   ├── encryption.util.js
│   │   ├── github.util.js
│   │   └── pagination.util.js
│   │
│   ├── models/
│   │   ├── user.model.js
│   │   ├── role.model.js
│   │   ├── permission.model.js
│   │   ├── event.model.js
│   │   ├── participant.model.js
│   │   ├── timelineEvent.model.js
│   │   ├── workshop.model.js
│   │   ├── workshopQuestion.model.js
│   │   ├── workshopRating.model.js
│   │   ├── workshopFeedback.model.js
│   │   ├── track.model.js
│   │   ├── round.model.js
│   │   ├── judgingBoard.model.js
│   │   ├── team.model.js
│   │   ├── repository.model.js
│   │   ├── commit.model.js
│   │   ├── submission.model.js
│   │   ├── rubric.model.js
│   │   ├── criterion.model.js
│   │   ├── score.model.js
│   │   ├── ranking.model.js
│   │   ├── prize.model.js
│   │   ├── aiReview.model.js
│   │   ├── notification.model.js
│   │   ├── media.model.js
│   │   ├── auditLog.model.js
│   │   └── systemConfig.model.js
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.route.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.repository.js
│   │   │   └── auth.validation.js
│   │   │
│   │   ├── google/
│   │   │   ├── google.route.js
│   │   │   ├── google.controller.js
│   │   │   ├── google.service.js
│   │   │   ├── google.repository.js
│   │   │   └── google.validation.js
│   │   │
│   │   ├── users/
│   │   │   ├── user.route.js
│   │   │   ├── user.controller.js
│   │   │   ├── user.service.js
│   │   │   ├── user.repository.js
│   │   │   └── user.validation.js
│   │   │
│   │   ├── roles/
│   │   │   ├── role.route.js
│   │   │   ├── role.controller.js
│   │   │   ├── role.service.js
│   │   │   ├── role.repository.js
│   │   │   └── role.validation.js
│   │   │
│   │   ├── events/
│   │   │   ├── event.route.js
│   │   │   ├── event.controller.js
│   │   │   ├── event.service.js
│   │   │   ├── event.repository.js
│   │   │   └── event.validation.js
│   │   │
│   │   ├── timelines/
│   │   │   ├── timeline.route.js
│   │   │   ├── timeline.controller.js
│   │   │   ├── timeline.service.js
│   │   │   ├── timeline.repository.js
│   │   │   └── timeline.validation.js
│   │   │
│   │   ├── workshops/
│   │   │   ├── workshop.route.js
│   │   │   ├── workshop.controller.js
│   │   │   ├── workshop.service.js
│   │   │   ├── workshop.repository.js
│   │   │   └── workshop.validation.js
│   │   │
│   │   ├── tracks/
│   │   │   ├── track.route.js
│   │   │   ├── track.controller.js
│   │   │   ├── track.service.js
│   │   │   ├── track.repository.js
│   │   │   └── track.validation.js
│   │   │
│   │   ├── rounds/
│   │   │   ├── round.route.js
│   │   │   ├── round.controller.js
│   │   │   ├── round.service.js
│   │   │   ├── round.repository.js
│   │   │   └── round.validation.js
│   │   │
│   │   ├── teams/
│   │   │   ├── team.route.js
│   │   │   ├── team.controller.js
│   │   │   ├── team.service.js
│   │   │   ├── team.repository.js
│   │   │   └── team.validation.js
│   │   │
│   │   ├── repositories/
│   │   │   ├── repository.route.js
│   │   │   ├── repository.controller.js
│   │   │   ├── repository.service.js
│   │   │   ├── repository.repository.js
│   │   │   └── repository.validation.js
│   │   │
│   │   ├── github/
│   │   │   ├── github.route.js
│   │   │   ├── github.controller.js
│   │   │   ├── github.service.js
│   │   │   ├── github.repository.js
│   │   │   └── github.validation.js
│   │   │
│   │   ├── webhooks/
│   │   │   ├── webhook.route.js
│   │   │   ├── webhook.controller.js
│   │   │   ├── webhook.service.js
│   │   │   └── webhook.repository.js
│   │   │
│   │   ├── commits/
│   │   │   ├── commit.route.js
│   │   │   ├── commit.controller.js
│   │   │   ├── commit.service.js
│   │   │   ├── commit.repository.js
│   │   │   └── commit.validation.js
│   │   │
│   │   ├── submissions/
│   │   │   ├── submission.route.js
│   │   │   ├── submission.controller.js
│   │   │   ├── submission.service.js
│   │   │   ├── submission.repository.js
│   │   │   └── submission.validation.js
│   │   │
│   │   ├── rubrics/
│   │   │   ├── rubric.route.js
│   │   │   ├── rubric.controller.js
│   │   │   ├── rubric.service.js
│   │   │   ├── rubric.repository.js
│   │   │   └── rubric.validation.js
│   │   │
│   │   ├── scoring/
│   │   │   ├── scoring.route.js
│   │   │   ├── scoring.controller.js
│   │   │   ├── scoring.service.js
│   │   │   ├── scoring.repository.js
│   │   │   ├── scoring.validation.js
│   │   │   └── scoringCalculator.js
│   │   │
│   │   ├── ranking/
│   │   │   ├── ranking.route.js
│   │   │   ├── ranking.controller.js
│   │   │   ├── ranking.service.js
│   │   │   ├── ranking.repository.js
│   │   │   └── rankingCalculator.js
│   │   │
│   │   ├── ai-review/
│   │   │   ├── aiReview.route.js
│   │   │   ├── aiReview.controller.js
│   │   │   ├── aiReview.service.js
│   │   │   ├── aiReview.repository.js
│   │   │   ├── aiProvider.service.js
│   │   │   └── aiReview.validation.js
│   │   │
│   │   ├── media/
│   │   │   ├── media.route.js
│   │   │   ├── media.controller.js
│   │   │   ├── media.service.js
│   │   │   ├── media.repository.js
│   │   │   └── media.validation.js
│   │   │
│   │   ├── notifications/
│   │   │   ├── notification.route.js
│   │   │   ├── notification.controller.js
│   │   │   ├── notification.service.js
│   │   │   ├── notification.repository.js
│   │   │   └── notification.validation.js
│   │   │
│   │   ├── configurations/
│   │   │   ├── configuration.route.js
│   │   │   ├── configuration.controller.js
│   │   │   ├── configuration.service.js
│   │   │   ├── configuration.repository.js
│   │   │   └── configuration.validation.js
│   │   │
│   │   ├── prizes/
│   │   │   ├── prize.route.js
│   │   │   ├── prize.controller.js
│   │   │   ├── prize.service.js
│   │   │   ├── prize.repository.js
│   │   │   └── prize.validation.js
│   │   │
│   │   └── audit-logs/
│   │       ├── auditLog.route.js
│   │       ├── auditLog.controller.js
│   │       ├── auditLog.service.js
│   │       └── auditLog.repository.js
│   │
│   ├── routes/
│   │   └── index.js
│   │
│   └── server.js
│
├── .env
├── package.json
└── README.md
```

---

## 4. Module Layer Design

Each module should follow this structure:

```txt
modules/example/
├── example.route.js
├── example.controller.js
├── example.service.js
├── example.repository.js
└── example.validation.js
```

---

## 5. Repository Pattern

The repository layer is responsible for all database queries.

Controllers and services should not directly use Mongoose models.

### Bad practice

```js
// Do not do this in service
const user = await User.findById(id);
```

### Recommended practice

```js
// Service calls repository
const user = await userRepository.findById(id);
```

---

## 6. Example: User Repository

```js
const User = require("../../models/user.model");

const create = async (data) => {
  return User.create(data);
};

const findById = async (id) => {
  return User.findById(id).populate({
    path: "roles",
    populate: {
      path: "permissions",
    },
  });
};

const findByEmail = async (email) => {
  return User.findOne({ email }).populate({
    path: "roles",
    populate: {
      path: "permissions",
    },
  });
};

const updateById = async (id, data) => {
  return User.findByIdAndUpdate(id, data, { new: true });
};

const deleteById = async (id) => {
  return User.findByIdAndDelete(id);
};

module.exports = {
  create,
  findById,
  findByEmail,
  updateById,
  deleteById,
};
```

---

## 7. Example: User Service

```js
const userRepository = require("./user.repository");

const getUserById = async (id) => {
  const user = await userRepository.findById(id);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

const approveUser = async (id) => {
  return userRepository.updateById(id, {
    status: "APPROVED",
  });
};

module.exports = {
  getUserById,
  approveUser,
};
```

---

## 8. Example: User Controller

```js
const userService = require("./user.service");
const { successResponse } = require("../../utils/response.util");

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);

    return successResponse(res, {
      message: "Get user successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const approveUser = async (req, res, next) => {
  try {
    const user = await userService.approveUser(req.params.id);

    return successResponse(res, {
      message: "Approve user successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserById,
  approveUser,
};
```

---

## 9. Example: User Route

```js
const express = require("express");
const userController = require("./user.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");
const { PERMISSIONS } = require("../../constants/permissions");

const router = express.Router();

router.get(
  "/:id",
  authMiddleware,
  permissionMiddleware(PERMISSIONS.USER_VIEW),
  userController.getUserById
);

router.patch(
  "/:id/approve",
  authMiddleware,
  permissionMiddleware(PERMISSIONS.PARTICIPANT_APPROVE),
  userController.approveUser
);

module.exports = router;
```

---

## 9.1 Authorization Flow

Authenticated requests use this authorization flow:

1. `authorizationMiddleware` verifies the JWT.
2. The middleware loads the user from MongoDB with populated `roles.permissions`.
3. `USER_SERVICE.getPermissionCodes(user)` merges and deduplicates permission codes from every assigned role.
4. The middleware stores `req.user = { id, email, roles, role, permissions }`.
5. Routes call `permissionMiddleware(PERMISSIONS.PERMISSION_CODE)`.
6. Controllers and services handle business rules such as ownership, event state, or submission state. They should not check role names for access control.

Current route examples:

```js
router.get(
  "/",
  authorizationMiddleware,
  permissionMiddleware(PERMISSIONS.EVENT_VIEW),
  eventController.listEvents
);

router.post(
  "/",
  authorizationMiddleware,
  permissionMiddleware(PERMISSIONS.EVENT_CREATE),
  eventController.createEvent
);

router.patch(
  "/:id/roles",
  authorizationMiddleware,
  permissionMiddleware(PERMISSIONS.USER_ROLE_ASSIGN),
  userController.assignRoles
);
```

---

## 10. Main Route Aggregation

File: `src/routes/index.js`

```js
const express = require("express");

const authRoutes = require("../modules/auth/auth.route");
const userRoutes = require("../modules/users/user.route");
const eventRoutes = require("../modules/events/event.route");
const timelineRoutes = require("../modules/timelines/timeline.route");
const workshopRoutes = require("../modules/workshops/workshop.route");
const teamRoutes = require("../modules/teams/team.route");
const repositoryRoutes = require("../modules/repositories/repository.route");
const githubRoutes = require("../modules/github/github.route");
const webhookRoutes = require("../modules/webhooks/webhook.route");
const commitRoutes = require("../modules/commits/commit.route");
const submissionRoutes = require("../modules/submissions/submission.route");
const scoringRoutes = require("../modules/scoring/scoring.route");
const rankingRoutes = require("../modules/ranking/ranking.route");
const aiReviewRoutes = require("../modules/ai-review/aiReview.route");
const mediaRoutes = require("../modules/media/media.route");
const notificationRoutes = require("../modules/notifications/notification.route");
const configurationRoutes = require("../modules/configurations/configuration.route");
const auditLogRoutes = require("../modules/audit-logs/auditLog.route");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/events", eventRoutes);
router.use("/timelines", timelineRoutes);
router.use("/workshops", workshopRoutes);
router.use("/teams", teamRoutes);
router.use("/repositories", repositoryRoutes);
router.use("/github", githubRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/commits", commitRoutes);
router.use("/submissions", submissionRoutes);
router.use("/scoring", scoringRoutes);
router.use("/rankings", rankingRoutes);
router.use("/ai-reviews", aiReviewRoutes);
router.use("/media", mediaRoutes);
router.use("/notifications", notificationRoutes);
router.use("/configurations", configurationRoutes);
router.use("/audit-logs", auditLogRoutes);

module.exports = router;
```

---

## 11. Core Modules

### 11.1 Auth Module

Handles:

- login
- Google OAuth login
- Google OAuth callback handling
- register
- refresh token
- current user profile
- password hashing
- JWT generation
- resolved permission codes in the access token and authenticated user context

---

### 11.2 Google Integration Module

Handles:

- Google Calendar account connection
- encrypted Google token storage
- access token refresh
- Google Calendar event creation
- Google Meet link creation for workshops

---

### 11.3 Users Module

Handles:

- user profile
- user approval
- user status
- user role assignment
- normalized user responses with merged permission codes

---

### 11.4 Roles Module

Handles:

- roles
- permissions
- RBAC role-permission grouping
- permission catalog management

Roles are administrative containers. Runtime authorization is performed with permission codes through middleware.

---

### 11.5 Events Module

Handles:

- hackathon event creation
- event update
- event status
- event lifecycle

---

### 11.6 Timelines Module

Handles:

- timeline items
- workshop schedule
- round schedule
- check-in schedule
- result publishing schedule

---

### 11.7 Workshops Module

Handles:

- workshop information
- Google Meet link
- presenter information
- participant questions
- workshop rating
- feedback

---

### 11.8 Teams Module

Handles:

- team creation
- participant team assignment
- team leader management
- team approval
- track registration

---

### 11.9 Repositories Module

Handles internal repository records.

Responsibilities:

- store repository URL
- store GitHub repository ID
- map repository to team
- map repository to event
- track repository status

---

### 11.10 GitHub Module

Handles communication with GitHub API.

Responsibilities:

- create GitHub organization
- create repository
- invite collaborators
- revoke collaborators
- fetch repository metadata
- register GitHub webhook

---

### 11.11 Webhooks Module

Handles incoming webhook events.

Responsibilities:

- receive GitHub webhook
- verify webhook signature
- store webhook event logs
- trigger commit synchronization
- trigger AI review if needed

---

### 11.12 Commits Module

Handles commit data.

Responsibilities:

- store commit metadata
- track commit author
- track added/removed lines
- provide commit dashboard data

---

### 11.13 Judging and Ranking Module

Handles judging board assignment, rubric scoring, score aggregation, finalist selection, and result publishing.

Responsibilities:

- assign teams to judging boards
- assign judges to boards
- store rubric-based scores
- aggregate scores
- select finalists
- publish rankings

---

### 11.14 AI Review Module

Handles third-party AI-assisted repository evaluation as a supporting feature.

Responsibilities:

- send commit diff or repository metadata to third-party AI API
- store AI review result
- retry failed review
- display AI review summary

Important note:

The system does not train or build its own AI model.  
It only integrates third-party AI services through APIs.

---

### 11.15 Configurations Module

Handles system configuration.

Responsibilities:

- store GitHub token
- store AI API key
- store webhook secret
- store external scoring API config

Sensitive data should be encrypted before saving to the database.

---

### 11.16 Media Module

Handles Supabase-backed event media upload, gallery access, tracking, moderation, and statistics.

Responsibilities:

- parse multipart uploads through the backend,
- validate file extension, MIME type, and size,
- store files in a private Supabase Storage bucket,
- store media metadata in MongoDB,
- generate short-lived signed URLs,
- track upload/view/moderation/delete actions,
- write audit logs for media actions,
- keep Supabase service role keys encrypted and hidden from API responses.

Routes:

- `POST /api/media/upload`
- `GET /api/media/my-history`
- `GET /api/events/:id/gallery`
- `GET /api/media/:mediaId/view-url`
- `DELETE /api/media/:mediaId`
- `GET /api/admin/media`
- `PATCH /api/admin/media/:mediaId/approve`
- `PATCH /api/admin/media/:mediaId/reject`
- `GET /api/admin/media/statistics`
- `GET /api/admin/media/config`
- `PUT /api/admin/media/config`

---

## 12. Database Models

Main models:

```txt
User
Role
Permission
Event
Participant
TimelineEvent
Workshop
Track
Round
JudgingBoard
Team
Repository
Commit
CommitDiff
Submission
Rubric
Criterion
ScoreSheet
Score
Ranking
Prize
AIReview
AIReviewCriterion
Notification
Media
MediaActivity
AuditLog
SystemConfig
```

### 12.1 Fall 2025 Competition Data Rules

For SEAL Hackathon Fall 2025, the database models represent the official competition rules as follows:

- `Permission` stores the authorization actions used by routes, such as `EVENT_CREATE`, `TRACK_VIEW`, `USER_ROLE_ASSIGN`, `SCORE_CREATE`, and `RESULT_PUBLISH`.
- `Role` stores permission groups only. Seeded roles include `ADMIN`, `EVENT_COORDINATOR`, `COORDINATOR`, `JUDGE`, `MENTOR`, `USER`, and `PARTICIPANT`.
- `User.roles` stores assigned role references. Services resolve and deduplicate permissions from all assigned roles before JWT generation and request authorization.
- `Event` stores the hackathon season, year, theme, registration window, event schedule, team size rule, and finalist slot rule.
- `Track` represents the preliminary competition groups. Fall 2025 has:
  - `Bảng A`: AI cho Thu thập Yêu cầu & Thiết kế.
  - `Bảng B`: AI cho Phát triển, Kiểm thử & Vận hành.
- Teams are assigned into preliminary groups through both:
  - `Team.trackId`, which stores each team's selected/drawn group.
  - `Track.teamIds`, which stores the explicit team list for each group for fast board/ranking reads.
- `Round.assignedTeamIds` stores teams participating in a round, and `Round.promotedTeamIds` stores teams promoted from preliminary rounds into the final.
- `JudgingBoard.teamIds` stores the teams judged by a board in a given round and group.
- `Score` stores official judge-entered rubric scores only. AI review artifacts are stored separately and never become ranking input.
- `Ranking.rankingType` supports the three official ranking tables:
  - `TEAM`: per hackathon and per round/group.
  - `CHAPTER`: year-long chapter ranking.
  - `INDIVIDUAL`: accumulated participant ranking.
- `Ranking.isSelectedForFinal` and `Ranking.selectionReason` record finalist selection decisions.
- `Prize` supports both team prizes and individual prizes through `prizeType`, `teamId`, and `participantId`.
- `Participant` stores eligibility-related flags such as graduation status, activity attendance, and media consent.

---

## 13. API Naming Convention

Use RESTful API style.

Examples:

```txt
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/google
GET    /api/auth/google/callback
GET    /api/google/connect
GET    /api/google/callback
GET    /api/users
PATCH  /api/users/:id/approve

POST   /api/events
GET    /api/events
GET    /api/events/:id
PATCH  /api/events/:id
DELETE /api/events/:id

POST   /api/teams
GET    /api/teams/:id

POST   /api/repositories/create-for-team
GET    /api/repositories/team/:teamId

POST   /api/github/create-repository
POST   /api/github/invite-collaborator
POST   /api/github/revoke-access

POST   /api/webhooks/github

GET    /api/commits/repository/:repositoryId

POST   /api/ai-reviews/repository/:repositoryId
POST   /api/ai-reviews/:id/retry

POST   /api/workshops/:id/google-meet
POST   /api/scoring/submit
GET    /api/rankings/event/:eventId
```

---

## 14. Recommended Naming Convention

### File naming

Use camelCase or kebab-case consistently.

Recommended:

```txt
user.controller.js
user.service.js
user.repository.js
user.validation.js
```

### Model naming

```txt
user.model.js
event.model.js
repository.model.js
aiReview.model.js
```

### Function naming

Use camelCase:

```js
createUser()
findUserByEmail()
approveUser()
createRepositoryForTeam()
syncCommitFromWebhook()
```

---

## 15. Error Handling

All errors should be passed to the global error middleware.

```js
try {
  // logic
} catch (error) {
  next(error);
}
```

Recommended error response format:

```json
{
  "success": false,
  "message": "User not found",
  "errors": []
}
```

---

## 16. Success Response Format

Recommended success response format:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {}
}
```

---

## 17. Environment Variables

Example `.env` file:

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/seal

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_secret
REFRESH_TOKEN_EXPIRES_IN=30d
TOKEN_ENCRYPTION_SECRET=your_32_byte_or_longer_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_AUTH_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
GOOGLE_CONNECT_CALLBACK_URL=http://localhost:3000/api/google/callback
FRONTEND_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

GITHUB_API_URL=https://api.github.com

AI_PROVIDER=openai
AI_API_URL=https://api.openai.com/v1
```

Important:

Sensitive provider tokens should be configurable from the Admin Configuration module and stored encrypted in the database when required.

---

## 18. Final Notes

This architecture is suitable for the SEAL project because it supports:

- clear module separation,
- repository pattern,
- scalable business logic,
- GitHub integration,
- webhook processing,
- third-party AI integration,
- audit logging,
- future extension.

The repository pattern makes the backend easier to maintain because database logic is separated from business logic.
