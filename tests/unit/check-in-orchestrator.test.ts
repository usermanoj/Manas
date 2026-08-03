import { describe, it, expect, beforeEach } from 'vitest';
import { CheckInOrchestrator } from '@/domain/check-in';
import type { CheckInOrchestratorDeps } from '@/domain/check-in';
import { MockModelGateway, FallbackModelGateway } from '@/domain/ai';
import type { StructuredCheckIn } from '@/domain/ai';
import { InMemoryRepository } from '@/domain/repositories';
import type { CheckInSession, SafetyAssessment } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDeps(): CheckInOrchestratorDeps {
  return {
    modelGateway: new MockModelGateway(),
    fallbackGateway: new FallbackModelGateway(),
    sessionRepo: new InMemoryRepository<CheckInSession>(),
    safetyAssessmentRepo: new InMemoryRepository<SafetyAssessment>(),
    auditLogger: new InMemoryAuditLogger(),
  };
}

const FULL_ANSWERS: StructuredCheckIn = {
  primary_concern: 'Work stress and deadlines',
  concern_duration: 'weeks',
  sleep_impact: 'mild',
  daily_functioning_impact: 'mild',
  support_preference: 'general_reflection',
  feels_safe: 'yes',
  key_points: ['feeling overwhelmed', 'managing deadlines'],
};

// ---------------------------------------------------------------------------
// 1. Session lifecycle
// ---------------------------------------------------------------------------
describe('CheckInOrchestrator — Session lifecycle', () => {
  let deps: CheckInOrchestratorDeps;
  let orchestrator: CheckInOrchestrator;

  beforeEach(() => {
    deps = createDeps();
    orchestrator = new CheckInOrchestrator(deps);
  });

  it('createSession returns a session with INITIATED status', async () => {
    const session = await orchestrator.createSession('GUEST', 'en');

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(typeof session.id).toBe('string');
    expect(session.status).toBe('INITIATED');
    expect(session.mode).toBe('GUEST');
    expect(session.language).toBe('en');
    expect(session.startedAt).toBeInstanceOf(Date);

    // Persisted in repo
    const stored = await deps.sessionRepo.findById(session.id);
    expect(stored).not.toBeNull();
    expect(stored!.status).toBe('INITIATED');

    // Audit event emitted
    const events = await deps.auditLogger.findAll({ eventType: 'CHECK_IN_STARTED' });
    expect(events.length).toBe(1);
    expect(events[0].details).toHaveProperty('sessionId', session.id);
  });

  it('createSession with CONNECTED_CARE mode', async () => {
    const session = await orchestrator.createSession('CONNECTED_CARE', 'en');
    expect(session.mode).toBe('CONNECTED_CARE');
    expect(session.userId).toBe('connected');
  });
});

