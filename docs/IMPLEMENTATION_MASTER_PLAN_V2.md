# SEAL Backend Implementation Master Plan V2

## 1. Purpose

This document is the execution master plan for completing the backend project to a real production-ready operational state.

It replaces older planning assumptions where needed and aligns implementation with the canonical direction:

- the platform is multi-season and event-configurable
- official scoring is judge-driven
- AI is a Technical Auditor support layer only
- GitHub and AI review must run asynchronously through queue and worker flows

Primary references:

- `docs/CANONICAL_ALIGNMENT_REPORT.md`
- `docs/PLAN_EXECUTION.md`
- `docs/WDP301-docs.md`
- `docs/WDP301-architecture.md`
- `docs/WDP301-database.md`

## 2. Planning Rules

- Preserve working modules unless they are canonically wrong.
- Prefer extending current modules over rewriting them from scratch.
- Treat business workflow and canonical AI principles as the source of truth.
- Avoid shipping seed assumptions as real product logic.
- Do not allow AI to become an official scoring or ranking authority.

## 3. Current Baseline

### Strong existing foundation

- authentication and RBAC foundation
- events CRUD
- tracks CRUD
- teams invitation workflow
- participants lifecycle foundation
- timelines module
- judging boards, score sheets, rankings, submissions, repositories, GitHub webhook intake, AI review service foundation
- notifications, media, audit log foundation
- queue service, worker implementation, commit diff persistence, impact scoring foundation

### Still incomplete or partially complete

- worker bootstrapping in runtime
- hourly scheduler runtime
- GitHub lifecycle end-to-end automation
- repository evidence pipeline hardening
- static analysis depth
- AST-quality changed code extraction
- AI provider runtime integration
- team aggregate audit contract alignment
- submission and check-in business completeness
- result publication plus repository access revocation
- operational dashboards and audit search
- staging, failure rehearsal, and production readiness

### Still misaligned or legacy-shaped

- some AI-related schemas still carry historical scoring-oriented fields
- some old docs still imply AI-assisted scoring behavior
- several models still miss business fields from the canonical workflow
- runtime currently does not prove the full queue and worker flow in production form

## 4. Target End State

The backend is considered complete for real deployment when all of the following are true:

- a new event can be configured without code changes
- participants, teams, rounds, boards, submissions, scoring, rankings, and results all operate through real APIs
- GitHub repository access can be granted, monitored, frozen, and revoked by the system
- webhook, queue, worker, commit sync, diff preprocessing, static analysis, impact scoring, and AI audits run asynchronously
- judge scoring remains official and independent from AI output
- reports, rankings, and finalist decisions are traceable through audit data
- the system passes end-to-end integration rehearsal using real infrastructure dependencies

## 5. Workstreams

### W1. Runtime and Infrastructure

- API process boot
- worker process boot
- Redis and BullMQ runtime
- MongoDB runtime
- environment management
- Docker and staging topology
- structured logging and health checks

### W2. Competition Operations

- event configuration
- tracks
- timelines
- participants
- teams
- rounds
- judging boards
- judge scope enforcement

### W3. GitHub and Repository Lifecycle

- GitHub configuration
- repository creation and internal tracking
- webhook registration
- collaborator grant and revoke
- repository freeze policy
- commit retrieval and repository sync

### W4. Repository Evidence and AI Auditor

- commit and diff persistence
- diff preprocessing
- static analysis
- changed code context extraction
- impact scoring
- per-push AI technical audit
- team aggregate AI technical audit
- AI JSON validation, repair, and fallback

### W5. Official Judging and Results

- submissions
- rubrics and criteria
- score sheets
- judge scoring
- rankings
- finalist selection
- result publication

### W6. Operations, Audit, and Readiness

- audit logs
- dashboard summaries
- monitoring
- failure recovery
- staging rehearsal
- go-live checklist

## 6. Phase Plan

## Phase 0: Canonical Lock

### Goal

Make the implementation direction unambiguous before more code is added.

### Tasks

- mark canonical docs as source of truth
- mark legacy AI-scoring assumptions as historical only
- align team terminology:
  - `PER_PUSH_TECHNICAL_AUDIT`
  - `TEAM_AGGREGATE_TECHNICAL_AUDIT`
  - judge-driven scoring
- review current models for fields that should remain transitional only

### Deliverables

- this master plan
- agreed glossary and architectural direction

### Done when

- the team stops treating older AI-scoring language as product behavior

## Phase 1: Runtime Boot and Deployment Foundation

