PROJECT NAME

Manas

WORKING TAGLINE

A private, multilingual, clinician-governed companion for structured
wellbeing check-ins, reviewed support, care preparation and continuity.

DEADLINE

Alibaba Cloud x Qoder Hackathon submission:
5 August 2026.

IMPORTANT BRAND NOTE

“Manas” is currently a working product name and has not yet been legally
or commercially cleared.

Keep all brand references centralised in a single configuration file so
that the product can be renamed later without changing business logic,
database structures, APIs or tests.

Recommended configuration:

productName: Manas
assistantName: Manas Guide
clinicianPortalName: Manas Clinical
carePlanFeatureName: Care-Plan Twin

PRODUCT PURPOSE

Build a safe hackathon prototype demonstrating how AI can support an
adult experiencing everyday work-related emotional distress without:

- diagnosing a condition;
- providing medical treatment;
- recommending or changing medication;
- impersonating a psychologist or psychiatrist;
- replacing qualified human care;
- claiming clinical validation;
- pretending to provide emergency or crisis intervention.

The system must:

1. Conduct a short structured conversational wellbeing check-in.
2. Convert the conversation into an editable structured summary.
3. Pass user inputs through an independent safety and routing layer.
4. Offer only reviewed or clearly labelled prototype wellbeing modules.
5. Help the user prepare for professional care.
6. Allow the user to select a mock verified professional.
7. Create an editable and consent-controlled professional handoff.
8. Allow a mock clinician to create and approve a versioned digital twin
   of the user’s care plan.
9. Use only the approved care-plan version during later check-ins.
10. Maintain an auditable record of model, policy, consent, content and
    care-plan versions.

PRODUCT POSITIONING

Manas is not:

- an AI psychologist;
- an AI psychiatrist;
- a diagnostic system;
- a medical-device prototype;
- a digital therapeutic;
- a crisis-response service;
- a medication adviser;
- a replacement for professional mental-health care;
- a copy, clone or digital impersonation of any real clinician.

The digital twin is a structured, versioned twin of the user’s
clinician-approved care plan.

It is not a twin of the clinician’s:

- personality;
- identity;
- face;
- age;
- appearance;
- voice;
- professional authority;
- unrestricted clinical reasoning.

TARGET USER

Primary demonstration persona:

- Adult aged 18 or above
- Working professional
- Experiencing work-related stress and poor sleep
- Seeking reflection, preparation or care navigation
- Not represented as having a diagnosed condition
- Not represented as requiring emergency intervention

PRIMARY DEMO PERSONA

Name: Ananya Sharma

Scenario:

Ananya has been experiencing workplace stress, disturbed sleep and
difficulty concentrating. She wants to understand what she is
experiencing, use a short wellbeing exercise and prepare to speak with
a qualified professional.

SUPPORTED LANGUAGES

Required for the hackathon:

- English
- Hindi/Hinglish

The architecture must support adding:

- Tamil
- Mandarin
- Malay
- Bahasa Indonesia
- Other Asian languages later

For every supported language:

- preserve meaning;
- preserve safety-routing behaviour;
- preserve exclusions and limitations;
- preserve consent language;
- record the language used;
- record model and prompt versions;
- label machine-translated content as pending review unless it has been
  independently reviewed;
- do not assume that English safety tests automatically validate another
  language.

USER ROLES

1. USER

The user can:

- use guest or connected-care mode;
- complete structured check-ins;
- review and edit AI-generated summaries;
- access approved or clearly labelled prototype modules;
- manage personal memory;
- select a professional;
- review and approve a handoff summary;
- view an active care plan;
- review changes between care-plan versions;
- export personal information;
- delete personal information;
- revoke consent;
- pause or disable memory;
- report an unsafe or inappropriate AI response.

2. CLINICIAN

The clinician can:

- view only user-approved handoff information;
- review a handoff summary;
- propose a care plan;
- assign reviewed modules;
- define goals;
- define check-in frequency;
- define professional boundaries;
- approve, revise, pause or close a care-plan version;
- view only user-approved progress information;
- report unsafe AI behaviour;
- suspend use of a content module;
- suspend the companion for a particular user.

