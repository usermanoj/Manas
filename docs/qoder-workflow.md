# Qoder Workflow — Manas
## Day 4: Consent, Clinician Inbox & Care-Plan Twin

### Implementation Order
1. Handoff domain — orchestrator, UnitOfWork, state machine, consent-and-send
2. Handoff API routes — list, create, submit-for-review, consent-and-send
3. Handoff UI — `/handoff` page with structured summary, consent checkbox, send
4. Clinician API — `/api/clinician/handoffs` inbox with consent metadata
5. Clinician inbox UI — `/clinician` page with fictional-workspace banner
6. Care-plan domain — orchestrator, state machine, versioning, revision
7. Care-plan API — create, transition (propose/approve/accept/revise/pause/retire)
8. Clinician care-plan UI — `/clinician/care-plan` workspace, revision form, V1/V2 comparison
9. User care-plan UI — `/care-plan` twin view, side-by-side comparison, accept
10. Audit timeline UI — `/privacy` page with metadata-only events
11. Playwright E2E tests — 3 focused spec files (consent-and-send, care-plan V1, care-plan V2)
12. Documentation — known-limitations, README, qoder-workflow

### Key Decisions
- **Atomic consent-and-send via UnitOfWork**: in-memory staged commit ensures consent record and handoff status change together. Not true ACID, but safe for single-process demo.
- **One-time consent**: each consent is bound to a specific handoff version + preview hash. Re-consent required for any change.
- **Server-derived identity**: all roles (user/clinician) derived from hard-coded demo profiles, not production auth.
- **V1 SUPERSEDED on V2 activation**: state machine enforces immutability after supersession. No database-level constraints in memory mode.
- **Audit metadata only**: `/api/audit/me` strips sensitive detail fields (raw conversation, summaries) before returning events.
- **Fictional workspace banners**: all clinician and care-plan pages display synthetic-data disclaimers.

## Day 2: Check-in Vertical Slice

## Approach
- Spec-first: Day 2 mini-spec approved before implementation
- Parallel agent execution: independent tasks dispatched simultaneously
- Dependency-gated sequencing: each task waits for blockers to resolve

## Build Order
1. Zod contracts and schemas
2. Safety policy and routing engine
3. Model gateway factory and service container
4. Domain tests (safety, routing, schema, gateway)
5. Check-in orchestrator with audit wiring
6. Stateless session handling
7. API routes (4 endpoints)
8. Check-in UI (6-step wizard with sessionStorage)
9. Draft summary + confirm UI (two-phase)
10. Integration tests
11. Playwright E2E test
12. Documentation and final verification

## Key Patterns
- Table-driven Vitest tests with it.each() and as const
- Discriminated union error handling
- Barrel exports from domain/index.ts
- Zod validation on all API request/response payloads
- Fresh service container per request (stateless)
