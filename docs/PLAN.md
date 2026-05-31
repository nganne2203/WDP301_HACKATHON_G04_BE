# WDP Next Feature Implementation Plan

## 1. Current Implementation Summary

* Implemented modules: authentication/local login/register/Google login/JWT refresh, user approval/status/role assignment, Google Calendar connect, event CRUD, track CRUD, workshop CRUD/questions/votes/ratings/feedback/Google Meet.
* Partially implemented modules: RBAC admin, event lifecycle, tracks, participants, teams, check-in, repositories, submissions, judging, scoring, rankings, AI review, notifications, audit logs, configurations.
* Missing modules: timeline API, participant API, team API, rounds/judging-board API, repository/GitHub/webhook/commit APIs, submission/rubric/scoring/ranking/result APIs, AI-review API, notification/audit/config/media APIs.

## 2. Documentation Sources Reviewed

* `WDP301_BE/docs/WDP301-docs.md`
* `WDP301_BE/docs/WDP301-architecture.md`
* `WDP301_BE/docs/WDP301-database.md`
* Backend source: `src/routes`, `src/modules`, `src/models`, `src/constants`, `src/middlewares`, `src/utils`, `src/scripts/initDb.js`
* Frontend source: `WDP301_FE/src/app`, `src/lib/api`, `src/store`, `src/lib/data.ts`

## 3. Documentation vs Source Code Gap Analysis

| Feature | Required by Documentation | Current Source Code Status | Missing Parts | Priority |
|---|---|---|---|---|
| Auth/RBAC | Google OAuth, JWT, approval, dynamic roles/permissions | Mostly implemented | Role/permission CRUD UI/API; forgot password is UI-only | P1 |
| Workshops | CRUD, Meet, questions, votes, ratings, feedback | Backend mostly implemented | Dedicated frontend workshop admin/participant flows; FE has stale `/ratings/stats` client endpoint | P1 |
| Events | Lifecycle, registration config, invitations | Basic CRUD only | Registration forms, invitations, lifecycle automation | P1 |
| Timelines | Schedule activities and notifications | Model/seed only | API, UI, notification triggers | P0 |
| Participants/check-in | Registration, approval, attendance, GitHub status | Model/seed only; FE uses user list/mock check-in | Participant API, check-in API, attendance reports | P0 |
| Teams | Create/join/manage teams, leader, max 30 teams | Model/seed only; FE mock | Team API, membership rules, track assignment | P0 |
| Rounds/judging boards | Rounds, board assignment, judge access | Models/seed only; FE mock | Round/board APIs, auto-assignment, judge scoping | P1 |
| Repositories/GitHub | Config, repo creation, invites, webhooks, commits | Models/seed only; FE mock | Config API, GitHub service, webhook verification, commit sync | P2 |
| Submissions/rubrics/scoring | Submit artifacts, rubric scoring, score sheets | Models/seed only; FE mock | APIs, judge workflow, validation, locks | P2 |
| Rankings/results | Ranking, finalists, tie-breakers, publish | Models/seed only; FE mock | Ranking generation, tie-break API, publish history | P3 |
| AI review | Provider config, diff cache, retry, summaries | Models/seed only | Provider service, review API, retry flow, UI | P3 |
| Notifications/audit/config | Reminders, audit search, external secrets | Models only; audit middleware imports missing repository | APIs, encryption, middleware repair, UI | P3 |

## 4. Recommended Implementation Order

1. Timeline management foundation.
2. Participant registration, check-in, and attendance.
3. Team management and track assignment.
4. Rounds and judging-board assignment.
5. System configuration plus repository/GitHub/webhook/commit flow.
6. Submissions, rubrics, score sheets, scoring, rankings, results.
7. AI-assisted review.
8. Notifications, audit-log search, dashboards, and final polish.

## 5. Detailed Plan Per Feature

### Timeline Management

* Goal: expose event schedules used by workshops, check-in, rounds, and result publishing.
* Reason for priority: other lifecycle modules need scheduled activities.
* Backend tasks: add `timelines` module using repository pattern, validation, pagination, event existence checks.
* Frontend tasks: add `timelinesApi`, timeline types, and event timeline UI.
* Database/entity changes: reuse `timelineEvent.model.js`; add fields only if notification scheduling needs explicit reminder metadata.
* API endpoints: `GET/POST /api/timelines`, `GET/PATCH/DELETE /api/timelines/:id`.
* Permissions/authorization: `EVENT_VIEW` for read, `EVENT_UPDATE` or new timeline permissions for write.
* Testing checklist: CRUD validation, event scoping, date range, permission failures.
* Dependencies: existing Event model/API.
* Risks: workshop `timelineEventId` exists but no integrity checks yet.