3. ADMIN / CONTENT REVIEWER

The admin or content reviewer can:

- create prototype modules;
- upload clinician documents;
- assign clinical and language reviewers;
- manage module-review status;
- manage mock professional-verification status;
- review non-sensitive system audit metadata;
- review evaluation results;
- manage prompt and policy versions;
- suspend unsafe content.

The admin cannot browse private user conversations or journals by default.

PRIMARY USER JOURNEY

1. Ananya opens Manas.

2. She sees a clear disclosure:

   “Manas is an AI wellbeing companion. It is not a psychologist,
   psychiatrist, medical service or emergency service.”

3. She selects:

   - English; or
   - Hindi/Hinglish.

4. She selects one of two modes:

   PRIVATE_GUEST_MODE
   CONNECTED_CARE_DEMO_MODE

5. She completes a three-minute structured check-in.

6. Manas Guide asks only approved questions relevant to:

   - current concern;
   - duration;
   - sleep impact;
   - daily functioning;
   - support preference;
   - whether the user feels safe at present.

7. The AI converts the conversation into a structured summary.

8. Ananya reviews and edits the summary.

9. The structured information is passed to an independent safety and
   routing service.

10. The system selects one of these non-diagnostic routing states:

    GENERAL_WELLBEING

    PROFESSIONAL_SUPPORT_SUGGESTED

    HUMAN_REVIEW_REQUIRED

    URGENT_SUPPORT_INFORMATION

11. For the main demonstration:

    PROFESSIONAL_SUPPORT_SUGGESTED is selected.

12. Ananya receives one low-risk prototype reflection module.

13. The module is visibly labelled:

    “Prototype wellbeing content — not clinically reviewed. This does
    not provide diagnosis, treatment or emergency support.”

14. Ananya searches mock professionals using:

    - language;
    - availability;
    - focus area;
    - online or in-person preference;
    - price range.

15. She selects one mock psychologist.

16. Manas creates a draft handoff summary.

17. Ananya can:

    - edit it;
    - remove information;
    - exclude journal entries;
    - decline to share it;
    - explicitly approve it.

18. The handoff cannot be sent without valid, current consent.

19. The mock clinician reviews the approved summary.

20. The mock clinician creates Care Plan Version 1.

21. The care plan includes:

    - user goals;
    - assigned prototype modules;
    - check-in frequency;
    - subjects to monitor;
    - professional boundaries;
    - follow-up date;
    - care-plan status;
    - clinician approval record.

22. Ananya reviews and accepts the assignment.

23. A later check-in uses only Care Plan Version 1.

24. The clinician replaces one module and proposes Version 2.

25. Version 2 cannot become active until:

    - the clinician approves it;
    - the user is informed;
    - the required user acceptance is recorded.

26. Version 1 remains available in the immutable version history.

27. The audit page shows:

    - model version;
    - prompt version;
    - safety-policy version;
    - consent version;
    - content-module version;
    - care-plan version;
    - user edits;
    - clinician approvals;
    - handoff events.

SECONDARY CLINICIAN-CONTENT JOURNEY

1. A clinician or administrator uploads or pastes a care-module document.

2. Supported prototype inputs:

   - pasted text;
   - DOCX;
   - PDF;
   - structured Markdown.

3. AI extracts a draft module.

4. The draft schema includes:

   title
   purpose
   intended_users
   excluded_users
   intended_use
   excluded_uses
   steps
   warnings
   contraindications
   escalation_conditions
   language
   source
   author
   clinical_reviewer
   language_reviewer
   review_date
   version
   review_status

5. The system identifies missing fields.

6. Example warnings:

   “Excluded users have not been specified.”

   “No escalation conditions are defined.”

   “The professional reviewer is missing.”

   “The source of this exercise is not recorded.”

   “The Hindi translation has not been independently reviewed.”

7. AI may suggest draft values.

8. AI must never mark content as:

   APPROVED

   CLINICALLY_VALIDATED

   REGULATORY_APPROVED

9. A human reviewer must:

   - review;
   - edit;
   - approve;
   - request changes;
   - suspend; or
   - reject the module.

