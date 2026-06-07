# SEAL Backend Execution Plan

## 1. Purpose

This file is the execution plan for finishing the backend project.

It is intentionally short and phase-oriented.

For detailed business gaps and canonical differences, use:

- `docs/CANONICAL_ALIGNMENT_REPORT.md`

For old planning context, use:

- `docs/PLAN.md`

## 2. Execution Rules

- Preserve implemented logic unless it is canonically wrong.
- Change seed data freely when seed data conflicts with business rules.
- Treat business documents as the source of truth.
- Make seasonal competition rules configurable at event level.
- Do not rewrite strong existing modules without a clear business reason.

## 3. Current Baseline

### Already implemented and should mostly be kept

- auth
- users and RBAC foundation
- events CRUD
- tracks CRUD
- workshops
- teams invitation workflow
- notifications
- GitHub configuration and repository utility endpoints
- media

### Existing only as models/seed or still incomplete

- timelines
- participants
- rounds
- judging boards
- repositories as an internal domain
- commits and webhook flow
- submissions
- rubrics
- scoring
- rankings
- prizes
- AI review runtime flow
- audit logs as a usable module
- system configuration as a complete admin module

### Must be revised

- event competition rules are not dynamic enough yet
- seed data still looks like product rules
- AI still implies scoring behavior in some schema usage
- ranking/finalist logic is not yet service-driven
- audit log wiring is incomplete

## 4. Execution Phases

## Phase 1: Canonical Alignment and Event Configuration

### Goal

Make the core competition structure dynamic and season-safe.

### Keep

- current event CRUD
- current track CRUD

### Change

- add event-level competition configuration
- remove fixed assumptions like specific board count or finalist count
- revise seed structure so seasonal rules live in event config

### Deliverables

- updated event configuration design
- revised validations
- revised `src/scripts/initDb.js`

### Done when

- one event can define its own board count, finalist count, ranking scope, and tie-break rule
- the system no longer depends on Fall 2025-style hard-coded structure

## Phase 2: Timeline and Participant Backbone

### Goal

Build the real event participation layer.

### Keep

- current participant model direction

### Change

- create timeline APIs
- create participant APIs
- support registration, approval, check-in, attendance, and GitHub access status

### Deliverables

- `timelines` module
- `participants` module
- routes mounted in `src/routes/index.js`

### Done when

- participants are managed as an event domain, not just hidden model data
- check-in and attendance are available through real APIs

## Phase 3: Team Completion and Event-Aware Assignment

### Goal

Finish the team domain on top of the existing invitation flow.

### Keep

- current invitation flow
- temporary account creation flow
- quota protection logic

### Change

- complete coordinator management flows
- add track/board placement flows
- enforce participant-per-event and team-per-event constraints consistently

### Deliverables

- completed team management APIs
- event-aware track/board assignment behavior

### Done when

- teams can be fully managed for an event
- team placement works without hard-coded seasonal assumptions

## Phase 4: Rounds and Judging Boards

### Goal

Create the operational judging structure.

### Keep

- current round and judging board models

### Change

- build rounds APIs
- build judging board APIs
- support judge assignment, team assignment, promotion rules, and tie-break setup

### Deliverables

- `rounds` module
- `judging-boards` module

### Done when

- a season with 2 boards or 3 boards can be configured without code changes
- judges and teams can be assigned by round and board

## Phase 5: Repository Intake, Webhook, and Queue Foundation

### Goal

Turn GitHub integration into a safe asynchronous intake pipeline.

### Keep

- current GitHub config logic
- current repository creation utilities
- current collaborator operations

### Change

- add internal repository domain
- add GitHub webhook intake
- verify webhook signature from raw body
- save webhook delivery records
- enqueue background jobs instead of processing inside the request
- add worker/queue foundation for repository audit jobs
- connect repository state to event and team lifecycle

### Deliverables

- `repositories` module
- `POST /api/github/webhooks`
- webhook event persistence
- queue and worker baseline
- job contract for push processing

### Done when

- repositories are tracked internally
- GitHub push events return fast without heavy processing
- webhook deliveries are persisted and converted into background jobs