// ---------------------------------------------------------------------------
// 2. Step handling
// ---------------------------------------------------------------------------
describe('CheckInOrchestrator — handleStep', () => {
  let deps: CheckInOrchestratorDeps;
  let orchestrator: CheckInOrchestrator;
  let sessionId: string;

  beforeEach(async () => {
    deps = createDeps();
    orchestrator = new CheckInOrchestrator(deps);
    const session = await orchestrator.createSession('GUEST', 'en');
    sessionId = session.id;
  });

  it('primary_concern returns AI-generated response', async () => {
    const result = await orchestrator.handleStep(
      sessionId,
      'primary_concern',
      'I am feeling stressed about work deadlines',
      {},
    );

    expect(result).toBeDefined();
    expect(result.userFacingResponse).toBeDefined();
    expect(typeof result.userFacingResponse).toBe('string');
    expect(result.userFacingResponse.length).toBeGreaterThan(0);
    expect(result.currentStep).toBe('primary_concern');
    expect(result.isComplete).toBe(false);
    expect(result.modelVersion).toBe('mock-v1');
    expect(result.promptVersion).toBe('prompt-v1');
    expect(result.fallbackUsed).toBe(false);
  });

  it('primary_concern with blocked input returns safety message', async () => {
    const result = await orchestrator.handleStep(
      sessionId,
      'primary_concern',
      'diagnose my condition',
      {},
    );

    expect(result.userFacingResponse).toMatch(/can't provide diagnoses/i);
    expect(result.currentStep).toBe('primary_concern');
    expect(result.isComplete).toBe(false);
  });

  it('duration returns deterministic acknowledgment', async () => {
    // First advance past primary_concern
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});

    const result = await orchestrator.handleStep(
      sessionId,
      'duration',
      'weeks',
      { primary_concern: 'Work stress' },
    );

    expect(result).toBeDefined();
    expect(result.currentStep).toBe('duration');
    expect(result.userFacingResponse).toMatch(/got it/i);
    expect(result.isComplete).toBe(false);
    expect(result.fallbackUsed).toBe(false);
  });

  it('sleep_impact returns deterministic acknowledgment', async () => {
    // Must first advance past primary_concern to transition INITIATED → IN_PROGRESS
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});

    const result = await orchestrator.handleStep(
      sessionId,
      'sleep_impact',
      'mild',
      {},
    );

    expect(result.currentStep).toBe('sleep_impact');
    expect(result.userFacingResponse).toBeDefined();
    expect(result.isComplete).toBe(false);
  });

  it('safety_response (last step) marks isComplete=true', async () => {
    // Must first advance past primary_concern to transition INITIATED → IN_PROGRESS
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});

    const result = await orchestrator.handleStep(
      sessionId,
      'safety_response',
      'yes',
      {},
    );

    expect(result.currentStep).toBe('safety_response');
    expect(result.isComplete).toBe(true);
  });

  it('rejects invalid step name', async () => {
    await expect(
      orchestrator.handleStep(sessionId, 'invalid_step', 'anything', {}),
    ).rejects.toThrow(/Invalid check-in step/);
  });

  it('accepts free text on non-primary steps and extracts structured fields', async () => {
    // Must first transition INITIATED → IN_PROGRESS
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});

    const result = await orchestrator.handleStep(
      sessionId,
      'duration',
      'It has been going on for a few weeks and affecting my sleep significantly',
      { primary_concern: 'Work stress' },
    );

    expect(result.currentStep).toBe('duration');
    expect(result.userFacingResponse).toBeDefined();
    expect(result.userFacingResponse.length).toBeGreaterThan(0);
    expect(result.extractedUpdates.concern_duration).toBe('weeks');
    expect(result.extractedUpdates.sleep_impact).toBe('significant');
    expect(Array.isArray(result.techniques)).toBe(true);
    expect(Array.isArray(result.inferredSymptoms)).toBe(true);
  });

  it('rejects primary_concern exceeding 1000 chars', async () => {
    const longInput = 'x'.repeat(1001);
    await expect(
      orchestrator.handleStep(sessionId, 'primary_concern', longInput, {}),
    ).rejects.toThrow(/1 and 1000/);
  });
});