10. Only APPROVED modules may be presented as clinician-reviewed.

11. PROTOTYPE modules may be used only with a prominent unreviewed label.

12. Every modification creates a new immutable module version.

13. The content compiler generates:

   - unit-test fixtures;
   - language-equivalence tests;
   - contraindication tests;
   - unsupported-use tests;
   - safety scenarios;
   - review checklists;
   - UI configuration.

CONTENT STATUS MODEL

DRAFT

PENDING_CLINICAL_REVIEW

CHANGES_REQUESTED

APPROVED

SUSPENDED

RETIRED

Invalid transitions must be rejected.

Example:

DRAFT
→ PENDING_CLINICAL_REVIEW
→ APPROVED

Alternative:

PENDING_CLINICAL_REVIEW
→ CHANGES_REQUESTED
→ PENDING_CLINICAL_REVIEW
→ APPROVED

An APPROVED module that becomes unsafe must move to SUSPENDED rather
than being deleted from historical audit records.

PROTOTYPE CONTENT LABEL

All unreviewed prototype modules must display:

“Prototype wellbeing content — not clinically reviewed. This does not
provide diagnosis, treatment or emergency support.”

CARE-PLAN STATUS MODEL

DRAFT

PROPOSED

CLINICIAN_APPROVED

USER_ACCEPTED

ACTIVE

PAUSED

REVISED

COMPLETED

RETIRED

Invalid transitions must be rejected.

Required workflow:

DRAFT
→ PROPOSED
→ CLINICIAN_APPROVED
→ USER_ACCEPTED
→ ACTIVE

A care-plan modification must:

- create a new version;
- preserve the prior version;
- require clinician approval;
- notify the user;
- record an audit event.

The language model must never directly modify an ACTIVE care plan.

HANDOFF STATUS MODEL

DRAFT

USER_REVIEW

CONSENTED

SENT

CLINICIAN_ACCEPTED

APPOINTMENT_REQUESTED

COMPLETED

DECLINED

EXPIRED

A handoff cannot move to SENT unless:

- the user has reviewed the current handoff version;
- explicit sharing consent exists;
- the consent has not been revoked;
- the destination professional is valid;
- the handoff has not expired.

MVP FEATURES — MUST HAVE

A. USER EXPERIENCE

- Responsive mobile-first web application
- Guest mode
- Connected-care demonstration mode
- English selector
- Hindi/Hinglish selector
- Three-minute structured check-in
- Conversational interface
- Form fallback if AI is unavailable
- Editable structured summary
- Clear AI disclosure
- Clear product limitations
- Non-diagnostic routing result
- Prototype wellbeing-module experience
- Mock professional directory
- Professional profile
- Handoff editor
- Consent screen
- Care-plan twin
- Care-plan version comparison
- Progress timeline
- Session-preparation summary
- User audit timeline
- Privacy centre
- Memory controls
- Data export
- Data deletion
- Unsafe-response reporting

B. CLINICIAN EXPERIENCE

- Mock clinician login
- Handoff review
- Care-plan creation
- Goal creation
- Module assignment
- Check-in scheduling
- Care-plan version approval
- Care-plan pause
- Care-plan closure
- User-approved progress view
- AI-concern reporting
- Module-suspension request

C. CONTENT COMPILER

- Paste content
- Upload sample document
- Extract structured module
- Validate required metadata
- Flag missing safety fields
- Display sources
- Display reviewer status
- Human review workflow
- Version history
- Test-fixture generation
- Multilingual-review status
- Content suspension

D. AI

- Multilingual conversational check-in
- Strict structured output
- Structured-summary generation
- Clinician-document extraction
- Retrieval from approved or labelled prototype content
- Session-preparation summary
- Draft translation
- Pattern explanation using deterministic metrics
- Controlled fallback when model output fails

E. SAFETY AND GOVERNANCE

- Independent deterministic policy engine
- Separate constrained contextual classifier
- Pre-generation safety check
- Post-generation clinical-claim check
- Explicit routing states
- No unrestricted health-related web search
- No direct model authority over sharing
- No direct model authority over consent
- No direct model authority over care-plan modification
- No direct model authority over admin actions
- Append-only audit events
- Prompt and model versioning
- Content and policy versioning