## Phase 6: Commit Retrieval, Diff Preprocessing, and Repository Evidence

### Goal

Build the technical evidence pipeline before any AI review call.

### Keep

- current repository and commit-related models where still structurally useful

### Change

- fetch commit metadata and changed files from GitHub or local git
- persist commits and commit diffs
- preprocess diffs before any LLM usage
- filter generated/binary/noisy files
- redact secrets
- keep clean diff payloads under token budget
- support scheduler-driven hourly repository scans

### Deliverables

- commit ingestion flow
- commit diff persistence
- diff preprocessing service
- hourly repository scan job

### Done when

- each important push has commit metadata and normalized diff evidence in storage
- raw diffs are not sent directly to AI
- the system can detect new repository activity through webhook or scheduler

## Phase 7: Static Analysis, AST Context, and Impact Scoring

### Goal

Decide intelligently when AI review is needed and provide stronger technical context.

### Keep

- the principle that AI is advisory only

### Change

- run static analysis before LLM
- add secret scan and dependency scan
- extract changed code context with AST-aware tooling where useful
- compute impact scores for push events
- support `skip`, `hourly batch`, and `per-push audit` decisions

### Deliverables

- static analysis result storage
- changed symbol/context extraction
- impact scoring logic
- decision rules for LLM invocation

### Done when

- README-only or trivial changes can skip LLM
- important service/security changes can trigger per-push AI audit
- evidence passed to AI is structured, reduced, and traceable

## Phase 8: AI Technical Auditor Reports and Judge Support

### Goal

Implement AI as a support layer for judges and coordinators.

### Keep

- existing AI-related models only as transitional assets where needed

### Change

- stop treating AI as scoring authority
- define two review kinds:
  - per-push technical audit
  - team aggregate technical audit
- build prompt inputs from:
  - event context
  - round context
  - repository context
  - diff summary
  - changed code context
  - static analysis summary
  - rubric context
- validate and repair AI JSON output
- reject forbidden AI fields such as score, rank, winner, or finalist decision
- support findings, evidence, comments, suggested tests, and suggested judge questions
- expose reports for judge dashboard consumption only as support material

### Deliverables

- AI review runtime flow
- per-push audit schema
- team aggregate audit schema
- JSON validation/repair layer
- judge/coordinator consumption endpoints

### Done when

- AI reports exist as support material only
- AI output contains no official scoring fields
- per-push and aggregate audit reports can be persisted and retrieved
- official ranking remains fully judge-driven

## Phase 9: Submissions, Official Scoring, Rankings, and Final Hardening

### Goal

Finish official judging and production hardening.

### Keep

- current notifications and media foundations

### Change

- build submissions APIs
- build rubric and criteria management APIs
- build score sheet and score submission APIs
- generate rankings and finalists from judge scores only
- optionally surface AI report links inside judge workflows
- repair audit log integration
- complete configuration APIs where needed
- clean up seed semantics
- add regression and business-rule tests
- update supporting docs after implementation stabilizes

### Deliverables

- `submissions` module
- `rubrics` module
- `scoring` module
- `rankings` module
- working audit flow
- cleaned seed behavior
- critical tests
- synchronized documentation

### Done when

- judges can submit and lock official scores
- rankings and finalists are generated from official judge scores and event rules
- audit logs are usable
- seed data is clearly sample-only
- core business rules are covered by tests

## 5. Recommended Order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8
9. Phase 9

## 6. Immediate Next Sprint

The next sprint should complete:

1. Event configuration alignment
2. Seed cleanup
3. `timelines` module
4. `participants` module
5. team constraint review against participant-per-event rules

## 7. Success Criteria

The backend is considered aligned when:

- competition rules are event-configurable
- participant and team lifecycle are real APIs
- judging structure is operational
- webhook, queue, commit, and diff evidence pipeline are operational
- static analysis and impact scoring run before AI
- official scoring is judge-driven
- rankings are generated from event rules
- AI acts only as Technical Auditor support with per-push and aggregate reports
- seed data no longer behaves like product logic
