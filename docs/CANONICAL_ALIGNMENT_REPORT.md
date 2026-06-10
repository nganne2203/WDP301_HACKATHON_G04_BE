# Canonical Alignment Report

## 1. Purpose

This document defines the canonical business alignment for the SEAL Hackathon backend.

It exists because:

- business regulations and competition evidence are more authoritative than the current source snapshot
- the current source contains both implemented logic and legacy assumptions
- the team needs one clean reference for what is already aligned, what is partially aligned, and what must still change

## 2. Canonical Sources

The following inputs are treated as higher-priority business references:

- `SEAL_Hackathon_Project_Workflow_Technical_Auditor_Full_Report.docx`
- `AI_TECHNICAL_AUDITOR_PHASE_4_WORKFLOW.md`
- `HKT-SP26-Overview.xlsx`
- `[FPTU] THONG TIN VE CUOC THI SEAL HACKATHON FALL 2025.docx`
- `fptu-thong-tin-cuoc-thi-seal-hackathon-hoc-ky-spring-2026.pdf`

Implementation references reviewed:

- `src/`
- `docs/PLAN.md`
- `docs/PLAN_EXECUTION.md`
- `docs/WDP301-docs.md`
- `docs/WDP301-architecture.md`
- `docs/WDP301-database.md`

## 3. Canonical Principles

### 3.1 Multi-season platform

The system is not a single-season hackathon app.

Each event may differ in:

- board count
- track count
- maximum teams per board
- finalist count
- finalist selection rule
- tie-break rule
- rubric structure
- prize structure
- ranking scopes

Therefore these must be event-configurable and must not be hard-coded globally.

### 3.2 Official scoring remains judge-driven

AI is a Technical Auditor support layer only.

AI may provide:

- technical findings
- risk summaries
- qualitative rubric-aware comments
- suggested test cases
- suggested judge questions
- repository evolution summaries

AI must not:

- assign official scores
- decide finalists
- decide winners
- generate final rankings

### 3.3 AI must be asynchronous and evidence-first

The canonical AI workflow is:

GitHub webhook  
-> signature verification  
-> webhook event persistence  
-> queue/worker  
-> commit retrieval  
-> diff preprocessing  
-> static analysis  
-> AST extraction  
-> impact scoring  
-> per-push or aggregate AI audit  
-> JSON validation/repair  
-> persistence  
-> judge dashboard support

The backend must not call LLM directly inside the webhook request.

## 4. Current Source Status

### 4.1 Already aligned or mostly aligned

- auth
- user management
- permission-based authorization
- events CRUD foundation
- tracks CRUD foundation
- workshops
- notifications
- media
- GitHub configuration and repository utility endpoints

### 4.2 Implemented and stronger than older docs suggested

- teams invitation workflow
- temporary account creation for invited emails
- team quota protection
- event-aware team placement and capacity logic
- participant registration/check-in/attendance/github-access APIs
- timelines CRUD APIs

### 4.3 Still incomplete

- rounds
- judging boards
- repository lifecycle as a first-class internal domain
- webhook receiver
- queue/worker
- commit ingestion
- diff preprocessing
- static analysis persistence
- AST extraction layer
- impact scoring
- per-push AI audit runtime flow
- team aggregate AI audit runtime flow
- submissions
- rubrics and criteria management
- official score sheet workflow
- rankings and result publication
- audit log search and complete audit integration

### 4.4 Still misaligned

- AI schema usage still carries scoring-oriented legacy fields
- source still lacks the canonical asynchronous AI pipeline
- ranking/finalist generation is not yet implemented as event-rule-driven services
- audit log integration is still incomplete

## 5. High-Level Gap Matrix

| Area | Canonical expectation | Current source state | Alignment result |
|---|---|---|---|
| Event competition structure | Fully dynamic per event | Partially implemented via `competitionConfig` | Improved, not finished |
| Participants | Real event actor lifecycle | API foundation exists | Partially aligned |
| Teams | Event-aware membership and placement | Invitation + placement + capacity now exist | Strongly improved |
| Rounds/judging boards | Real operational judging flow | Models only | Missing |
| GitHub lifecycle | Config + webhook + commits + audit pipeline | Config and repo utilities only | Partial |
| AI Technical Auditor | Async, evidence-first, non-scoring | Legacy schema + no runtime pipeline | Misaligned |
| Official scoring | Judge-driven only | Not implemented yet as full flow | Pending |
| Rankings/results | Event-rule-driven | Not implemented yet as full flow | Pending |
| Audit logs | Usable and searchable | Incomplete wiring | Misaligned |