### Participant Registration, Check-in, and Attendance

* Goal: turn user accounts into event participant records.
* Reason for priority: teams, repository access, scoring eligibility, and check-in all depend on participants.
* Backend tasks: add `participants` module for registration, list/filter, status updates, check-in, attended activities.
* Frontend tasks: replace Participants and Check-in mock data with participant APIs.
* Database/entity changes: reuse `Participant`; consider attendance subdocuments only if activity timestamps are required.
* API endpoints: `GET/POST /api/participants`, `PATCH /api/participants/:id`, `PATCH /api/participants/:id/check-in`, `PATCH /api/participants/:id/attendance`.
* Permissions/authorization: participant self-register via `EVENT_VIEW`; coordinator actions via `PARTICIPANT_VIEW` and `PARTICIPANT_APPROVE`.
* Testing checklist: one participant per event/user, check-in transitions, attendance reports, unauthorized access.
* Dependencies: Auth, Users, Events, Timelines.
* Risks: current frontend “Participants” page manages users, not event participants.

### Team Management

* Goal: support team creation, joining, leader assignment, member management, and track registration.
* Reason for priority: repositories, submissions, judging boards, and rankings are team-based.
* Backend tasks: add `teams` module, enforce event max teams, team size, one leader, participant membership, track capacity.
* Frontend tasks: replace coordinator Teams and participant Team pages with real team APIs.
* Database/entity changes: reuse `Team`, `Participant.teamId`, `Participant.teamRole`, `Track.teamIds`.
* API endpoints: `GET/POST /api/teams`, `GET/PATCH/DELETE /api/teams/:id`, `POST /api/teams/:id/members`, `DELETE /api/teams/:id/members/:participantId`, `PATCH /api/teams/:id/track`.
* Permissions/authorization: `TEAM_CREATE`, `TEAM_VIEW`, `TEAM_UPDATE`, `TEAM_DELETE`; ownership checks for team leaders.
* Testing checklist: max 30 teams, leader uniqueness, team size rules, track assignment consistency.
* Dependencies: Participants, Events, Tracks.
* Risks: docs say Participant replaces separate team-member records; avoid adding duplicate membership collections.

### Rounds and Judging Boards

* Goal: configure preliminary/final rounds and assign teams/judges to boards.
* Reason for priority: scoring cannot start until assignments exist.
* Backend tasks: add `rounds` and `judging-boards` modules; implement random balanced assignment.
* Frontend tasks: replace coordinator Judging mock page; add judge assigned-team data source.
* Database/entity changes: reuse `Round` and `JudgingBoard`.
* API endpoints: `GET/POST /api/rounds`, `PATCH /api/rounds/:id`, `GET/POST /api/judging-boards`, `POST /api/judging-boards/auto-assign`.
* Permissions/authorization: `JUDGING_ASSIGN` for assignment; `TEAM_VIEW`/`SCORE_VIEW` for read as appropriate.
* Testing checklist: max teams per board, judge assignment, final promotion fields, judge access boundaries.
* Dependencies: Teams, Tracks, Users with judge roles.
* Risks: documentation conflicts between 3 boards x top 2 finalists and seeded Fall 2025 two-track/top-5 model.

### Repositories, GitHub, Webhooks, and Commits

* Goal: create and monitor GitHub repositories for teams.
* Reason for priority: submissions and AI review depend on repository metadata and commits.
* Backend tasks: add configurations, repositories, github, webhooks, commits modules; encrypt secrets; verify webhook signatures.
* Frontend tasks: replace Repository Management mock page with config, repo, access, sync views.
* Database/entity changes: reuse `SystemConfiguration`, `Repository`, `Commit`, `CommitDiff`; add webhook log model only if needed.
* API endpoints: `/api/configurations`, `/api/repositories`, `/api/github/create-repository`, `/api/github/invite-collaborator`, `/api/github/revoke-access`, `/api/webhooks/github`, `/api/commits/repository/:repositoryId`.
* Permissions/authorization: `SYSTEM_CONFIG_MANAGE`, `GITHUB_CONFIGURE`, `GITHUB_REPOSITORY_CREATE`, `GITHUB_ACCESS_REVOKE`, `TEAM_VIEW`.
* Testing checklist: secret encryption, repo uniqueness, collaborator invite/revoke, webhook signature rejection, idempotent commit sync.
* Dependencies: Teams, Participants, Configurations.
* Risks: network/external API failures need retry/idempotency.

