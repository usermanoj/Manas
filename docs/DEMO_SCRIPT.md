# Manas Demo Script

**Duration**: 2-3 minutes
**Audience**: Alibaba Cloud x Qoder Hackathon judges

## Pre-Demo Setup
- Open http://localhost:3000 (or deployed URL) in a fresh browser
- Ensure mock AI provider is active (default)
- No API keys needed

## Demo Walkthrough

### 1. Landing Page (15 seconds)
**Action**: Show the landing page
**Say**: "Manas is an AI wellbeing companion for adults experiencing work-related stress. Notice the persistent AI disclosure at the top — it clearly states Manas is not a clinician. The hackathon disclaimer confirms this is synthetic demonstration data."

### 2. Check-In Flow (30 seconds)
**Action**: Click "Begin Check-In", complete 6 turns:
- Primary concern: "I've been feeling overwhelmed at work for the past few weeks"
- Duration: "weeks"
- Sleep impact: "significant"
- Daily functioning: "moderate"
- Support preference: "professional_support"
- Safety: "yes" (feels safe)

**Say**: "The check-in is a bounded 6-turn conversation. The AI extracts structured information while the user types naturally. If the API is unavailable, a deterministic form fallback provides the same output."

### 3. Summary & Routing (15 seconds)
**Action**: Show the draft summary, edit a field, confirm
**Say**: "The user reviews and edits their structured summary before confirmation. The final routing is deterministic — no machine learning. Based on significant sleep impact and moderate functioning impact, Manas suggests professional support."

### 4. Wellbeing Module (10 seconds)
**Action**: Navigate to "Pause and Reflect" module
**Say**: "This prototype module is labelled 'not clinically reviewed'. AI created it as a draft — it can never approve content."

### 5. Professionals & Handoff (20 seconds)
**Action**: Show professionals directory, create handoff, show consent flow
**Say**: "All professional profiles are fictional demo profiles. The handoff is editable — the user controls what's shared. Sending requires explicit consent. Without the checkbox, the send button is disabled."

### 6. Clinician Workspace (20 seconds)
**Action**: Navigate to /clinician, show inbox, open care-plan workspace
**Say**: "The clinician sees only handoffs that were sent with consent. They can create a care plan with goals, modules, and check-in frequency. The care plan requires clinician approval AND user acceptance before it becomes active."

### 7. Care Plan Versioning (15 seconds)
**Action**: Show V1/V2 side-by-side comparison on /care-plan
**Say**: "Care plans are immutably versioned. When the clinician revises an active plan to V2, V1 is preserved as SUPERSEDED — never overwritten. Both versions are visible to the user."

### 8. Content Compiler (15 seconds)
**Action**: Navigate to /clinician/content, paste sample text, compile
**Say**: "The content compiler lets clinicians paste wellbeing text and extract a structured module draft. AI may create drafts but never approve them — only a human reviewer can approve content."

### 9. Audit & Privacy (10 seconds)
**Action**: Navigate to /privacy, show audit timeline
**Say**: "Every action is recorded in an append-only audit log. The privacy page shows the complete timeline, consent status, and stored summaries — all with the option to delete."

## Key Differentiators (closing, 15 seconds)
**Say**: "Manas demonstrates three key innovations: consent-first professional handoff, immutable care-plan versioning with clinician governance, and deterministic safety routing that's completely separate from the AI model. It's not just another chatbot — it's a care navigation prototype with built-in governance."
