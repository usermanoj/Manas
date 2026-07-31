# Qoder Workflow — Manas Day 2 & Day 3

## Day 2 Approach
- Spec-first: Day 2 mini-spec approved before implementation
- Parallel agent execution: independent tasks dispatched simultaneously
- Dependency-gated sequencing: each task waits for blockers to resolve

## Day 2 Build Order
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

## Day 2 Key Patterns
- Table-driven Vitest tests with it.each() and as const
- Discriminated union error handling
- Barrel exports from domain/index.ts
- Zod validation on all API request/response payloads
- Fresh service container per request (stateless)

---

## Day 3 Approach
- Mock-first build order: every feature works in memory mode before Supabase adapters are wired
- Phases A–J executed in dependency order; each phase gates the next

## Day 3 Build Order (Phases A–J)
1. **A** — Repository types and in-memory adapter (provider, handoff repos)
2. **B** — Seed data: 3 fictional providers, care-plan versions, content modules
3. **C** — Pause and Reflect content fixture (TypeScript, not database)
4. **D** — Pause and Reflect UI (3-step guided exercise, browser-only reflections)
5. **E** — Professional directory page with client-side filtering
6. **F** — Handoff state machine (DRAFT → USER_REVIEW max) and HandoffService
7. **G** — Supabase adapters (session, safety assessment, provider, handoff, audit logger)
8. **H** — Persistence switch (`MANAS_PERSISTENCE`) and lazy-loaded Supabase modules
9. **I** — Seed script (`npm run seed:supabase`) and `MANAS_DEMO_MODE` flag
10. **J** — Documentation updates (README, known-limitations, qoder-workflow)

## Day 3 Key Architectural Decisions

### TypeScript fixture for content (not database)
Pause and Reflect module content is defined as a TypeScript constant
(`PAUSE_REFLECT_MODULE` / `PAUSE_REFLECT_VERSION`) in `src/domain/content/modules.ts`.
This keeps content version-controlled and reviewable in code, avoiding
premature database coupling for content that is still `PENDING_CLINICAL_REVIEW`.

### Narrow repository adapters
Each repository implements a minimal `Repository<T>` interface
(`create`, `findById`, `findAll`, `update`, `delete`). Supabase adapters
are thin wrappers that map domain types to table rows. This keeps the
domain layer persistence-agnostic.

### HandoffService as sole transition authority
All handoff state transitions go through `HandoffService` functions
(`createDraftHandoff`, `updateHandoff`, `excludeField`, `submitForReview`).
Direct repository writes for status changes are forbidden. Every transition
is validated against the state machine and logged as an audit event.

### Whitelisted module audit events
Only specific audit event types are emitted by the handoff module:
`HANDOFF_DRAFT_CREATED`, `HANDOFF_EDITED`, `HANDOFF_FIELD_EXCLUDED`,
`HANDOFF_READY_FOR_REVIEW`. This whitelist ensures audit logs remain
predictable and reviewable.

### Consent-and-send deferred to Day 4
The handoff flow stops at `USER_REVIEW` in Day 3. The consent-and-send
step — where the user explicitly authorises transmission of their summary
to a provider — is deferred to Day 4. This separation ensures the
atomic consent transaction is implemented deliberately, with full UI
and audit support, rather than being bundled into the draft workflow.
