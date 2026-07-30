# Manas Engineering Rules

## Product boundary

- Manas is an adult general-wellbeing and care-navigation prototype.
- The initial demonstration is for adults aged 18 or above experiencing everyday work-related stress.
- Never claim that Manas diagnoses, treats, prescribes, provides emergency care, or is clinically validated.
- Never represent Manas as a psychologist, psychiatrist, counsellor, doctor, or human clinician.
- Never use real patient data.
- Never use a real clinician's name, photograph, face, voice, likeness, or professional authority without written permission.
- The digital twin represents the user's versioned care plan, not the identity or personality of a clinician.

## AI responsibilities

AI may:

- conduct a bounded conversational check-in;
- extract structured information;
- translate approved or prototype content;
- summarise user-approved information;
- retrieve reviewed or clearly labelled prototype modules;
- prepare a draft handoff or session summary.

AI must not:

- diagnose a condition;
- recommend or change medication;
- alter an active care plan;
- grant or revoke consent;
- share information without explicit consent;
- mark content clinically approved;
- impersonate a clinician;
- access another user's information;
- perform unrestricted health-related web searches.

## Safety

- Safety routing must remain separate from the conversational model.
- Use deterministic policies and explicit state machines for safety, consent, handoff, content review, and care-plan approval.
- Validate the user's emotion without affirming dangerous beliefs or harmful actions.
- The prototype must clearly state that it is not an emergency service.
- Use synthetic safety scenarios only.
- Do not create a fake live crisis-response service.

## Content governance

- Every wellbeing module must have a status and immutable version.
- Supported statuses are:
  - DRAFT
  - PENDING_CLINICAL_REVIEW
  - CHANGES_REQUESTED
  - APPROVED
  - SUSPENDED
  - RETIRED
- AI may create a draft module but must never approve it.
- Unreviewed content must display:
  “Prototype wellbeing content — not clinically reviewed. This does not provide diagnosis, treatment, or emergency support.”
- Only a human reviewer may approve or suspend content.

## Care-plan governance

- Every care-plan change creates a new immutable version.
- An active care plan requires clinician approval and user acceptance.
- AI cannot directly modify an active care plan.
- Version 2 must not overwrite Version 1.
- Every approval, acceptance, pause, revision, or retirement must create an audit event.

## Consent and privacy

- Login is not consent to memory, sharing, or research.
- Professional handoff requires explicit, current user consent.
- Clinicians see only information the user has approved for sharing.
- Users may view, edit, exclude, export, or delete remembered information.
- Do not use private conversations for model training by default.
- Do not write raw conversations into application analytics or ordinary logs.
- Row-level security must prevent cross-user access.
- Administrative access must create an audit event.

## Engineering standards

- Use TypeScript strict mode.
- Use a TypeScript-first modular monolith.
- Keep domain logic separate from UI, database, and model-provider code.
- Validate every AI response with a strict Zod schema.
- Never display malformed model output directly to a user.
- Keep model API keys and secrets out of browser code and source control.
- Use explicit state machines rather than loosely related Boolean fields.
- Write unit tests for policies, calculations, and state transitions.
- Write contract tests for APIs.
- Write row-level-security tests.
- Maintain one reliable Playwright end-to-end demonstration.
- Keep changes small, focused, and reviewable.
- Do not introduce microservices unless explicitly approved.
- Run lint, type checking, tests, and production build before declaring a task complete.

## Hackathon scope protection

P0 must remain focused on:

1. Landing page and AI disclosure
2. Adult English work-stress check-in
3. Schema-validated AI output
4. Editable structured summary
5. Deterministic non-diagnostic routing
6. One labelled prototype wellbeing module
7. Two mock professional profiles
8. Editable consent-controlled handoff
9. Mock clinician portal
10. Immutable Care Plan Version 1 and Version 2
11. Audit timeline
12. Minimal privacy and memory controls
13. Pasted-text clinician content compiler
14. Synthetic demonstration data
15. Tests and deployed responsive web demo

Do not add during P0:

- native mobile applications;
- payments;
- real clinician appointments;
- employer or insurer integration;
- EHR integration;
- real crisis operations;
- real patient data;
- clinician voice or face cloning;
- diagnosis, treatment, or medication features;
- autonomous self-learning agents.