F. EVALUATION

- Versioned synthetic evaluation dataset
- Minimum 30 scenarios
- English scenarios
- Hindi/Hinglish scenarios
- Prompt-injection scenarios
- Diagnosis requests
- Medication requests
- Requests to stop medication
- Dependency language
- Ambiguous concerning language
- Consent-bypass attempts
- Care-plan modification attempts
- Requests for unapproved content
- Cross-user access tests
- Clinician-impersonation tests
- Translation inconsistency tests
- Malformed structured-output tests

NON-GOALS

Do not build:

- diagnosis;
- condition classification presented as diagnosis;
- treatment recommendations;
- medication recommendations;
- medication changes;
- prescriptions;
- clinical assessment represented as definitive;
- workflows for minors;
- real crisis-response operations;
- automatic emergency contact;
- clinician voice cloning;
- clinician face cloning;
- age-shifted clinician avatars;
- photorealistic clinician replicas;
- real clinician marketplace payments;
- insurance integration;
- employer integration;
- EHR integration;
- real patient data;
- production clinical records;
- autonomous live-model retraining;
- autonomous prompt modification;
- autonomous safety-policy changes;
- autonomous care-plan changes;
- clinical-validation claims;
- regulatory-approval claims.

TECHNOLOGY STACK

Use a TypeScript-first modular monolith.

FRONTEND

- Next.js
- TypeScript strict mode
- Tailwind CSS
- Accessible responsive design
- PWA-ready structure
- Server-side rendering where appropriate
- Calm and transparent user interface
- No photorealistic clinician avatar

BACKEND

- Next.js server routes initially
- NestJS only if separation becomes necessary
- Supabase authentication
- PostgreSQL
- Row-level security
- Encrypted object storage for sample files
- Append-only audit-event table
- Environment-variable validation
- Centralised error handling
- Request IDs and trace IDs

AI

- Alibaba Cloud Model Studio / Qwen
- Internal ModelGateway abstraction
- Provider-independent model interface
- Zod validation for every AI output
- No API credentials in browser code
- Model and prompt versioning
- Timeouts
- Retries with limits
- Deterministic safe fallback
- Input redaction
- Least-privilege tool broker

TESTING

- Vitest for unit tests
- Vitest for domain-policy tests
- API contract tests
- Playwright for end-to-end tests
- Row-level-security isolation tests
- State-machine transition tests
- Prompt-injection tests
- Multilingual-equivalence tests
- Accessibility tests
- Build and lint checks

DEPLOYMENT

- Vercel or Alibaba Cloud-compatible deployment
- Managed PostgreSQL
- Seeded demonstration database
- No production patient or clinical data
- Separate demo accounts
- Secret storage through environment management
- Staging and demonstration environments

ARCHITECTURE PATTERNS

1. Modular monolith

2. Clean or hexagonal domain boundaries

3. Explicit state machines for:

   - check-in;
   - handoff;
   - content review;
   - care-plan approval;
   - consent;
   - deletion.

4. Policy-as-code for:

   - consent;
   - content eligibility;
   - safety routing;
   - care-plan transitions;
   - handoff sharing;
   - professional access.

5. Model-gateway pattern

6. Retrieval-augmented generation using only approved or clearly labelled
   prototype content

7. Append-only audit-event pattern

8. Human-in-the-loop approval

9. Safety-sandwich pattern:

   pre-generation check
   → constrained generation
   → post-generation validation

10. Least-privilege tool broker

11. Immutable versioning for:

   - modules;
   - care plans;
   - policies;
   - prompts;
   - models;
   - consent language;
   - handoff summaries.

12. Privacy by design

REQUIRED MODULES

- brand-config
- identity
- guest-session
- consent
- privacy
- check-in
- conversation-orchestrator
- model-gateway
- safety-policy
- safety-classifier
- content-library
- content-compiler
- content-review
- care-plan
- provider-directory
- provider-verification
- handoff
- appointment-demo
- audit
- evaluation
- admin
- notification-demo
- deletion
- export

