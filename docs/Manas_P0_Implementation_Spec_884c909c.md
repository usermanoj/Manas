# Manas Implementation Specification

> **STATUS: APPROVED FOR BUILD — v2.1 Final with 5 amendments applied**

---

## Document 1: docs/MANAS_PRODUCT_BLUEPRINT.md

Preserve the complete current specification (908 lines) unchanged at `docs/MANAS_PRODUCT_BLUEPRINT.md`. This is the full product blueprint covering all 38 screens, 22 database entities, 18 APIs, 6 state machines, full multilingual design, and post-hackathon roadmap. It serves as the reference for P1/P2 work.

---

## Document 2: docs/MANAS_HACKATHON_P0_SPEC.md

The remainder of this plan is the **executable P0 specification**. Build execution must follow ONLY this document.

---

# MANAS HACKATHON P0 SPECIFICATION

**Version**: 2.1 (Final) | **Date**: 30 July 2026 | **Submission**: Wednesday 5 August 2026

> **EXECUTABLE BUILD SPECIFICATION** — This is the only executable Build specification.
> `docs/MANAS_PRODUCT_BLUEPRINT.md` is preserved unchanged as the full product reference.

> This is a **synthetic-data hackathon demonstration**. It is not intended for real mental-health support. All professional profiles are fictional demo profiles. No diagnosis, treatment, medication advice, or emergency support is provided.

**Amendments v2.1 (final)**:
1. `providers.profile_id` FK to `profiles.id`; clinician RLS uses `providers.profile_id = auth.uid()`
2. `consent_records` is single consent source; no duplicate consent-status on handoffs; consent-and-send is atomic
3. Content review P0 scope: DRAFT and PENDING_CLINICAL_REVIEW only; full lifecycle deferred to blueprint
4. `feels_safe` changed to enum `'yes' | 'no' | 'prefer_not_to_answer'`; user-provided, not AI-inferred
5. Day 1 re-baselined to evening scaffold only; Supabase schema/RLS and live Qwen moved to 31 Jul

---

## 1. Product Purpose

Manas is a hackathon prototype demonstrating how AI can support an adult (18+) experiencing everyday work-related emotional distress. It uses **prototype deterministic safeguards** — not clinical triage or clinically validated safety.

Manas is **not** a psychologist, psychiatrist, diagnostic system, medical device, digital therapeutic, crisis-response service, medication adviser, or replacement for professional care. The digital twin represents the user's versioned care plan — never a clinician's identity.

**Demo persona**: Ananya Sharma, 32, project manager, workplace stress + poor sleep, seeking reflection and professional preparation.

---

## 2. Corrected Calendar

| Date | Day | Phase |
|------|-----|-------|
| 30 Jul | Thursday | Foundation + Scaffold |
| 31 Jul | Friday | Core AI + Check-in + Safety |
| 1 Aug | Saturday | Module + Professionals + Handoff |
| 2 Aug | Sunday | Consent + Clinician Portal + Care Plan |
| 3 Aug | Monday | Acceptance + Audit + Privacy + Content Compiler |
| 4 Aug | Tuesday | Tests + Polish + Staging Deploy |
| **5 Aug** | **Wednesday** | **Production Deploy + SUBMISSION** |

---

## 3. Team Allocation (3 members)

### Product and Integration Lead
- Owns: daily standup, scope control, acceptance criteria tracking, integration testing, Playwright E2E, documentation (README, qoder-workflow.md, limitations doc), demo script, submission packaging
- Builds: evaluation dataset, seed script, CI/CD pipeline, deployment

### AI and Backend Lead
- Owns: ModelGateway, Zod schemas, safety policy, routing engine, state machines, API routes, database schema, RLS policies, audit logger, content compiler backend
- Builds: all `/api/` routes, domain layer, infrastructure layer

### Frontend and Clinician-Workflow Lead
- Owns: all user-facing routes, clinician-facing routes, Tailwind theme, component library, check-in conversation UI, handoff editor, care-plan workspace, privacy/audit UI
- Builds: all `app/` route pages and components

### Shared Contracts (agreed Day 1)
- API request/response Zod schemas
- State machine transition maps
- Database schema types
- Brand config values

---

## 4. Routes (12 maximum)

Consolidate 22 screens into 12 routes:

| # | Route | Content | User Role |
|---|-------|---------|-----------|
| 1 | `/` | Landing + disclosure + language/mode selection | Public |
| 2 | `/check-in` | 6-turn conversational check-in with form fallback | User |
| 3 | `/summary` | Editable structured summary + routing result display | User |
| 4 | `/module/pause-reflect` | "Pause and Reflect" prototype module with unreviewed label | User |
| 5 | `/professionals` | Fictional demo professional profiles (list + detail) | User |
| 6 | `/handoff` | Handoff editor + consent confirmation (combined flow) | User |
| 7 | `/care-plan` | Care-Plan Twin view + version comparison | User |
| 8 | `/privacy` | Consent display/revoke + view/delete structured summaries + audit timeline | User |
| 9 | `/clinician` | Clinician inbox (received handoffs list) | Clinician |
| 10 | `/clinician/care-plan` | Care-plan workspace (create, edit, approve, revise) | Clinician |
| 11 | `/clinician/content` | Content compiler (text paste → draft module extraction) | Clinician |
| 12 | `/demo` *(optional)* | Pre-loaded demo walkthrough / evaluation results | Public |

---

## 5. Module Boundaries (P0 = 14)