// ---------------------------------------------------------------------------
// 3. Draft completion
// ---------------------------------------------------------------------------
describe('CheckInOrchestrator — completeSession', () => {
  let deps: CheckInOrchestratorDeps;
  let orchestrator: CheckInOrchestrator;
  let sessionId: string;

  beforeEach(async () => {
    deps = createDeps();
    orchestrator = new CheckInOrchestrator(deps);
    const session = await orchestrator.createSession('GUEST', 'en');
    sessionId = session.id;
    // Advance to IN_PROGRESS
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});
  });

  it('returns draft summary and provisional routing with full answers', async () => {
    const result = await orchestrator.completeSession(sessionId, FULL_ANSWERS);

    expect(result).toBeDefined();
    expect(result.draftSummary).toEqual(FULL_ANSWERS);
    expect(result.provisionalRouting).toBeDefined();
    expect(result.provisionalRouting.routingState).toBe('GENERAL_WELLBEING');
    expect(result.provisionalRouting.policyVersion).toBeDefined();
    expect(Array.isArray(result.provisionalRouting.triggeredRules)).toBe(true);
    expect(result.policyVersion).toBeDefined();
    expect(result.modelVersion).toBe('mock-v1');
    expect(result.promptVersion).toBe('prompt-v1');

    // Session transitioned to COMPLETED
    const session = await deps.sessionRepo.findById(sessionId);
    expect(session!.status).toBe('COMPLETED');
    expect(session!.completedAt).toBeInstanceOf(Date);

    // SUMMARY_GENERATED audit event
    const events = await deps.auditLogger.findAll({ eventType: 'SUMMARY_GENERATED' });
    expect(events.length).toBe(1);
  });

  it('routes to URGENT_SUPPORT_INFORMATION when feels_safe=no', async () => {
    const unsafeAnswers: StructuredCheckIn = {
      ...FULL_ANSWERS,
      feels_safe: 'no',
    };

    const result = await orchestrator.completeSession(sessionId, unsafeAnswers);

    expect(result.provisionalRouting.routingState).toBe('URGENT_SUPPORT_INFORMATION');
    expect(result.provisionalRouting.triggeredRules).toContain('safety_response_no');
  });

  it('routes to PROFESSIONAL_SUPPORT_SUGGESTED with elevated functioning impact', async () => {
    const elevatedAnswers: StructuredCheckIn = {
      ...FULL_ANSWERS,
      daily_functioning_impact: 'significant',
    };

    const result = await orchestrator.completeSession(sessionId, elevatedAnswers);

    expect(result.provisionalRouting.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
    expect(result.provisionalRouting.triggeredRules).toContain('functioning_impact_elevated');
  });
});

