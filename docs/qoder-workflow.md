# Qoder Workflow — Manas Day 2

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
