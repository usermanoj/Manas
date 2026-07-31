# Manas Hackathon Prototype — Known Limitations

## Product status

Manas is a synthetic-data hackathon demonstration.

It is not intended for real mental-health support and does not provide:

- diagnosis;
- treatment;
- medication advice;
- emergency or crisis response;
- clinical assessment;
- a replacement for a psychologist, psychiatrist, counsellor, or other
  qualified professional.

All professional profiles are fictional demonstration profiles.

The “Pause and Reflect” module is prototype wellbeing content and has
not been clinically reviewed.

## AI limitations

- AI responses may be incomplete or incorrect.
- Qwen output is constrained through structured schemas and prototype
  deterministic safeguards.
- These safeguards are not clinically validated.
- The mock model and form fallback may be used when Qwen is unavailable.
- The system must not infer that a user feels safe; the user provides a
  direct structured response.
- The AI cannot approve content, grant consent, send a handoff without
  consent, or modify an active care plan.

## Language limitations

English is the mandatory working language for the hackathon.

Any Hindi or Hinglish demonstration is machine-generated or scripted,
is labelled PENDING_REVIEW, and has not been independently reviewed for
clinical or linguistic equivalence.

## Data limitations

- Only synthetic demonstration data is used.
- Raw check-in conversations are not persisted by default.
- The prototype stores only user-reviewed structured summaries and
  model, prompt, policy, consent, and care-plan version metadata.
- Production-grade data deletion, export, retention, and incident
  response workflows remain post-hackathon work.

## Professional and clinical limitations

- No real clinician-client relationship is created.
- No real appointments, payments, prescriptions, or clinical records
  are processed.
- The Care-Plan Twin demonstrates a versioned governance workflow; it is
  not a real treatment plan.
- No content is represented as clinically approved.

## Security and dependency status

Production dependencies are checked using:

```bash
npm audit --omit=dev
```

## Day 2 implementation status

The check-in vertical slice is functional:
Landing → Check-in → Draft Summary → User Edits → User Confirms → Final Deterministic Routing.

### Mock mode
The default AI provider is a deterministic mock that returns structured
responses without calling any external API. This is the recommended mode
for local development and automated testing.

### Stateless design
The check-in flow preserves user answers in browser sessionStorage.
API requests include the complete current answers, so the server does
not need to maintain session state across requests. The in-memory
repository is used only for local demonstration and testing.

### Provisional vs final routing
The draft summary screen shows provisional routing for information
only. The final routing result is calculated from the user-confirmed
summary after any edits.

### HUMAN_REVIEW_REQUIRED
This routing state is reserved for future use. The current prototype
does not produce this state and does not provide live human monitoring
or review.

### Form fallback
If the API is unavailable, a deterministic HTML form provides the same
six check-in questions and produces the same structured output.

### Input limits
Primary concern text is limited to 1–1000 characters.