| Module | Responsibility | Owner |
|--------|---------------|-------|
| brand-config | Centralized naming (Manas, Manas Guide, etc.) | Integration Lead |
| identity | Supabase auth + DEMO_MODE seeded sessions | Backend Lead |
| consent | Explicit consent tracking, separate from auth | Backend Lead |
| check-in | 6-turn structured check-in + summary generation | Backend Lead |
| model-gateway | Qwen abstraction, Zod validation, fallback, versioning | Backend Lead |
| safety-policy | Deterministic pre/post-generation safety rules + routing engine | Backend Lead |
| content-library | Module storage, versioning, status tracking | Backend Lead |
| care-plan | Versioned care plans, immutable history, state machine | Backend Lead |
| provider-directory | Fictional demo professional profiles | Frontend Lead |
| handoff | Editable, consent-controlled professional handoff | Backend Lead |
| audit | Append-only event logger, timeline queries | Backend Lead |
| evaluation | Synthetic dataset (20-30 scenarios), test fixtures | Integration Lead |
| content-compiler | Text-paste → draft module extraction (P0: text only) | Backend Lead |
| privacy | Consent display/revoke, summary view/delete, audit view | Frontend Lead |

**Deferred to P1**: content-review full workflow, provider-verification, appointment-demo, notification-demo, deletion full cascade, export full workflow, memory management detailed UI.

---

## 6. Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Next.js App Router                   │
│  ┌──────────────┐  ┌─────────────────────────────┐   │
│  │   Frontend    │  │   Server Actions / API Routes│   │
│  │  (React +     │  │                             │   │
│  │   Tailwind)   │  │  ┌───────────────────────┐  │   │
│  │               │  │  │   Domain Layer         │  │   │
│  │  12 routes    │  │  │   (pure TS, no         │  │   │
│  │  (see §4)     │  │  │    framework deps)     │  │   │
│  │               │  │  │                        │  │   │
│  │               │  │  │  safety-policy         │  │   │
│  │               │  │  │  state-machines (4)    │  │   │
│  │               │  │  │  model-gateway         │  │   │
│  │               │  │  │  routing-engine        │  │   │
│  │               │  │  └───────────────────────┘  │   │
│  └──────────────┘  └─────────────────────────────┘   │
├──────────────────────────────────────────────────────┤
│               Infrastructure Layer                    │
│  ┌────────────┐  ┌───────────┐  ┌────────────────┐   │
│  │  Supabase   │  │ Alibaba   │  │   Vercel       │   │
│  │  (Auth +    │  │ Qwen API  │  │  (Hosting)     │   │
│  │  PostgreSQL │  │ (Model    │  │                │   │
│  │  + RLS)     │  │  Gateway) │  │                │   │
│  └────────────┘  └───────────┘  └────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Key decisions**:
- TypeScript strict mode throughout
- Modular monolith — no microservices
- Next.js App Router for SSR + server actions
- Supabase for auth + PostgreSQL + RLS
- Alibaba Qwen via ModelGateway abstraction
- Zod for all AI output validation + API contracts
- Domain layer is pure TypeScript — no framework deps
- Safety layer is completely independent from the conversational model
- Append-only audit pattern
- Immutable versioning for care plans, modules, policies