### Goal

Make the backend runnable as a real multi-process system.

### Tasks

- create dedicated worker entrypoint to boot BullMQ worker
- add npm scripts for:
  - API
  - worker
  - local combined dev
- add Docker Compose for:
  - app
  - worker
  - mongo
  - redis
- add startup validation for required env vars
- add `/health` and `/ready` behavior suitable for staging
- add structured logs for queue and GitHub flows

### Deliverables

- worker runtime script
- deployment-ready local compose setup
- environment template and runtime checklist

### Done when

- webhook requests enqueue jobs
- worker consumes jobs in a separate process
- the system can be started locally with infrastructure dependencies

## Phase 2: Data Model Canonical Alignment

### Goal

Bring schemas closer to real business workflow before more integration is layered on top.

### Tasks

- extend `Criterion` with canonical support fields such as:
  - `judgeOnly`
  - `aiSupportForAudit`
  - `aiInstruction`
- extend `Track` with business context fields such as:
  - `topic`
  - `problemStatement`
- extend participant/check-in storage for proof or timing if required by the real workflow
- review repository lifecycle fields for:
  - access state
  - last granted at
  - freeze status
- add missing pipeline support entities if needed:
  - `AuditJob`
  - `RepositoryScanCheckpoint`
  - `FinalistSelection`
- mark legacy AI score-related fields as transitional and avoid new dependencies on them

### Deliverables

- updated models
- migration or data backfill notes

### Done when

- schema supports current canonical workflow without forcing business logic into service hacks

## Phase 3: Competition Operations Completion

### Goal

Complete the core competition lifecycle APIs and rules.

### Tasks

- harden event competition config and validations
- complete timeline lifecycle and event schedule usage
- complete participant lifecycle:
  - registration
  - approval
  - check-in
  - attendance
  - GitHub access status
- complete team lifecycle:
  - assignment to event
  - track capacity
  - participant-per-event rules
  - leader rules
- complete rounds and judging boards:
  - team assignment
  - judge assignment
  - promotion rules
  - tie-break configuration
- verify judge scope boundaries for all judge-facing modules

### Deliverables

- stable coordinator and judge domain APIs
- business rule tests for event lifecycle

### Done when

- a new event can be configured and operated without manual DB edits

## Phase 4: GitHub Lifecycle Productionization

### Goal

Turn GitHub integration into a real operational service for hackathon teams.

### Tasks

- harden GitHub configuration storage and secret handling
- ensure repository creation links internal `Repository` correctly
- add GitHub webhook registration flow for newly created repos
- support collaborator grant by team or participant lifecycle
- support collaborator revoke for:
  - deadline freeze
  - post-result shutdown
- log GitHub access actions consistently
- decide and document token strategy:
  - org token
  - GitHub App
  - per-admin token

### Deliverables

- repository lifecycle policy
- webhook registration service
- collaborator grant/revoke flows

### Done when

- the platform can create a repo, register webhook, grant access, and later revoke access through system actions

## Phase 5: Repository Intake, Queue, and Evidence Reliability

### Goal

Make repository activity ingestion safe, durable, and replayable.

### Tasks

- wire worker startup to actual runtime
- define queue retry policy:
  - attempts
  - backoff
  - dead-letter or failed-job handling
- add webhook delivery state transitions:
  - received
  - queued
  - processing
  - processed
  - failed
- add idempotency and replay support for webhook and commit sync jobs
- add hourly scheduler runtime for repository scans
- add scan checkpoint policy for missed webhook recovery
- make audit and failure logs queryable

### Deliverables

- reliable webhook and scheduler flow
- replay-safe queue processing rules

### Done when

- missed webhook events can be recovered by scheduled reconciliation

## Phase 6: Diff Preprocessing and Repository Safety

### Goal

Ensure repository evidence is clean, bounded, and safe before deeper analysis or AI use.

### Tasks

- finalize include/exclude rules for files and paths
- cap:
  - max files per audit
  - max patch per file
  - total clean diff budget
- expand secret redaction patterns
- improve generated and binary file detection
- store clean diff summary as first-class evidence
- add repository snapshot trace if needed for retries

### Deliverables

- stable diff preprocessing contract
- safe clean diff payloads

### Done when

- raw large diffs never go directly to AI

## Phase 7: Static Analysis and Changed Context Upgrade

### Goal

Increase technical evidence quality before AI audit decisions.

### Tasks