### Submissions, Rubrics, Scoring, Rankings, and Results

* Goal: enable teams to submit artifacts, judges to score, coordinators to rank and publish.
* Reason for priority: this is the core competition outcome flow.
* Backend tasks: add submissions, rubrics/criteria, scoring, ranking/results modules; calculate score sheets and tie-breakers.
* Frontend tasks: replace judge Scoring, participant Dashboard submissions, coordinator Results mock pages.
* Database/entity changes: reuse `Submission`, `Rubric`, `Criterion`, `ScoreSheet`, `Score`, `Ranking`, `Prize`.
* API endpoints: `/api/submissions`, `/api/rubrics`, `/api/scoring/sheets`, `/api/scoring/submit`, `/api/rankings/event/:eventId`, `/api/rankings/:id/tie-break`, `/api/results/publish`.
* Permissions/authorization: `SCORE_CREATE`, `SCORE_VIEW`, `RESULT_PUBLISH`, board-based judge access checks.
* Testing checklist: submission deadline/locks, score totals, one sheet per judge/team/round, finalist selection, unique ranks.
* Dependencies: Teams, Rounds, Boards, Repositories.
* Risks: final tie-break and finalist count rules need confirmation.

### AI Review, Notifications, Audit, and Dashboards

* Goal: add supporting automation and visibility after core lifecycle APIs exist.
* Reason for priority: AI is supporting, not core, and depends on repos/diffs/rubrics.
* Backend tasks: add AI review/provider retry flow, notifications API, audit-log API, dashboard aggregations; repair audit middleware/import mismatch.
* Frontend tasks: surface AI summaries in judge scoring, notifications in topbar, dashboard metrics from APIs.
* Database/entity changes: reuse `AIReview`, `AIReviewCriterion`, `Notification`, `AuditLog`; extend only for missing access-log fields if chosen.
* API endpoints: `/api/ai-reviews/repository/:repositoryId`, `/api/ai-reviews/:id/retry`, `/api/notifications`, `/api/audit-logs`, `/api/dashboard/*`.
* Permissions/authorization: `AI_REVIEW_TRIGGER`, `AI_REVIEW_VIEW`, `AUDIT_LOG_VIEW`, `SYSTEM_CONFIG_MANAGE`.
* Testing checklist: AI retry reuses `CommitDiff`, provider error handling, notification read states, audit search filters.
* Dependencies: Repositories, Commits, Rubrics, Scoring.
* Risks: provider cost/rate limits and sensitive secret handling.

## 6. Suggested Sprint Plan

* Sprint 1: Timeline + Participants + Check-in APIs and frontend integration.
* Sprint 2: Team management + track assignment + participant/team UI replacement.
* Sprint 3: Rounds + judging boards + judge assignment UI.
* Sprint 4: Configurations + repositories + GitHub/webhook/commit flow.
* Sprint 5: Submissions + rubrics + scoring + rankings/results publishing.
* Sprint 6: AI review + notifications + audit logs + dashboard metrics.

## 7. Files/Modules Likely To Be Changed

* Backend: `src/routes/index.js`, `src/constants/permissions.js`, `src/modules/{timelines,participants,teams,rounds,judging-boards,repositories,github,webhooks,commits,submissions,rubrics,scoring,ranking,ai-review,notifications,configurations,audit-logs}`.
* Backend models likely reused: `participant`, `team`, `round`, `judgingBoard`, `repository`, `commit`, `submission`, `rubric`, `criterion`, `scoreSheet`, `score`, `ranking`, `aiReview`, `notification`, `auditLog`, `systemConfiguration`.
* Frontend: `src/lib/api/types.ts`, new API clients, `src/store/useStore.ts` if selected event/participant state expands, coordinator/judge/participant pages currently using `src/lib/data.ts`.

## 8. Open Questions

* Should Fall 2025 use docs rule “3 boards x top 2 = 6 finalists” or seeded/model rule “2 tracks x top 5 = 10 finalists”? Safer direction: make promotion event-configurable and default to documentation values for new events.
* Should participant registration be self-service from event detail pages or coordinator-created invitations first?
* Should check-in be event-level only, or should workshop/seminar attendance store timestamps per activity?
* Should GitHub integration use organization tokens, GitHub App, or per-admin token?
* Should result publishing create immutable history records or rely on `Ranking.publishedAt` plus audit logs?

## 9. Final Recommendation

Implement Participant Registration + Check-in first after authentication and workshops, with Timeline API included as the schedule foundation. Teams should follow immediately after, because every later feature depends on real participant/team records rather than frontend mocks.