**Supabase design** (correction #17):
- `profiles` table references `auth.users(id)` via foreign key
- Normal user operations use user JWT and RLS — never service-role
- Service-role credentials are **never** exposed to the client; limited to trusted seed/admin operations only
- `audit_events` can only be INSERTed through trusted server code (RLS denies client INSERT)

**Conversation data** (correction #5):
- Raw conversation messages are **NOT persisted** by default
- Only the user-reviewed structured summary is stored
- Model version + prompt version metadata is recorded per check-in session
- This reduces privacy surface area and simplifies the data model

**Folder structure**:
```
src/
  app/
    (public)/page.tsx                  # Route 1: landing/setup
    (user)/check-in/page.tsx           # Route 2: check-in
    (user)/summary/page.tsx            # Route 3: summary + routing
    (user)/module/pause-reflect/       # Route 4: module
    (user)/professionals/page.tsx      # Route 5: professionals
    (user)/handoff/page.tsx            # Route 6: handoff/consent
    (user)/care-plan/page.tsx          # Route 7: care-plan twin
    (user)/privacy/page.tsx            # Route 8: privacy/audit
    (clinician)/page.tsx               # Route 9: clinician inbox
    (clinician)/care-plan/page.tsx     # Route 10: care-plan workspace
    (clinician)/content/page.tsx       # Route 11: content compiler
    demo/page.tsx                      # Route 12: optional demo
    api/                               # API routes (§8)
  domain/
    ai/                                # ModelGateway, schemas, fallback
    safety/                            # SafetyPolicy, RoutingEngine
    state-machines/                    # 4 state machines
    consent/                           # Consent model
    check-in/                          # Check-in orchestrator
    care-plan/                         # Care-plan logic
    handoff/                           # Handoff logic
    content/                           # Content module + compiler
    audit/                             # Audit event logger
  infrastructure/
    database/                          # Supabase client, RLS, migrations
    model-providers/                   # Qwen provider, mock provider
  lib/
    config/                            # Brand config, env validation
    prompts/                           # Versioned prompt templates
  components/                          # Shared React components
  fixtures/                            # Demo data
tests/
  unit/                                # Vitest (25-35 tests)
  integration/                         # API + RLS (6-10 tests)
  e2e/                                 # Playwright (2 tests)
  safety/                              # Manual high-risk review
  fixtures/                            # Evaluation dataset
scripts/
  seed-demo-db.ts
docs/
  MANAS_PRODUCT_BLUEPRINT.md
  MANAS_HACKATHON_P0_SPEC.md
  qoder-workflow.md
```

---

## 7. Database (P0 = ~12 tables)

| # | Table | Purpose | Key Fields |
|---|-------|---------|------------|
| 1 | profiles | User profiles (references `auth.users`) | id (FK auth.users), display_name, role (user/clinician/admin), created_at |
| 2 | user_preferences | Language + mode prefs | id, user_id (FK profiles), language, mode |
| 3 | consent_records | Explicit consent | id, user_id, consent_type, status, granted_at, revoked_at, expires_at, scope (JSONB), handoff_id |
| 4 | check_in_sessions | Check-in sessions (no raw messages) | id, user_id, mode, language, status, model_version, prompt_version, started_at, completed_at |
| 5 | safety_assessments | Safety + routing results | id, session_id (FK check_in_sessions), pre_gen_result, post_gen_result, routing_state, policy_version, created_at |
| 6 | content_modules | Wellbeing modules | id, title, purpose, status, current_version_id, primary_language |
| 7 | content_module_versions | Immutable module versions | id, module_id, version_number, steps (JSONB), warnings, contraindications, escalation_conditions, language, review_status, translation_status |
| 8 | providers | Fictional demo professionals | id, **profile_id (FK profiles)**, name, title, languages (JSONB), focus_areas (JSONB), availability, session_type, price_range, bio, **is_fictional_demo** (boolean, always true) |
| 9 | handoffs | Professional handoffs (includes structured summary) | id, user_id, provider_id, status, structured_summary (JSONB), excluded_entries (JSONB), sent_at, version |
| 10 | care_plans | Care plan container | id, user_id, clinician_id, status |
| 11 | care_plan_versions | Immutable plan versions | id, care_plan_id, version_number, goals (JSONB), assigned_modules (JSONB), check_in_frequency, boundaries (JSONB), follow_up_date, status, clinician_approved_at, user_accepted_at, created_at |
| 12 | audit_events | Append-only audit log (server INSERT only) | id, timestamp, request_id, user_id, actor, event_type, details (JSONB), policy_version, model_version, prompt_version |

**Structured summary** is stored within `handoffs.structured_summary` and as a JSONB column on `check_in_sessions` (added: `structured_summary JSONB`). No separate `check_in_messages` or `structured_check_ins` table — raw messages are not persisted.

### RLS Policies

```sql
-- profiles: user sees own profile
CREATE POLICY profiles_self ON profiles
  FOR SELECT USING (auth.uid() = id);

-- providers: all authenticated users can list providers; clinician sees own linked profile
CREATE POLICY providers_list ON providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- check_in_sessions: user sees own sessions
CREATE POLICY checkins_self ON check_in_sessions
  FOR ALL USING (auth.uid() = user_id);

-- consent_records: user sees/manages own consent
CREATE POLICY consent_self ON consent_records
  FOR ALL USING (auth.uid() = user_id);

-- handoffs: user sees own; clinician sees only SENT handoffs via providers.profile_id
CREATE POLICY handoffs_self ON handoffs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY handoffs_clinician ON handoffs
  FOR SELECT USING (
    status = 'SENT' AND provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- care_plans: user sees own; clinician sees plans via providers.profile_id
CREATE POLICY careplans_self ON care_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY careplans_clinician ON care_plans
  FOR ALL USING (
    clinician_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- audit_events: user views own; INSERT only from trusted server code
CREATE POLICY audit_self ON audit_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY audit_insert_server ON audit_events
  FOR INSERT WITH CHECK (true);  -- server-side only; deny anon/client via Supabase anon key restrictions

-- Service-role: NEVER exposed to client; used only in seed scripts and trusted admin operations
```

---

## 8. API Contracts (P0 = 12 endpoints)

```
POST   /api/check-ins
  Body:     { mode: 'GUEST' | 'CONNECTED_CARE', language: 'en' }
  Response: { id, status: 'INITIATED', createdAt }

POST   /api/check-ins/{id}/messages
  Body:     { content: string }
  Response: { userFacingResponse, extractedUpdates, followUp, modelVersion, promptVersion }
  Fallback: deterministic form response if model unavailable

POST   /api/check-ins/{id}/complete
  Body:     {}
  Response: { structuredSummary, routingDecision, routingState }

GET    /api/providers
  Query:    ?language=en&focus=stress
  Response: [{ id, name, title, languages, focusAreas, availability, priceRange, isFictionalDemo: true }]

POST   /api/handoffs
  Body:     { providerId, structuredSummary }
  Response: { id, status: 'DRAFT', version: 1 }

PATCH  /api/handoffs/{id}
  Body:     { structuredSummary?, excludedEntries? }
  Response: { id, status: 'USER_REVIEW', updatedFields }

POST   /api/handoffs/{id}/consent-and-send
  Body:     { explicitConsent: true }
  Response: { id, status: 'SENT', consentRecord, sentAt }
  Guard:    ATOMIC operation — validates explicit current consent, creates consent_record,
            transitions handoff through CONSENTED → SENT, appends audit event,
            commits all changes together or rolls all back.
            consent_records is the single authoritative consent source.
            No duplicate consent-status field on handoffs.

POST   /api/care-plans
  Body:     { userId, goals, assignedModules, checkInFrequency, boundaries, followUpDate }
  Response: { id, status: 'DRAFT', version: 1 }

POST   /api/care-plans/{id}/transition
  Body:     { action: 'propose' | 'approve' | 'accept' | 'revise' | 'pause' | 'retire' }
  Response: { id, status, version, previousVersionPreserved? }
  Guard:    Validates state machine transition; clinician role for 'approve'

POST   /api/content/compile
  Body:     { pastedText: string, language: 'en' }
  Response: { draftModule, validationWarnings }
  P0 Scope: Creates DRAFT or PENDING_CLINICAL_REVIEW only.
            Never represents content as clinically approved.

GET    /api/audit/me
  Response: [{ timestamp, actor, eventType, details, policyVersion, modelVersion, promptVersion }]

DELETE /api/privacy/check-ins/{id}
  Response: { deleted: true, deletedAt }
  Effect:   Removes check-in session + associated structured summary + safety assessment
```

---

## 9. State Machines (P0 = 4)

### 9.1 Check-in
```
INITIATED → IN_PROGRESS → COMPLETED → SUMMARIZED

  INITIATED   → IN_PROGRESS  (first message)
  IN_PROGRESS → IN_PROGRESS  (subsequent messages)
  IN_PROGRESS → COMPLETED    (6 turns or user ends)
  COMPLETED   → SUMMARIZED   (structured summary stored)

Invalid: SUMMARIZED → any, COMPLETED → IN_PROGRESS
```

### 9.2 Content Review (Hackathon P0 Scope)
```
DRAFT → PENDING_CLINICAL_REVIEW

AI constraint: AI creates DRAFT only.
Content compiler creates: DRAFT or PENDING_CLINICAL_REVIEW only.
No genuinely clinically approved content in the hackathon demo.

The Pause and Reflect module MUST always display:
"Prototype wellbeing content — not clinically reviewed. This does not
provide diagnosis, treatment or emergency support."

Post-hackathon blueprint retains full lifecycle:
  APPROVED | CHANGES_REQUESTED | SUSPENDED | RETIRED
```

### 9.3 Handoff/Consent (combined)
```
DRAFT → USER_REVIEW → CONSENTED → SENT → CLINICIAN_ACCEPTED → COMPLETED
                    → DECLINED         → DECLINED
                                        → EXPIRED

  DRAFT       → USER_REVIEW | DECLINED
  USER_REVIEW → CONSENTED | DECLINED
  CONSENTED   → SENT | DECLINED
  SENT        → CLINICIAN_ACCEPTED | DECLINED | EXPIRED
  CLINICIAN_ACCEPTED → COMPLETED | DECLINED
  COMPLETED, DECLINED, EXPIRED → (terminal)

SEND guard: status = CONSENTED AND explicit consent granted AND NOT revoked AND NOT expired AND destination valid.

Consent source of truth: consent_records table ONLY.
No separate consent-status field on handoffs.
The consent-and-send operation is ATOMIC:
  1. Validate explicit current consent
  2. Create consent_record
  3. Transition handoff through CONSENTED → SENT
  4. Append audit event
  5. Commit all together or roll all back

Login ≠ consent. Only explicit user action grants consent.
```

### 9.4 Care-Plan Versioning
```
DRAFT → PROPOSED → CLINICIAN_APPROVED → USER_ACCEPTED → ACTIVE
                                                         → PAUSED | REVISED | COMPLETED
REVISED → PROPOSED (new version, starts approval cycle again)
Any → RETIRED (terminal)

  DRAFT              → PROPOSED
  PROPOSED           → CLINICIAN_APPROVED | RETIRED
  CLINICIAN_APPROVED → USER_ACCEPTED | RETIRED
  USER_ACCEPTED      → ACTIVE | RETIRED
  ACTIVE             → PAUSED | REVISED | COMPLETED | RETIRED
  PAUSED             → ACTIVE | RETIRED
  REVISED            → PROPOSED

Critical:
  - AI CANNOT modify an ACTIVE care plan
  - Version 2 creates a NEW care_plan_versions record; V1 preserved immutably
  - ACTIVE requires BOTH clinician approval AND user acceptance
```

---

## 10. AI Output Schemas

### Conversational AI Output Contract (Zod)
```typescript
const AIOutputSchema = z.object({
  user_facing_response: z.string().min(1).max(500),
  extracted_updates: z.record(z.string(), z.unknown()).optional().default({}),
  requested_follow_up: z.enum([
    'duration', 'sleep_impact', 'functioning',
    'support_preference', 'safety_check', 'none'
  ]).nullable(),
  routing_indicators: z.array(z.enum([
    'stress_indicators', 'sleep_disruption',
    'functional_impact', 'support_readiness'
  ])).default([]),
  content_module_request: z.enum(['pause_reflect']).nullable(),
  tool_request: z.null(),
  unsupported_clinical_claims: z.array(z.string()).default([]),
  language: z.enum(['en', 'hi', 'hi-hinglish']),
  confidence: z.number().min(0).max(1),
  model_version: z.string(),
  prompt_version: z.string(),
});
```

### Structured Summary Schema
```typescript
const StructuredCheckInSchema = z.object({
  primary_concern: z.string().min(1).max(200),
  concern_duration: z.enum(['days', 'weeks', 'months', 'over_year']),
  sleep_impact: z.enum(['none', 'mild', 'significant', 'severe']),
  daily_functioning_impact: z.enum(['none', 'mild', 'moderate', 'significant']),
  support_preference: z.enum(['general_reflection', 'professional_support', 'immediate_resources']),
  feels_safe: z.enum(['yes', 'no', 'prefer_not_to_answer']),
  key_points: z.array(z.string()).max(10),
});
```

### Safe Fallback
When Zod validation fails, timeout occurs, or model is unavailable:
```typescript
const SAFE_FALLBACK = {
  user_facing_response: "I'm having trouble right now. Please try the form below to continue.",
  extracted_updates: {}, requested_follow_up: null,
  routing_indicators: [], content_module_request: null,
  tool_request: null, unsupported_clinical_claims: [],
  language: 'en', confidence: 0,
  model_version: 'fallback', prompt_version: 'fallback-v1',
};
```

---

## 11. Deterministic Safety and Consent Policies

These are **prototype deterministic safeguards** — not clinical triage or clinically validated safety.

### Pre-Generation Safety (before model call)
| Pattern | Action | User-Facing Response |
|---------|--------|---------------------|
| Diagnosis request | BLOCK | "I can't provide diagnoses. A qualified professional can help." |
| Medication request | BLOCK | "I can't advise on medications. Please consult your healthcare provider." |
| Clinician impersonation | BLOCK | "I'm Manas Guide, an AI wellbeing companion — not a clinician." |
| Self-harm language | ESCALATE | Supportive response + flag URGENT_SUPPORT_INFORMATION |
| Consent bypass | BLOCK | "I can only work with your explicit consent." |
| AI care-plan modification | BLOCK | "Care plans can only be modified by your clinician." |

### Post-Generation Check (after model response)
| Claim Type | Severity | Action |
|-----------|----------|--------|
| Diagnosis claim | Critical | Replace with fallback |
| Medication advice | Critical | Replace with fallback |
| Clinician impersonation | Critical | Replace with fallback |

### Routing Engine (deterministic, no ML)
```
IF feels_safe ∈ { 'no', 'prefer_not_to_answer' } → URGENT_SUPPORT_INFORMATION
IF self_harm/substance patterns → HUMAN_REVIEW_REQUIRED
IF functioning ∈ {moderate, significant}
   OR (sleep = significant AND duration = months) → PROFESSIONAL_SUPPORT_SUGGESTED
ELSE → GENERAL_WELLBEING
```
**feels_safe** comes from a direct structured user response, NOT an AI inference.
This is **prototype deterministic routing**, not clinical risk assessment.

Primary demo path: PROFESSIONAL_SUPPORT_SUGGESTED.

### Consent Policies
- Login ≠ consent to memory, sharing, or research
- Handoff requires explicit checkbox, timestamped, destination-specific
- Consent expiration: 90-day TTL
- Revocation: immediate; invalidates pending handoffs
- AI can NEVER grant or revoke consent

---

## 12. Language Strategy

- **English** is the mandatory working P0 path
- **Hindi/Hinglish** is a scripted or stretch demonstration labelled **PENDING_REVIEW**
- Hindi/Hinglish is NOT a blocker for P0 completion
- Architecture supports adding languages later (prompt templates directory, language enum)
- For P0: all prompts, UI text, module content, and safety patterns are English-first
- If time permits on Day 5-6: scripted Hindi demo with "This content has not been independently reviewed in this language" label

---

## 13. P0 Privacy

| Feature | P0 Scope |
|---------|----------|
| Consent display | Show current consent status on `/privacy` route |
| Consent revoke | User can revoke consent; invalidates pending handoffs |
| View summaries | List all structured summaries from check-in sessions |
| Delete summary | `DELETE /api/privacy/check-ins/{id}` removes session + summary |
| Audit timeline | Chronological events on `/privacy` route |

**Deferred to P1**: Full account deletion, data export, detailed memory management screen.

---

## 14. Interface-Compatible Fallbacks

No multi-platform fallback matrix. Instead, each dependency has an **interface-compatible** replacement:

| Dependency | Interface | P0 Fallback |
|-----------|-----------|-------------|
| Alibaba Qwen API | `ModelGateway` interface | **Mock ModelGateway** — returns deterministic structured JSON matching `AIOutputSchema` |
| Supabase Auth | Auth session interface | **Seeded DEMO_MODE sessions** — pre-created session tokens for demo users |
| Supabase Database | Repository interface | **Seeded in-memory repository adapter** — implements same interface with Map-backed storage |
| Conversational AI check-in | `CheckInOrchestrator` interface | **Deterministic form fallback** — HTML form with the 6 check-in questions, produces same `StructuredCheckIn` output |

Each fallback implements the same TypeScript interface as the production dependency. Swapping is a configuration change, not a code change.

---

## 15. Judging Criteria Mapping (Actual Weights)

| Criterion | Weight | How Manas Demonstrates It |
|-----------|--------|--------------------------|
| **Use of Qoder** | 30% | Spec-first workflow, Experts Mode across 10 perspectives, worktree isolation, task decomposition, defect tracking, reusable content-compiler workflow documented in docs/qoder-workflow.md |
| **Innovation and Creativity** | 25% | Clinician-governed immutable care-plan versioning with independent deterministic safety routing — not just another chatbot; consent-controlled handoff; prototype deterministic safeguards |
| **Impact** | 20% | Demonstrates how AI can support adults with work-related stress through structured reflection, professional preparation, and care navigation — without claiming clinical authority |
| **Technical Execution** | 15% | TypeScript strict modular monolith, 4 state machines, Zod-validated AI output, row-level security, safety sandwich pattern, ModelGateway abstraction, append-only audit, interface-compatible fallbacks |
| **Presentation and UGC** | 10% | Live deployed demo, 2-3 minute demo script, calm transparent UI, persistent AI disclosure, screenshots, social media draft, synthetic-data disclaimer |

---

## 16. Test Strategy

Tests are written **during each feature implementation**, not deferred to a single day.

### Targets

| Type | Count | Tool | Written When |
|------|-------|------|-------------|
| Table-driven unit tests | 25-35 | Vitest | During feature implementation |
| Integration/RLS tests | 6-10 | Vitest + Supabase test client | After DB schema is stable (Day 2) |
| Playwright E2E tests | 2 | Playwright | After routes are functional (Day 4-5) |
| Synthetic evaluation scenarios | 20-30 | Evaluation runner script | Day 5-6 |
| Manual high-risk review | 10-12 scenarios | Human review | Day 6 |

### Unit Test Categories (25-35)
| Category | Count |
|----------|-------|
| Safety policy (diagnosis, medication, impersonation blocks) | 8-10 |
| State machine transitions (4 machines × valid + invalid) | 8-10 |
| AI output contract (valid, invalid, malformed, fallback) | 5-6 |
| Routing engine (4 states + edge cases) | 4-5 |
| Consent validation (grant, revoke, expiry, login≠consent) | 3-4 |

### Integration/RLS Tests (6-10)
| Category | Count |
|----------|-------|
| Cross-user access blocked (User A cannot read User B) | 3-4 |
| Clinician sees only SENT handoffs | 2 |
| Audit events INSERT-only from server | 1-2 |
| API contract validation (core endpoints) | 2-3 |

### Playwright E2E Tests (2)
1. **Primary user journey**: Landing → check-in → summary → routing → module → professionals → handoff → consent → clinician inbox → care-plan create → approve → user accept → audit timeline
2. **Clinician workflow**: Clinician login → view handoff → create care plan → approve → revise to V2 → verify V1 preserved

### Evaluation Dataset (20-30 scenarios)
| Category | Scenarios |
|----------|-----------|
| General wellbeing | 2-3 |
| Diagnosis attempts | 2-3 |
| Medication requests/stopping | 3-4 |
| Clinician impersonation | 2 |
| Consent-bypass attempts | 2 |
| Care-plan modification attempts | 2 |
| Prompt injection (role assumption, jailbreak) | 3-4 |
| Unapproved content requests | 2 |
| Cross-user access attempts | 2 |
| Malformed output handling | 2 |

### Manual High-Risk Review (10-12)
The 10-12 highest-risk scenarios are manually reviewed by the Integration Lead on Day 6:
- All prompt injection scenarios
- All consent bypass scenarios
- All cross-user access scenarios

---

## 17. Acceptance Criteria

1. Seeded user completes primary demo journey end-to-end
2. Check-in works in English
3. All AI output is Zod-schema-validated
4. Invalid model output triggers safe deterministic fallback
5. Diagnosis requests are blocked by prototype deterministic safeguards
6. Medication requests are blocked or safely redirected
7. AI never claims to be a clinician
8. Unapproved content is prominently labelled "Prototype wellbeing content — not clinically reviewed"
9. Care plan cannot activate without clinician approval AND user acceptance
10. Handoff cannot be sent without explicit user consent
11. Version 2 care plan does not overwrite Version 1
12. Clinician and user actions appear in audit timeline
13. Model, prompt, and policy versions are recorded
14. Cross-user database access tests fail safely (RLS)
15. Check-in session deletion removes structured summary
16. Care-plan state transitions are enforced (4 state machines)
17. Content-review state transitions are enforced
18. Handoff/consent state transitions are enforced
19. All unit tests pass (25-35)
20. All integration tests pass (6-10)
21. Both E2E tests pass (2)
22. Application builds cleanly (TypeScript strict, no errors)
23. Deployed demonstration works in a fresh browser
24. No real personal or clinical information is present
25. README accurately states product limitations
26. No clinical-validation claim appears anywhere
27. No regulatory-approval claim appears anywhere
28. All professional profiles are clearly marked as fictional demo profiles
29. Deployed product states it is a synthetic-data hackathon demonstration
30. Hindi/Hinglish (if present) is labelled PENDING_REVIEW

---

## 18. Scope

### P0 — MUST COMPLETE (per AGENTS.md)
1. Landing page + AI disclosure
2. Adult English work-stress check-in
3. Schema-validated AI output (Zod)
4. Editable structured summary
5. Deterministic non-diagnostic routing
6. One labelled prototype wellbeing module ("Pause and Reflect")
7. Two fictional demo professional profiles
8. Editable consent-controlled handoff
9. Mock clinician portal
10. Immutable Care Plan Version 1 and Version 2
11. Audit timeline
12. Minimal privacy controls (consent display/revoke, view/delete summary, audit)
13. Pasted-text clinician content compiler
14. Synthetic demonstration data
15. Tests + deployed responsive web demo

### P1 — IF P0 STABLE
- Hindi/Hinglish full refinement
- Modules 2-3 (Professional Prep, Session Prep)
- Content-review workflow UI
- Memory management detailed screen
- Evaluation dashboard UI
- Data export/deletion full workflows
- Provider verification workflow

### P2 — POST-HACKATHON
- Additional languages, voice, audio, appointments, real providers, analytics, integrations

### FLAGGED AND REMOVED
- **Unsafe**: Real crisis operations, real patient data, autonomous agents
- **Clinically dependent**: Clinical validation claims, regulatory claims
- **Unnecessary**: Native mobile apps, payments, employer/insurer/EHR integration
- **Unlikely by 5 Aug**: Full multilingual, voice, audio, advanced analytics
- **Inconsistent with AGENTS.md**: Clinician cloning, autonomous policy changes
- **Diagnosis/treatment/medication**: All removed
- **Unverified claims**: "First AI companion" removed
- **Real identities**: All professionals marked as fictional demo profiles

---

## 19. Daily Plan (Thu 30 Jul – Wed 5 Aug)

### Day 1: Thu 30 Jul (evening) — Scaffold + Skeleton

**All three team members** (~5:15 PM onwards):
- Next.js project scaffold (App Router, TypeScript strict mode, Tailwind)
- Brand config module (colours, typography, spacing tokens)
- 12-route navigation skeleton (empty pages, working routing)
- Shared Zod contracts: AIOutputSchema, StructuredCheckInSchema
- Four state-machine definitions + transition validators (no persistence yet)
- Mock ModelGateway (deterministic structured JSON matching AIOutputSchema)
- Seeded in-memory repository adapter (Map-backed, same interface as future Supabase adapter)
- Route 1 `/`: Landing + disclosure page + language/mode selection (static)
- Tailwind theme (calm, warm, accessible, strong contrast)
- Shared component library skeleton

**Exit criteria**: `npm run lint` + `npm run type-check` + `npm run build` all pass. Landing page renders. 12 routes navigable (empty stubs). Mock gateway returns valid structured JSON.

**Tests written tonight**: State machine transition unit tests (8-10 tests covering all 4 machines).

---

### Day 2: Fri 31 Jul — Supabase + Live AI + Check-in + Safety

**Product & Integration Lead**:
- Supabase project setup, complete schema for 12 tables, RLS policies
- Seed script: Ananya + Dr Maya Rao + 3 fictional providers + "Pause and Reflect" module
- Environment variables (.env.example)
- CI/CD pipeline (GitHub Actions: lint → type-check → build)

**AI & Backend Lead**:
- ModelGateway Qwen provider implementation (real Alibaba Cloud API calls)
- Fallback handler: malformed output → SAFE_FALLBACK
- Safety policy engine (pre-generation blocks)
- Routing engine (deterministic, 4 states)
- `POST /api/check-ins` + `POST /api/check-ins/{id}/messages` + `POST /api/check-ins/{id}/complete`
- Prompt templates (English v1)
- Domain layer: `domain/ai/`, `domain/safety/`, `domain/state-machines/`

**Frontend & Clinician-Workflow Lead**:
- Route 2 `/check-in`: Conversational UI (6 turns) + form fallback
- Route 3 `/summary`: Editable structured summary + routing result display
- Check-in state machine UI integration

**Exit criteria**: Full check-in → summary → routing works in English with live Qwen API. Diagnosis/medication blocked. Form fallback works. Supabase schema applied, RLS active, seed data loaded.

**Tests written today**: Safety policy unit tests (8-10), AI output contract tests (5-6), routing engine tests (4-5).

---

### Day 3: Sat 1 Aug — Module + Professionals + Handoff

**Product & Integration Lead**:
- Deploy staging to Vercel (preview branch)
- RLS integration tests (3-4 cross-user access tests)
- Evaluation dataset skeleton (10 scenarios)
- Additional integration tests (2-3)

**AI & Backend Lead**:
- `GET /api/providers` endpoint
- `POST /api/handoffs` + `PATCH /api/handoffs/{id}` endpoints
- Handoff state machine enforcement
- Content module storage + `POST /api/content/compile` (text paste)

**Frontend & Clinician-Workflow Lead**:
- Route 4 `/module/pause-reflect`: Module display with prototype label
- Route 5 `/professionals`: Provider list + detail view (fictional demo profiles clearly marked)
- Route 6 `/handoff`: Handoff editor (auto-populated, editable) + consent flow

**Exit criteria**: Module visible with label. Professionals listed (marked fictional). Handoff editable.

**Tests written today**: Consent validation tests (3-4), handoff state machine additional tests.

---

### Day 4: Sun 2 Aug — Consent + Clinician Portal + Care Plan

**Product & Integration Lead**:
- Consent integration tests (2-3)
- Begin Playwright E2E test #1 (primary journey)
- Evaluation dataset (25 scenarios)

**AI & Backend Lead**:
- `POST /api/handoffs/{id}/consent-and-send` (consent guard + send)
- `POST /api/care-plans` + `POST /api/care-plans/{id}/transition`
- `GET /api/audit/me` endpoint
- Audit event logging wired into all state transitions

**Frontend & Clinician-Workflow Lead**:
- Complete consent UI on `/handoff` route
- Route 9 `/clinician`: Clinician inbox (handoff list + review)
- Route 10 `/clinician/care-plan`: Care-plan workspace (create, approve, revise)

**Exit criteria**: Consent required for handoff send. Clinician sees handoff. Care plan created + approved through state machine. Audit events recording.

**Tests written today**: Additional state machine tests, API contract tests (2-3).

---

### Day 5: Mon 3 Aug — Acceptance + Audit + Privacy + Content Compiler

**Product & Integration Lead**:
- Complete Playwright E2E tests #1 and #2
- Evaluation dataset complete (20-30 scenarios)
- Evaluation runner script
- Begin docs/qoder-workflow.md

**AI & Backend Lead**:
- Care-plan user acceptance flow (USER_ACCEPTED → ACTIVE)
- Care-plan V2 revision (V1 preserved immutably)
- Route 11 backend: content compiler (text paste → draft extraction)
- `DELETE /api/privacy/check-ins/{id}` endpoint

**Frontend & Clinician-Workflow Lead**:
- Route 7 `/care-plan`: Care-Plan Twin view + V1/V2 comparison
- Route 8 `/privacy`: Consent display/revoke + summary view/delete + audit timeline
- Route 11 `/clinician/content`: Content compiler UI

**Exit criteria**: Full journey works end-to-end. V1/V2 care plans visible. Audit timeline complete. Privacy controls functional. Staging deployed.

**Tests written today**: Final unit tests, Playwright E2E test #2 (clinician workflow).

---

### Day 6: Tue 4 Aug — Polish + Staging + Documentation

**Product & Integration Lead**:
- Run full test suite: unit (25-35), integration (6-10), E2E (2)
- Manual high-risk scenario review (10-12 scenarios)
- Generate evaluation report
- Production deploy to Vercel
- Fresh-browser verification
- Complete: README, docs/qoder-workflow.md, known-limitations doc, demo script
- Screenshots of primary journey
- Social media draft

**AI & Backend Lead**:
- Fix any failing tests
- Hindi/Hinglish scripted demo (stretch, labelled PENDING_REVIEW) — only if all P0 tests pass
- Verify all model/prompt versions recorded correctly
- Verify no real data present

**Frontend & Clinician-Workflow Lead**:
- Final UX polish (responsive mobile check)
- Route 12 `/demo` (optional — pre-loaded walkthrough)
- Verify persistent AI disclosure on all routes
- Verify "synthetic-data hackathon demonstration" disclaimer visible
- Verify all professionals marked "fictional demo profile"

**Exit criteria**: All tests pass. Production live. Documentation complete. Demo script ready.

---

### Day 7: Wed 5 Aug — SUBMISSION

- Morning: Final fresh-browser verification on production URL
- Capture final screenshots
- Assemble submission package
- Submit to Alibaba Cloud x Qoder Hackathon

---

## 20. Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Prompt injection | High | High | Pre-gen policy check + input redaction + post-gen validation + Zod schema |
| Cross-user data access | Medium | Critical | RLS at DB layer + API auth checks + RLS isolation tests |
| AI clinical claim | Medium | Critical | Post-gen clinical-claim detector + fallback replacement |
| Consent bypass | Medium | High | State machine guard: SEND requires CONSENTED + valid consent |
| Care-plan tampering by AI | Low | High | Policy: AI has NO write access to active care plans |
| Audit log tampering | Low | Medium | Append-only (INSERT via server only, RLS denies client INSERT) |
| API key exposure | Low | High | Vercel env vars only; never in browser code |
| Raw conversation leakage | N/A | N/A | Raw messages not persisted by design |

---

## 21. Risks, Fallbacks, and Definition of Done

### Top Risks

| # | Risk | P | I | Mitigation |
|---|------|---|---|------------|
| 1 | Qwen API unavailable | High | Critical | Mock ModelGateway ready; interface-compatible swap |
| 2 | RLS misconfiguration | Medium | Critical | RLS tests Day 2; peer review policies |
| 3 | Scope creep | High | High | Daily scope check against this spec; defer P1 immediately |
| 4 | Schema mismatch | Medium | High | Schema-first; mock provider until real integration |
| 5 | State machine bugs | Medium | High | Tests written alongside implementation (not deferred) |
| 6 | E2E flakiness | Medium | Medium | Explicit waits, data-testid, 3 retries, trace on failure |
| 7 | Supabase issues | Low | Critical | In-memory repository adapter as fallback |
| 8 | Deploy failure | Low | High | Deploy daily from Day 1; staging first |
| 9 | Team coordination | Medium | Medium | Daily standup; shared contracts agreed Day 1 |
| 10 | Time overrun | High | High | Ruthless scope control; Hindi/Hinglish is stretch only |

### Interface-Compatible Fallbacks

| Dependency | Interface | Fallback |
|-----------|-----------|----------|
| Alibaba Qwen | `ModelGateway` | Mock ModelGateway (deterministic JSON) |
| Supabase Auth | Auth session | Seeded DEMO_MODE sessions |
| Supabase DB | Repository | Seeded in-memory repository adapter |
| Conversational check-in | `CheckInOrchestrator` | Deterministic form fallback |

### Definition of Done
- All 30 acceptance criteria verified
- All P0 tests pass (25-35 unit + 6-10 integration + 2 E2E)
- `npm run build` clean, `npm run lint` clean, `tsc --noEmit` clean
- Production deployed to Vercel, works in fresh browser
- README, qoder-workflow.md, limitations doc, demo script complete
- No real patient data, no clinical claims, no clinician impersonation
- All professionals marked as fictional demo profiles
- Product clearly states: "synthetic-data hackathon demonstration, not intended for real mental-health support"
- Evaluation dataset (20-30 scenarios) executed with report
- Seeded demo data (Ananya + Dr Maya Rao + 3 fictional providers + module + audit trail)

---

## Rejected Alternatives

| Alternative | Why Rejected |
|-------------|-------------|
| Persist raw conversation messages | Increases privacy surface area; user-reviewed structured summary is sufficient for P0 demo |
| 22 separate screens | Consolidated to 12 routes for faster implementation and clearer navigation |
| 6 state machines | Reduced to 4: consent and deletion state machines merged into handoff/consent or deferred |
| Multi-platform fallback matrix (Firebase, SQLite, etc.) | Replaced with interface-compatible fallbacks — same TypeScript interface, no platform switching |
| 60+ unit tests | Reduced to 25-35 focused table-driven tests; quality over quantity for hackathon |
| Tests deferred to Day 6 | Tests written during feature implementation to catch bugs early |
| Hindi/Hinglish as P0 blocker | English is mandatory P0 path; Hindi/Hinglish is stretch/PENDING_REVIEW |
| Full account deletion + export in P0 | Deferred to P1; P0 has consent revoke + summary delete |
| "First AI companion" claim | Removed — unverified |
| Clinical triage language | Replaced with "prototype deterministic safeguards" |
| 2-person team | Expanded to 3-person team for realistic 7-day delivery |
| Incorrect calendar (Tue start) | Corrected: 30 Jul = Thursday, submission = Wednesday 5 Aug |