CORE DATA ENTITIES

BrandConfiguration

User

GuestSession

UserPreference

ConsentRecord

MemoryRecord

CheckInSession

CheckInMessage

StructuredCheckIn

SafetyAssessment

SafetyEvent

RoutingDecision

ContentModule

ContentModuleVersion

ContentReview

ContentTranslation

CarePlan

CarePlanVersion

CarePlanAssignment

CarePlanAcceptance

Provider

ProviderCredential

ProviderAvailability

Handoff

HandoffVersion

HandoffConsent

AppointmentRequest

OutcomeCheckIn

SessionPreparationSummary

ModelRelease

PromptTemplate

PolicyVersion

AuditEvent

DataExportRequest

DataDeletionRequest

UnsafeResponseReport

AI OUTPUT CONTRACT

Every conversational AI call must return strict JSON containing:

user_facing_response

extracted_updates

requested_follow_up

routing_indicators

content_module_request

tool_request

unsupported_clinical_claims

language

confidence

model_version

prompt_version

Example:

{
  "user_facing_response": "That sounds exhausting. How long has this
  been affecting your sleep?",
  "extracted_updates": {
    "sleep_impact": "significant"
  },
  "requested_follow_up": "duration",
  "routing_indicators": [],
  "content_module_request": null,
  "tool_request": null,
  "unsupported_clinical_claims": [],
  "language": "en",
  "confidence": 0.94,
  "model_version": "qwen-demo-v1",
  "prompt_version": "check-in-v1"
}

Malformed or invalid model output must never be displayed directly.

MODEL GATEWAY REQUIREMENTS

The ModelGateway must:

- redact unnecessary personal information;
- enforce strict output schemas;
- attach model and prompt versions;
- limit tool access;
- log metadata without raw sensitive content;
- support deterministic safe fallback;
- support future provider changes;
- enforce timeout and retry limits;
- prevent direct database administration;
- prevent direct consent changes;
- prevent direct care-plan modifications;
- prevent direct clinician impersonation;
- prevent unapproved external actions.

SAFETY RULES

The system must reject, safely redirect or escalate requests involving:

- diagnosis;
- condition confirmation;
- medication recommendations;
- medication stopping;
- medication dosage changes;
- claims that Manas is a psychologist;
- claims that Manas is a psychiatrist;
- claims that Manas is a particular clinician;
- requests to modify an active care plan without approval;
- attempts to share user data without consent;
- attempts to access another user’s data;
- requests for retired or suspended content;
- unapproved clinician impersonation;
- attempts to make AI-generated content appear clinically reviewed;
- attempts to bypass audit controls.

The prototype must clearly state:

“Manas is not an emergency service.”

Use synthetic scenarios only.

Do not implement a real emergency response operation.

The URGENT_SUPPORT_INFORMATION state may display fictional or clearly
labelled demonstration resources.

PRIVACY REQUIREMENTS

- Guest and connected-care modes must be separate.
- Login is not consent to memory.
- Login is not consent to clinician sharing.
- Login is not consent to research.
- No training on private conversations by default.
- The user may view remembered information.
- The user may edit remembered information.
- The user may delete remembered information.
- The user may pause memory.
- The user may exclude individual entries from a handoff.
- The user may revoke consent.
- The clinician sees only user-approved information.
- Raw conversations must not appear in ordinary analytics or logs.
- Deletion must remove associated embeddings and derived data where
  applicable.
- Row-level security must prevent cross-user access.
- Administrative access must create an audit event.
- Model-evaluation datasets must remain separate from user records.
- Synthetic data must be used for the hackathon.

PROTOTYPE CONTENT MODULES

Create exactly three demonstration modules:

1. Pause and Reflect

   Purpose:
   Help a user organise what happened, what they noticed and what small
   next step they may consider.

2. Prepare for a Professional Conversation

   Purpose:
   Help the user identify concerns, examples, previous attempts and
   questions for a qualified professional.

3. Session Preparation Summary

   Purpose:
   Help the user organise user-approved information before an
   appointment.