- keep current secret scan and dependency scan
- operationalize real ESLint and type-check execution against target repository snapshots
- decide tool set for V1 and V2:
  - V1: ESLint, type-check, secret scan, dependency change scan
  - V2: Semgrep, dependency-cruiser, madge
- replace or supplement regex-based changed context with parser-based extraction for JS where practical
- store changed symbols and confidence levels
- improve impact scoring with:
  - core path weighting
  - static findings weighting
  - security-sensitive file weighting
  - dependency-risk weighting

### Deliverables

- analysis runner that evaluates target repository content, not backend source only
- stronger changed code context
- calibrated impact scoring

### Done when

- trivial diffs skip AI
- service or security changes consistently trigger higher review paths

## Phase 8: AI Technical Auditor Runtime Completion

### Goal

Make AI review a real support layer for judges.

### Tasks

- integrate one real provider runtime for staging and production
- separate contracts clearly for:
  - per-push technical audit
  - team aggregate technical audit
- align team aggregate output with canonical fields such as:
  - `historicalSynthesis`
  - `currentTechnicalSnapshot`
  - `riskSummary`
  - `judgeDashboardSummary`
- keep forbidden field removal:
  - `suggestedScore`
  - `finalScore`
  - `rank`
  - `winner`
  - `finalistDecision`
  - `passFailDecision`
- finalize JSON validation and repair flow
- add retry policy for provider failures while reusing cached evidence
- expose judge/coordinator endpoints for AI report consumption

### Deliverables

- production AI audit runtime
- canonical per-push schema
- canonical aggregate schema
- retry and fallback behavior

### Done when

- AI reports are created from real repository events and are clearly non-scoring

## Phase 9: Official Judging, Rankings, and Result Flow

### Goal

Finish the official competition workflow.

### Tasks

- harden submission lifecycle with deadline rules and repository linkage
- complete rubric and criteria management
- keep score sheet lock semantics strict
- ensure official score computation uses judge-entered values only
- harden ranking generation and finalist selection from event rules only
- record tie-break traces
- connect result publication with post-event repository access actions
- expose coordinator and judge APIs needed by real UI flows

### Deliverables

- complete judging flow
- official ranking flow
- finalist and result publication flow

### Done when

- a round can go from submission to published ranking with no manual DB intervention

## Phase 10: Audit, Dashboard, and Operational Visibility

### Goal

Make the system explainable and supportable during real operations.

### Tasks

- complete audit log search APIs
- add queue and pipeline summary endpoints
- add dashboard metrics for:
  - participants
  - teams
  - submissions
  - repositories
  - pending AI reviews
  - failed jobs
- log important transitions:
  - GitHub access grant
  - GitHub access revoke
  - score sheet submission
  - ranking generation
  - result publish

### Deliverables

- coordinator support APIs
- operational visibility layer

### Done when

- admins and coordinators can diagnose system state without direct DB access

## Phase 11: Security and Hardening

### Goal

Reduce production risk before launch.

### Tasks

- tighten env validation
- verify encryption for stored secrets
- add rate-limit review for critical endpoints
- define Redis outage behavior
- define AI provider outage fallback
- define backup and restore process for MongoDB
- document operational runbooks:
  - worker restart
  - queue stuck jobs
  - webhook replay
  - AI provider failure

### Deliverables

- security checklist
- recovery runbook
- infrastructure readiness notes

### Done when

- the team can recover from common infrastructure and provider failures predictably

## 7. Delivery Priority

### Priority P0

- worker runtime boot
- scheduler runtime
- GitHub webhook registration and repository lifecycle completion
- repository evidence pipeline stability
- official judging flow completion
- result publication plus repo access revoke

### Priority P1

- model canonical alignment
- static analysis upgrade
- aggregate AI audit contract alignment
- dashboard and audit search

### Priority P2

- advanced architecture scanning tools
- richer aggregate reporting
- extended ranking scopes if required by season

## 8. Recommended Wave Execution

### Wave 1

- Phase 0
- Phase 1
- Phase 2

### Wave 2

- Phase 3
- Phase 4
- Phase 5

### Wave 3

- Phase 6
- Phase 7
- Phase 8

### Wave 4

- Phase 9
- Phase 10
- Phase 11

### Wave 5

- integration rehearsal
- UAT
- staging signoff
- production release

## 9. Integration Test Phases

## Integration Phase A: Technical Flow E2E

### Objective

Prove the repository audit pipeline works with real infrastructure.

### Scenario

