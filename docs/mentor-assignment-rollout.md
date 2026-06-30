# Mentor Assignment Rollout

## Objective
Implement a stable mentor assignment workflow on top of `team.mentorIds`, keep one shared chat room per team, and make mentor ownership visible across web and mobile surfaces.

## Locked Decisions
- Mentor stays assigned directly on the team model.
- One team keeps one shared chat room for all team members and assigned mentors.
- Mentor assignment is managed from a separate web coordinator/admin surface.
- Mentor candidates are approved or active users with role `MENTOR`.
- Core FE and RN team surfaces must show assigned mentors.

## Phase Checklist
- [x] Phase 0: Create rollout tracker and lock decisions
- [x] Phase 1: Add backend mentor assignment endpoint and validation
- [x] Phase 1: Enforce active mentor role checks and preserve existing chat architecture
- [x] Phase 1: Emit audit-ready mentor assignment diffs through request audit metadata
- [x] Phase 2: Add web mentor assignment management screen
- [x] Phase 2: Show assigned mentors in team list and team detail
- [x] Phase 2: Add bulk mentor assignment by board
- [x] Phase 3: Extend RN types with `assignedMentors` and `mentorIds`
- [x] Phase 3: Show assigned mentors in RN Team Home and Team Chat header
- [x] Phase 4: Final verification across BE, FE, RN builds/checks

## Current Status
- Backend endpoint implemented: `PATCH /api/teams/:id/mentors`
- Backend bulk endpoint implemented: `PATCH /api/teams/mentor-assignments/by-board`
- Backend validates mentor IDs, existence, `APPROVED` or `ACTIVE` status, and `MENTOR` role
- Web coordinator/admin route added: `/coordinator/mentor-assignments`
- Web mentor assignment screen now supports filtering by board and assigning mentors to every team in a selected board
- Team detail and team cards now show assigned mentor information
- RN Team Home and Team Chat now display assigned mentors
- FE team and mentor assignment cards now use a 3-column responsive grid with 12 cards per page
- Mentor assignment dialogs and cards were adjusted to reduce truncation and improve small-screen behavior
- Phase 4 verification completed: BE full test suite passed, FE production build passed, RN `tsc --noEmit` passed after dependency sync

## Blockers
- None at the moment for this rollout.

## Work Session Log
### 2026-06-29
- Added backend team mentor update flow, repository helper, route, validation, and audit diff payload
- Added FE shared API mutation and dedicated mentor assignment management screen
- Added bulk board-based mentor assignment flow from FE to BE
- Added assigned mentor visibility to FE team detail and coordinator team cards
- Added RN assigned mentor visibility to Team Home and Team Chat header
- Verification summary: FE `npm run build` passed, BE lint passed with pre-existing warnings, bulk mentor board service tests passed, RN `tsc` and BE media tests still have unrelated baseline failures

### 2026-06-30
- Updated mentor eligibility from `ACTIVE` only to `APPROVED` or `ACTIVE` to match the current account-access model in BE
- Re-verified mentor-specific backend tests and FE build after the status-rule change
- Tuned mentor assignment dialogs, card headers, card actions, and grid density for better responsive behavior
- Fixed media service provider precedence and storage-client compatibility so the full BE test suite passes again
- Synced RN dependencies and re-ran `npx tsc --noEmit` successfully
- Closed Phase 4 after BE tests, FE build, and RN type-check all passed