Each module must be:

- general wellbeing only;
- clearly labelled as unreviewed prototype content;
- versioned;
- structured;
- available in English;
- available in draft Hindi/Hinglish;
- backed by unit tests;
- backed by safety tests;
- excluded from diagnosis;
- excluded from treatment;
- excluded from urgent support.

USER INTERFACE

Required user-facing screens:

1. Landing page
2. Product disclosure
3. Mode selection
4. Language selection
5. Check-in
6. Editable summary
7. Routing result
8. Prototype module
9. Professional directory
10. Professional profile
11. Handoff editor
12. Consent confirmation
13. Care-Plan Twin
14. Care-plan version comparison
15. Progress timeline
16. Session preparation
17. Privacy centre
18. Memory management
19. User audit timeline
20. Data export
21. Account deletion
22. Unsafe-response report

Required clinician-facing screens:

23. Clinician dashboard
24. User-approved handoff
25. Care-plan editor
26. Care-plan approval
27. Version history
28. Assigned-module view
29. User-approved progress
30. AI-concern report

Required administrator screens:

31. Content compiler
32. Content review
33. Content-version comparison
34. Provider verification
35. Evaluation dashboard
36. Prompt and policy versions
37. Audit metadata
38. Suspended-content management

DESIGN PRINCIPLES

- Calm but not falsely clinical
- Warm but transparent
- No diagnosis labels
- No manipulative streaks
- No competitive wellbeing scores
- No gamification of distress
- No photorealistic psychologist avatar
- One clearly artificial Manas Guide
- Optional no-avatar text mode
- Persistent AI disclosure
- Accessible typography
- Strong colour contrast
- Clear consent before sharing
- User control before automation
- Explainability before personalisation
- Human care remains visible and available

DEMO DATA

Create:

User:
Ananya Sharma

Mock clinician:
Dr Maya Rao

Mock providers:
Three professional profiles

Demo care plans:

Care Plan Version 1
Care Plan Version 2 revision

Demo modules:

Pause and Reflect
Prepare for a Professional Conversation
Session Preparation Summary

Evaluation dataset:

Minimum 30 synthetic scenarios

Demo records:

- synthetic check-in history;
- synthetic handoff;
- synthetic care-plan versions;
- synthetic progress events;
- synthetic audit trail;
- synthetic clinician upload document.

API CONTRACTS

At minimum:

POST   /api/check-ins

POST   /api/check-ins/{id}/messages

POST   /api/check-ins/{id}/complete

GET    /api/content/modules

POST   /api/content/compile

POST   /api/content/{id}/submit-review

POST   /api/content/{id}/request-changes

POST   /api/content/{id}/approve

POST   /api/content/{id}/suspend

GET    /api/providers

GET    /api/providers/{id}

POST   /api/handoffs

POST   /api/handoffs/{id}/review

POST   /api/handoffs/{id}/consent

POST   /api/handoffs/{id}/send

GET    /api/care-plans/current

POST   /api/care-plans

POST   /api/care-plans/{id}/approve

POST   /api/care-plans/{id}/accept

POST   /api/care-plans/{id}/pause

POST   /api/care-plans/{id}/revise

GET    /api/audit/me

GET    /api/privacy/memory

PATCH  /api/privacy/memory/{id}

DELETE /api/privacy/memory/{id}

POST   /api/privacy/export

POST   /api/privacy/revoke-consent

DELETE /api/account

POST   /api/reports/unsafe-response

ACCEPTANCE CRITERIA

The MVP is accepted only when:

1. A seeded user completes the entire primary demo journey.

2. The check-in works in English.

3. The check-in works in Hindi/Hinglish demo mode.

4. All AI output is schema-validated.

5. Invalid model output triggers a safe deterministic fallback.

6. Diagnosis requests are blocked.

7. Medication requests are blocked or safely redirected.

8. The AI never claims to be a clinician.

9. Unapproved content is prominently labelled.

10. An unapproved module cannot be presented as clinically reviewed.

11. A care plan cannot activate without clinician approval.

12. A handoff cannot be sent without explicit user consent.