## 6. Canonical AI Technical Auditor Requirements

### 6.1 Review kinds

The system should support two AI review kinds:

- `PER_PUSH_TECHNICAL_AUDIT`
- `TEAM_AGGREGATE_TECHNICAL_AUDIT`

### 6.2 Mandatory preprocessing before LLM

Before any AI call, the pipeline should support:

- commit metadata retrieval
- changed file retrieval
- diff cleaning
- generated/binary file filtering
- secret redaction
- static analysis summary
- changed code context extraction
- impact scoring

### 6.3 Decision model for AI usage

The system should not call LLM for every change.

Canonical decision levels:

- `LOW`: skip LLM
- `MEDIUM`: batch into hourly review
- `HIGH`: run per-push audit
- `CRITICAL`: run urgent audit and flag for human review

### 6.4 Forbidden AI output fields

If AI output includes any of the following, the backend should remove or reject them:

- `suggestedScore`
- `finalScore`
- `rank`
- `winner`
- `finalistDecision`
- `passFailDecision`

### 6.5 JSON validation and repair

LLM output must be treated as untrusted.

The backend should:

- parse JSON
- validate against schema
- normalize enums
- remove forbidden fields
- run repair prompt if malformed
- produce fallback report if still invalid

## 7. Source Code Areas That Still Need Canonical Work

### A. Rounds and judging

Canonical requirement:

- round CRUD
- judging board CRUD
- judge assignment
- team assignment
- promotion rule configuration
- tie-break configuration

Current state:

- only models and seed-level examples exist

### B. Repository audit pipeline

Canonical requirement:

- `POST /api/github/webhooks`
- raw-body signature verification
- webhook event persistence
- queue and worker
- commit and diff storage
- scheduler-driven repository scan

Current state:

- webhook/worker pipeline does not exist yet

### C. AI review domain

Canonical requirement:

- AI report contracts are non-scoring
- technical findings and rubric comments are evidence-based
- per-push and aggregate reports are stored separately or typed clearly

Current state:

- `AiReview` and related schema still imply score-oriented legacy usage

### D. Official scoring and ranking

Canonical requirement:

- judge-entered score sheets
- ranking from official judge scores only
- finalists from event rules only

Current state:

- models exist
- real workflow and services do not

## 8. Recommended Target Data Additions

These entities or data groups are still useful target additions even if the exact schema names may vary:

- `GitHubWebhookEvent`
- `AuditJob`
- `StaticAnalysisResult`
- `ImpactDecision`
- `TechnicalFinding`
- `RubricAuditComment`
- `SuggestedTestCase`
- `SuggestedJudgeQuestion`
- `RepositoryScanCheckpoint`
- `FinalistSelection`

## 9. What Must Not Be Hard-Coded Anymore

- board count
- track count
- track names
- maximum teams per board
- finalist count
- finalists per board
- fallback finalist fill rule
- tie-break rule
- ranking scopes
- rubric structure
- prize structure
- whether individual ranking exists in a given season

## 10. Practical Conclusion for the Team

The backend now has a stronger implemented base than older internal docs suggested, especially in:

- teams
- participants
- timelines
- workshops
- notifications
- media

However, the most business-critical unfinished areas are still:

- rounds and judging boards
- webhook/worker/commit/audit pipeline
- AI Technical Auditor runtime flow
- official scoring
- rankings/results
- audit logs

From this point forward:

- do not treat old seed data as product rules
- do not treat current AI schema fields as canonical scoring behavior
- do treat the AI workflow as asynchronous and evidence-first
- do treat official scoring as human judge responsibility only

## 11. Source Files Team Should Open First

- `src/routes/index.js`
- `src/scripts/initDb.js`
- `src/models/event.model.js`
- `src/models/team.model.js`
- `src/models/participant.model.js`
- `src/models/aiReview.model.js`
- `src/models/aiReviewCriterion.model.js`
- `src/models/score.model.js`
- `src/modules/teams/team.service.js`
- `src/modules/participants/participant.service.js`
- `src/modules/timelines/timeline.service.js`
- `src/modules/github/github.service.js`
- `src/middlewares/auditLogMiddleware.js`