1. create event and team
2. configure GitHub integration
3. create repository
4. register webhook
5. grant collaborator access
6. push commit from test repository
7. receive webhook
8. enqueue job
9. worker fetches commits and diff
10. preprocessing runs
11. static analysis runs
12. impact score is stored
13. AI review is created when eligible

### Pass criteria

- webhook returns quickly
- queue job exists
- worker consumes successfully
- commit and diff records persist
- static analysis persists
- impact decision persists
- AI review persists or is correctly skipped

## Integration Phase B: Judge Flow E2E

### Objective

Prove official judging works independently of AI scoring.

### Scenario

1. assign teams and judges to a board
2. create round and rubric
3. create submission
4. judge loads assigned team
5. judge reviews AI support material
6. judge enters scores
7. score sheet is submitted and locked
8. coordinator generates rankings
9. coordinator selects finalists
10. coordinator publishes results

### Pass criteria

- only assigned judge can score
- score sheet locks after submission
- ranking source is official judge scores only
- finalist selection is traceable
- published results persist correctly

## Integration Phase C: Repository Freeze and Closure

### Objective

Prove repository access lifecycle works after judging milestones.

### Scenario

1. team gets collaborator access
2. submission deadline passes or result is published
3. system revokes collaborator access
4. repository and participant access states update
5. audit log records the operation

### Pass criteria

- revoked user loses repository write access
- internal state reflects freeze or revoke
- audit trail is queryable

## Integration Phase D: Failure Rehearsal

### Objective

Prove the system fails safely.

### Scenarios

- invalid webhook signature
- duplicate webhook delivery
- Redis unavailable during enqueue
- worker restart while jobs exist
- GitHub API rate limit
- AI provider timeout
- malformed AI JSON
- missed webhook with later scheduler recovery

### Pass criteria

- failures are logged
- retry or fallback behavior is predictable
- no silent data corruption occurs

## 10. Test Strategy

### Level 1: Unit Tests

- validators
- service business rules
- queue job routing
- diff preprocessing
- impact scoring
- AI output normalization

### Level 2: Integration Tests

- route to DB behavior
- queue plus worker behavior
- GitHub service with mocked external API
- score and ranking persistence

### Level 3: System Tests

- full repository push audit flow
- full judge scoring flow
- result publication flow

### Level 4: Staging Rehearsal

- real infra
- real queue
- real GitHub org or sandbox org
- real AI provider or staging provider account

## 11. Staging and UAT Plan

### Staging setup

- isolated MongoDB database
- isolated Redis
- dedicated GitHub sandbox organization
- dedicated SMTP sandbox or dev mode
- dedicated AI provider credentials with budget limits

### UAT coverage

- one event with at least:
  - 2 tracks
  - 2 rounds
  - multiple teams
  - multiple judges
- one full push cycle per team
- one full scoring cycle per round
- final result publication rehearsal

### Exit criteria

- critical flows pass without manual DB fixes
- no blocking production defects remain
- operational runbook is complete

## 12. Go-Live Checklist

- API and worker deployment scripts exist
- environment variables are documented and validated
- MongoDB and Redis are reachable in target environment
- GitHub integration credentials are configured
- AI provider credentials are configured with budget guardrails
- webhook URL is reachable from GitHub
- queue processing is observable
- audit logs are queryable
- ranking generation is verified on staging
- repository revoke flow is verified
- rollback plan exists

## 13. Ownership Suggestion

### Backend Core

- runtime foundation
- event, team, participant, round, board APIs
- submissions, scoring, rankings

### Integration and Platform

- GitHub lifecycle
- queue and worker
- Redis and deployment
- monitoring and hardening

### AI and Evidence

- diff preprocessing
- static analysis
- changed context extraction
- AI provider integration
- schema validation and fallback

### QA and Release

- integration test scripts
- staging rehearsal
- production readiness checklist

## 14. Immediate Next Sprint

The next sprint should focus on the smallest production-critical gaps still blocking real deployment:

1. boot worker in a real runtime process
2. add scheduler runtime for hourly repository scans
3. add GitHub webhook registration during repository creation
4. implement collaborator revoke flow tied to repository or result lifecycle
5. align aggregate AI audit schema with canonical output
6. verify static analysis runs against target repository evidence rather than backend source cwd

## 15. Final Success Criteria

The project is ready for practical rollout when:

- operational modules work through real APIs
- GitHub activity becomes durable technical evidence
- AI reports are evidence-first and non-scoring
- official scoring and rankings are fully judge-driven
- the platform survives failure rehearsal
- a full event can be rehearsed in staging without manual intervention
