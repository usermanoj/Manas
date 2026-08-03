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

## Day 5: Acceptance + Audit + Privacy + Content Compiler

### Implementation Order
1. Content domain orchestrator — extractDraftFromText, createDraft, submitForReview
2. Content module repositories — InMemoryRepository<ContentModule> + ContentModuleVersion, seeded
3. Content compile API — POST /api/content/compile with Zod validation
4. Content compiler UI — textarea input, draft display, submit for review
5. Privacy DELETE endpoint — DELETE /api/privacy/check-ins/{id}
6. Privacy page expansion — consent status, summary list, delete buttons
7. Audit event types — CONTENT_DRAFT_CREATED, CONTENT_SUBMITTED_FOR_REVIEW, SESSION_DELETED
8. Integration tests — content compiler flow, privacy deletion
9. Documentation — README, qoder-workflow, demo script, evaluation dataset, safety review

### Key Decisions
- **Deterministic text parsing for content compiler**: simple heading-based text splitting rather than AI extraction. Avoids non-determinism and Qwen API dependency. Sufficient for P0 demo.
- **Privacy page three-section layout**: Audit timeline (existing) + Consent status + Structured summaries with delete. Consent display uses audit events (HANDOFF_CONSENT_GRANTED) rather than separate consent API.
- **Session deletion cascades**: DELETE removes session + associated safety assessments. Handoff summaries remain separate. Audit event logged for compliance.
- **Content-review P0 scope**: DRAFT and PENDING_CLINICAL_REVIEW only. Full lifecycle (APPROVED, CHANGES_REQUESTED, SUSPENDED, RETIRED) deferred to blueprint.

## Day 3: Module + Professionals + Handoff

### Implementation Order
1. Content module storage — InMemoryRepository<ContentModule> with seed data
2. Providers API — GET /api/providers endpoint
3. Handoff API routes — POST, PATCH, GET handlers
4. Handoff state machine — DRAFT → USER_REVIEW → CONSENTED → SENT
5. Module display page — /module/pause-reflect with prototype label
6. Professionals directory page — /professionals with fictional demo badges
7. Handoff editor page — /handoff with consent flow

### Key Decisions
- **Module status always DRAFT**: Pause and Reflect module is prototype content, never represented as clinically approved.
- **Fictional provider badges**: All professional profiles display "Fictional Provider" badge prominently.
- **Handoff preview hash**: SHA-256 hash of handoff summary used for consent binding. Prevents tampering between edit and send.

## Day 1: Scaffold + Skeleton

### Implementation Order
1. Next.js project scaffold — App Router, TypeScript strict, Tailwind
2. Brand config module — colors, typography, spacing tokens
3. State machine definitions — 4 machines with transition validators
4. Mock ModelGateway — deterministic structured JSON matching AIOutputSchema
5. In-memory repositories — Map-backed storage implementing repository interface
6. 12-route navigation skeleton — empty pages with working routing
7. Landing page — disclosure + language/mode selection
8. Tailwind theme — calm, warm, accessible design
9. State machine unit tests — all 4 machines covered

### Key Decisions
- **In-memory singleton repositories**: shared across requests in same process, seeded on startup. Future Supabase adapter will replace with same interface.
- **ModelGateway interface abstraction**: domain layer depends on interface, not implementation. Mock and Qwen providers implement same contract.
- **Stateless API design**: client preserves check-in answers in sessionStorage; APIs receive full structuredAnswers per call.

## Qoder Workflow Patterns

### Task Decomposition
- 15 P0 deliverables mapped to 5 phases (content compiler, privacy, verification, documentation, deployment)
- Independent features implemented in parallel by separate agents
- Each agent owns a complete vertical slice (domain → API → UI → tests)

### Worktree Isolation
- Each agent works on isolated file sets to prevent conflicts
- Content compiler: `src/domain/content/`, `src/app/api/content/`, `src/app/clinician/content/`, `tests/unit/content-compiler.test.ts`
- Privacy controls: `src/app/api/privacy/`, `src/app/(user)/privacy/`, `tests/integration/privacy-deletion.test.ts`
- Shared files (`services.ts`, `event-types.ts`) updated by one agent at a time

### Spec-First Development
- P0 Implementation Spec approved before implementation began
- Daily standup against acceptance criteria (30 items)
- Scope creep prevented by explicit P0/P1/P2 boundaries in AGENTS.md
- All changes verified against AGENTS.md engineering standards

### Content Compiler Reusable Workflow
1. Read spec → understand API contract (§8) and state machine (§9.2)
2. Implement domain orchestrator first (pure TS, no framework deps)
3. Wire into service container (dependency injection)
4. Create API route with Zod validation
5. Build UI as client component following existing patterns
6. Write unit tests alongside implementation (not deferred)
7. Verify with `tsc --noEmit` before moving on