13. A Version 2 care plan does not overwrite Version 1.

14. Clinician and user actions appear in the audit timeline.

15. Model, prompt, policy, content and plan versions are recorded.

16. Cross-user database access tests fail safely.

17. Data-deletion tests remove associated demonstration records.

18. Care-plan state transitions are enforced.

19. Content-review state transitions are enforced.

20. Handoff state transitions are enforced.

21. All unit tests pass.

22. All integration tests pass.

23. All end-to-end tests pass.

24. The application builds cleanly.

25. The deployed demonstration works in a fresh browser.

26. No real personal or clinical information is present.

27. README accurately states product limitations.

28. No clinical-validation claim appears anywhere.

29. No regulatory-approval claim appears anywhere.

30. No real psychologist’s identity, voice or likeness is used without
    written permission.

QODER EVIDENCE REQUIREMENTS

Create:

docs/qoder-workflow.md

The document must include:

- original project request;
- approved Qoder Spec;
- requirement clarifications;
- task decomposition;
- Experts Mode roles;
- Worktree usage;
- major Qoder-generated components;
- Qoder-generated tests;
- defects identified;
- defects corrected;
- clinician-content compiler workflow;
- safety findings;
- privacy findings;
- final release review;
- known limitations.

Create a reusable Qoder workflow:

“Given a clinician care-module document:

1. Extract a structured draft.
2. Identify missing intended-use information.
3. Identify missing excluded-use information.
4. Identify missing contraindications.
5. Identify missing escalation conditions.
6. Generate multilingual fixtures.
7. Generate unit tests.
8. Generate safety scenarios.
9. Generate review-UI configuration.
10. Record the source and version.

Never mark the content clinically approved.”

EXPERT TEAM

Use these expert perspectives:

1. Product and UX Expert
2. Frontend Expert
3. Backend and Data Expert
4. AI Orchestration Expert
5. Safety and Policy Expert
6. Privacy and Security Expert
7. Multilingual Evaluation Expert
8. QA and Evaluation Expert
9. Code Review Expert
10. DevOps and Release Expert

DELIVERABLES

- Working responsive web application
- Seeded demonstration environment
- Source repository
- Architecture document
- Threat model
- Data model
- API specification
- Evaluation report
- Test report
- Qoder workflow report
- README
- Deployment instructions
- Known-limitations document
- Post-hackathon clinical-review roadmap
- Two-to-three-minute demo script
- LinkedIn or X post draft
- Screenshots
- Architecture diagram
- Qoder evidence section

TASK PRIORITY

P0 — MUST COMPLETE

- landing and disclosure;
- language selector;
- structured check-in;
- editable summary;
- routing;
- one prototype module;
- professional matching;
- handoff editor;
- consent-controlled handoff;
- clinician care-plan creation;
- immutable care-plan versions;
- user acceptance;
- audit timeline;
- basic privacy controls;
- tests;
- deployed demonstration.

P1 — COMPLETE IF P0 IS STABLE

- clinician content compiler;
- full Hindi/Hinglish refinement;
- content-review workflow;
- memory-management screen;
- evaluation dashboard;
- care-plan comparison;
- unsafe-response report.

P2 — POST-HACKATHON OR STRETCH

- additional languages;
- voice interaction;
- audio exercises;
- advanced animations;
- appointment integrations;
- real provider onboarding;
- advanced analytics;
- insurer or employer integrations;
- clinical-system interoperability.

INSTRUCTION TO QODER

First generate a complete Spec containing:

- clarified product requirements;
- user stories;
- architecture;
- module boundaries;
- database schema;
- API contracts;
- state machines;
- task breakdown;
- acceptance criteria;
- test strategy;
- privacy review;
- security review;
- AI-safety review;
- multilingual-evaluation plan;
- deployment plan;
- schedule through 5 August 2026;
- hackathon judging-criteria mapping.

Identify any feature that is:

- unsafe;
- unnecessary;
- ambiguous;
- unsupported by the current team;
- unlikely to be completed before the deadline;
- dependent on unavailable clinical approval.

Do not implement until the Spec has been reviewed and explicitly approved.