// ---------------------------------------------------------------------------
// 4. Confirm with edit detection
// ---------------------------------------------------------------------------
describe('CheckInOrchestrator — confirmSummary', () => {
  let deps: CheckInOrchestratorDeps;
  let orchestrator: CheckInOrchestrator;
  let sessionId: string;

  beforeEach(async () => {
    deps = createDeps();
    orchestrator = new CheckInOrchestrator(deps);
    const session = await orchestrator.createSession('GUEST', 'en');
    sessionId = session.id;
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});
    await orchestrator.completeSession(sessionId, FULL_ANSWERS);
  });

  it('confirms with no edits — edited=false, same routing', async () => {
    const result = await orchestrator.confirmSummary(sessionId, FULL_ANSWERS, FULL_ANSWERS);

    expect(result).toBeDefined();
    expect(result.confirmedSummary).toEqual(FULL_ANSWERS);
    expect(result.edited).toBe(false);
    expect(result.routingState).toBe('GENERAL_WELLBEING');
    expect(result.policyVersion).toBeDefined();
    expect(result.routingDecision).toBeDefined();
    expect(result.routingDecision.routingState).toBe('GENERAL_WELLBEING');

    // Session transitioned to SUMMARIZED
    const session = await deps.sessionRepo.findById(sessionId);
    expect(session!.status).toBe('SUMMARIZED');

    // SafetyAssessment persisted
    const assessments = await deps.safetyAssessmentRepo.findAll();
    expect(assessments.length).toBe(1);
    expect(assessments[0].sessionId).toBe(sessionId);
    expect(assessments[0].routingState).toBe('GENERAL_WELLBEING');

    // Audit events
    const confirmedEvents = await deps.auditLogger.findAll({ eventType: 'SUMMARY_CONFIRMED' });
    expect(confirmedEvents.length).toBe(1);
    const routedEvents = await deps.auditLogger.findAll({ eventType: 'ROUTING_DECIDED' });
    expect(routedEvents.length).toBe(1);
    // No SUMMARY_EDITED event
    const editedEvents = await deps.auditLogger.findAll({ eventType: 'SUMMARY_EDITED' });
    expect(editedEvents.length).toBe(0);
  });

  it('detects edits — edited=true, routing may change', async () => {
    const editedSummary: StructuredCheckIn = {
      ...FULL_ANSWERS,
      feels_safe: 'no',
      support_preference: 'professional_support',
    };

    const result = await orchestrator.confirmSummary(sessionId, editedSummary, FULL_ANSWERS);

    expect(result.edited).toBe(true);
    // Routing changed due to feels_safe=no
    expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
    expect(result.routingDecision.triggeredRules).toContain('safety_response_no');

    // SUMMARY_EDITED audit event
    const editedEvents = await deps.auditLogger.findAll({ eventType: 'SUMMARY_EDITED' });
    expect(editedEvents.length).toBe(1);

    // SafetyAssessment reflects final routing
    const assessments = await deps.safetyAssessmentRepo.findAll();
    expect(assessments.length).toBe(1);
    expect(assessments[0].routingState).toBe('URGENT_SUPPORT_INFORMATION');
  });

  it('confirms without draftSummary — edited defaults to false', async () => {
    const result = await orchestrator.confirmSummary(sessionId, FULL_ANSWERS);

    expect(result.edited).toBe(false);
    expect(result.confirmedSummary).toEqual(FULL_ANSWERS);
    // No SUMMARY_EDITED event
    const editedEvents = await deps.auditLogger.findAll({ eventType: 'SUMMARY_EDITED' });
    expect(editedEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. State machine enforcement — INITIATED requires primary_concern
// ---------------------------------------------------------------------------
describe('CheckInOrchestrator — INITIATED state enforcement', () => {
  let deps: CheckInOrchestratorDeps;
  let orchestrator: CheckInOrchestrator;
  let sessionId: string;

  beforeEach(async () => {
    deps = createDeps();
    orchestrator = new CheckInOrchestrator(deps);
    const session = await orchestrator.createSession('GUEST', 'en');
    sessionId = session.id;
  });

  it('rejects duration step when session is INITIATED', async () => {
    await expect(
      orchestrator.handleStep(sessionId, 'duration', 'weeks', {}),
    ).rejects.toThrow(/first step must be "primary_concern"/);
  });

  it('rejects sleep_impact step when session is INITIATED', async () => {
    await expect(
      orchestrator.handleStep(sessionId, 'sleep_impact', 'mild', {}),
    ).rejects.toThrow(/first step must be "primary_concern"/);
  });

  it('rejects safety_response step when session is INITIATED', async () => {
    await expect(
      orchestrator.handleStep(sessionId, 'safety_response', 'yes', {}),
    ).rejects.toThrow(/first step must be "primary_concern"/);
  });

  it('accepts any step after primary_concern transitions to IN_PROGRESS', async () => {
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});
    // Session is now IN_PROGRESS — any step is allowed
    const result = await orchestrator.handleStep(sessionId, 'duration', 'weeks', {});
    expect(result.currentStep).toBe('duration');
    expect(result.userFacingResponse).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. State machine enforcement — terminal session guards
// ---------------------------------------------------------------------------
describe('CheckInOrchestrator — terminal session guards', () => {
  let deps: CheckInOrchestratorDeps;
  let orchestrator: CheckInOrchestrator;
  let sessionId: string;

  beforeEach(async () => {
    deps = createDeps();
    orchestrator = new CheckInOrchestrator(deps);
    const session = await orchestrator.createSession('GUEST', 'en');
    sessionId = session.id;
    // Complete full flow to reach SUMMARIZED (terminal)
    await orchestrator.handleStep(sessionId, 'primary_concern', 'Work stress', {});
    await orchestrator.completeSession(sessionId, FULL_ANSWERS);
    await orchestrator.confirmSummary(sessionId, FULL_ANSWERS, FULL_ANSWERS);
  });

  it('handleStep rejects steps on SUMMARIZED session', async () => {
    await expect(
      orchestrator.handleStep(sessionId, 'primary_concern', 'New concern', {}),
    ).rejects.toThrow(/terminal status/);
  });

  it('confirmSummary rejects re-confirming a SUMMARIZED session', async () => {
    await expect(
      orchestrator.confirmSummary(sessionId, FULL_ANSWERS, FULL_ANSWERS),
    ).rejects.toThrow(/already been confirmed/);
  });

  it('confirmSummary does not create duplicate SafetyAssessment on re-confirm attempt', async () => {
    try {
      await orchestrator.confirmSummary(sessionId, FULL_ANSWERS, FULL_ANSWERS);
    } catch {
      // Expected to throw.
    }
    const assessments = await deps.safetyAssessmentRepo.findAll();
    // Only the original confirmation should have created one.
    expect(assessments.length).toBe(1);
  });
});
