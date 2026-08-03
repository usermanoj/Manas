import { describe, it, expect, beforeEach } from 'vitest';
import { CheckInOrchestrator } from '@/domain/check-in';
import { MockModelGateway } from '@/domain/ai';
import { FallbackModelGateway } from '@/domain/ai';
import { InMemoryRepository } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import type { CheckInSession, SafetyAssessment } from '@/domain/repositories';
import type { StructuredCheckIn } from '@/domain/ai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestOrchestrator() {
  const modelGateway = new MockModelGateway();
  const fallbackGateway = new FallbackModelGateway();
  const sessionRepo = new InMemoryRepository<CheckInSession>();
  const safetyAssessmentRepo = new InMemoryRepository<SafetyAssessment>();
  const auditLogger = new InMemoryAuditLogger();

  const orchestrator = new CheckInOrchestrator({
    modelGateway,
    fallbackGateway,
    sessionRepo,
    safetyAssessmentRepo,
    auditLogger,
  });

  return { orchestrator, sessionRepo, safetyAssessmentRepo, auditLogger };
}

/** Valid StructuredCheckIn that routes to GENERAL_WELLBEING (no rules triggered). */
const WELLBEING_ANSWERS: StructuredCheckIn = {
  primary_concern: 'Work stress',
  concern_duration: 'days',
  sleep_impact: 'none',
  daily_functioning_impact: 'none',
  support_preference: 'general_reflection',
  feels_safe: 'yes',
  key_points: ['Feeling stressed at work'],
};

/** Steps 2–6 with their valid enum values. */
const STEPS_2_TO_6 = [
  { step: 'duration', value: 'days' },
  { step: 'sleep_impact', value: 'none' },
  { step: 'daily_functioning_impact', value: 'none' },
  { step: 'support_preference', value: 'general_reflection' },
  { step: 'safety_response', value: 'yes' },
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Check-in Integration Flow', () => {
  let ctx: ReturnType<typeof createTestOrchestrator>;

  beforeEach(() => {
    ctx = createTestOrchestrator();
  });

  // -------------------------------------------------------------------------
  // 1. Full happy path
  // -------------------------------------------------------------------------
  describe('full happy path', () => {
    it('should complete the full create → message → complete → confirm flow', async () => {
      const { orchestrator, sessionRepo, safetyAssessmentRepo, auditLogger } = ctx;

      // ── Create session ──────────────────────────────────────────────
      const session = await orchestrator.createSession('GUEST', 'en');
      expect(session.status).toBe('INITIATED');
      expect(session.mode).toBe('GUEST');
      expect(session.userId).toBe('guest');

      // ── Step 1: primary_concern (AI-powered) ────────────────────────
      const step1 = await orchestrator.handleStep(
        session.id,
        'primary_concern',
        'I have been feeling stressed at work lately',
        {},
      );
      expect(step1.userFacingResponse).toBeTruthy();
      expect(typeof step1.userFacingResponse).toBe('string');
      expect(step1.currentStep).toBe('primary_concern');
      expect(step1.isComplete).toBe(false);
      expect(step1.fallbackUsed).toBe(false);
      expect(step1.modelVersion).toBe('mock-v1');

      // Session should now be IN_PROGRESS
      const afterStep1 = await sessionRepo.findById(session.id);
      expect(afterStep1?.status).toBe('IN_PROGRESS');

      // ── Steps 2–6: deterministic enum validation ─────────────────
      let accumulatedAnswers: Record<string, unknown> = { primary_concern: 'I have been feeling stressed at work lately' };
      for (const { step, value } of STEPS_2_TO_6) {
        const result = await orchestrator.handleStep(
          session.id,
          step,
          value,
          accumulatedAnswers as Partial<StructuredCheckIn>,
        );
        expect(result.userFacingResponse).toBeTruthy();
        expect(result.currentStep).toBe(step);
        accumulatedAnswers = { ...accumulatedAnswers, ...result.extractedUpdates };
      }

      // Last step should signal isComplete
      const lastStepResult = await orchestrator.handleStep(
        session.id,
        'safety_response',
        'yes',
        accumulatedAnswers as Partial<StructuredCheckIn>,
      );
      expect(lastStepResult.isComplete).toBe(true);

      // ── Complete session ────────────────────────────────────────────
      const completeResult = await orchestrator.completeSession(session.id, WELLBEING_ANSWERS);
      expect(completeResult.draftSummary).toEqual(WELLBEING_ANSWERS);
      expect(completeResult.provisionalRouting.routingState).toBe('GENERAL_WELLBEING');
      expect(completeResult.provisionalRouting.triggeredRules).toEqual([]);
      expect(completeResult.policyVersion).toBe('safety-v1');

      // Session should now be COMPLETED
      const afterComplete = await sessionRepo.findById(session.id);
      expect(afterComplete?.status).toBe('COMPLETED');

      // ── Confirm summary (no edits) ─────────────────────────────────
      const confirmResult = await orchestrator.confirmSummary(
        session.id,
        WELLBEING_ANSWERS,
        WELLBEING_ANSWERS, // draftSummary — same as confirmed → edited = false
      );
      expect(confirmResult.edited).toBe(false);
      expect(confirmResult.routingState).toBe('GENERAL_WELLBEING');
      expect(confirmResult.routingDecision.triggeredRules).toEqual([]);
      expect(confirmResult.confirmedSummary).toEqual(WELLBEING_ANSWERS);

      // Session should now be SUMMARIZED (terminal)
      const finalSession = await sessionRepo.findById(session.id);
      expect(finalSession?.status).toBe('SUMMARIZED');

      // SafetyAssessment should be persisted
      const assessments = await safetyAssessmentRepo.findAll();
      expect(assessments.length).toBe(1);
      expect(assessments[0].routingState).toBe('GENERAL_WELLBEING');

      // ── Verify audit events ─────────────────────────────────────────
      const allEvents = await auditLogger.findAll();
      const eventTypes = allEvents.map((e) => e.eventType);

      expect(eventTypes).toContain('CHECK_IN_STARTED');
      expect(eventTypes).toContain('SUMMARY_GENERATED');
      expect(eventTypes).toContain('SUMMARY_CONFIRMED');
      expect(eventTypes).toContain('ROUTING_DECIDED');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Invalid payload handling
  // -------------------------------------------------------------------------
  describe('invalid payload handling', () => {
    it('should reject an invalid step name', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');

      await expect(
        orchestrator.handleStep(session.id, 'invalid_step', 'hello', {}),
      ).rejects.toThrow(/Invalid check-in step/);
    });

    it('should reject an empty primary_concern', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');

      await expect(
        orchestrator.handleStep(session.id, 'primary_concern', '', {}),
      ).rejects.toThrow(/between 1 and 1000 characters/);
    });

    it('should reject primary_concern exceeding 1000 characters', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');

      const tooLong = 'a'.repeat(1001);
      await expect(
        orchestrator.handleStep(session.id, 'primary_concern', tooLong, {}),
      ).rejects.toThrow(/between 1 and 1000 characters/);
    });

    it('should accept free text on duration step and extract structured answers', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');
      // Must first transition INITIATED → IN_PROGRESS
      await orchestrator.handleStep(session.id, 'primary_concern', 'Work stress', {});

      const result = await orchestrator.handleStep(
        session.id,
        'duration',
        'This has been building for a few weeks and my sleep is mildly affected',
        {},
      );

      expect(result.userFacingResponse).toBeTruthy();
      expect(result.extractedUpdates.concern_duration).toBe('weeks');
      expect(result.extractedUpdates.sleep_impact).toBe('mild');
    });

    it('should accept free text on sleep_impact step and keep session in progress', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');
      // Must first transition INITIATED → IN_PROGRESS
      await orchestrator.handleStep(session.id, 'primary_concern', 'Work stress', {});

      const result = await orchestrator.handleStep(
        session.id,
        'sleep_impact',
        'I wake up a few times each night and feel tired during the day',
        {},
      );

      expect(result.userFacingResponse).toBeTruthy();
      expect(result.isComplete).toBe(false);
    });

    it('should handle incomplete structured answers when completing session', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');

      // Bypass TypeScript checks — simulating broken client input
      const incomplete = {} as StructuredCheckIn;
      const result = await orchestrator.completeSession(session.id, incomplete);

      // With no fields set, no routing rules fire → GENERAL_WELLBEING
      expect(result.provisionalRouting.routingState).toBe('GENERAL_WELLBEING');
      expect(result.provisionalRouting.triggeredRules).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Re-routing after user edits
  // -------------------------------------------------------------------------
  describe('re-routing after user edits', () => {
    it('should produce different routing when user edits sleep and duration to elevated values', async () => {
      const { orchestrator, auditLogger } = ctx;

      // ── Create session and complete all steps ────────────────────────
      const session = await orchestrator.createSession('GUEST', 'en');

      await orchestrator.handleStep(
        session.id,
        'primary_concern',
        'Work stress',
        {},
      );

      for (const { step, value } of STEPS_2_TO_6) {
        await orchestrator.handleStep(session.id, step, value, {});
      }

      // ── Complete with GENERAL_WELLBEING answers ─────────────────────
      const completeResult = await orchestrator.completeSession(
        session.id,
        WELLBEING_ANSWERS,
      );
      expect(completeResult.provisionalRouting.routingState).toBe('GENERAL_WELLBEING');

      // ── Confirm with edited summary ─────────────────────────────────
      const editedSummary: StructuredCheckIn = {
        ...WELLBEING_ANSWERS,
        sleep_impact: 'severe',
        concern_duration: 'months',
      };

      const confirmResult = await orchestrator.confirmSummary(
        session.id,
        editedSummary,
        WELLBEING_ANSWERS, // original draft for comparison
      );

      // Edited flag should be true
      expect(confirmResult.edited).toBe(true);

      // Routing should change to PROFESSIONAL_SUPPORT_SUGGESTED
      // (sleep_duration_compound rule: severe sleep + months duration)
      expect(confirmResult.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(confirmResult.routingDecision.triggeredRules).toContain('sleep_duration_compound');

      // SUMMARY_EDITED audit event should be present
      const allEvents = await auditLogger.findAll();
      const eventTypes = allEvents.map((e) => e.eventType);
      expect(eventTypes).toContain('SUMMARY_EDITED');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Safety block during check-in
  // -------------------------------------------------------------------------
  describe('safety block during check-in', () => {
    it('should block diagnosis request but allow the session to continue', async () => {
      const { orchestrator, auditLogger } = ctx;

      // ── Create session ──────────────────────────────────────────────
      const session = await orchestrator.createSession('GUEST', 'en');

      // ── Step 1: trigger diagnosis BLOCK ─────────────────────────────
      const step1 = await orchestrator.handleStep(
        session.id,
        'primary_concern',
        'Can you diagnose my anxiety?',
        {},
      );

      // Should return the safety block message
      expect(step1.userFacingResponse).toContain("can't provide diagnoses");
      expect(step1.isComplete).toBe(false);

      // SAFEGUARD_TRIGGERED audit event should be logged
      const safeguardEvents = await auditLogger.findAll({ eventType: 'SAFEGUARD_TRIGGERED' });
      expect(safeguardEvents.length).toBeGreaterThanOrEqual(1);
      expect(safeguardEvents[0].details).toMatchObject({
        step: 'primary_concern',
        action: 'BLOCK',
      });

      // ── Session continues: proceed with remaining steps ─────────────
      for (const { step, value } of STEPS_2_TO_6) {
        const result = await orchestrator.handleStep(session.id, step, value, {});
        expect(result.userFacingResponse).toBeTruthy();
      }

      // ── Complete and confirm the session ────────────────────────────
      const completeResult = await orchestrator.completeSession(session.id, WELLBEING_ANSWERS);
      expect(completeResult.draftSummary).toEqual(WELLBEING_ANSWERS);

      const confirmResult = await orchestrator.confirmSummary(
        session.id,
        WELLBEING_ANSWERS,
        WELLBEING_ANSWERS,
      );
      expect(confirmResult.routingState).toBe('GENERAL_WELLBEING');
      expect(confirmResult.edited).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Proactive companion v2 features
  // -------------------------------------------------------------------------
  describe('proactive companion features', () => {
    it('should return archetypes, techniques, and citations on primary_concern', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');

      const result = await orchestrator.handleStep(
        session.id,
        'primary_concern',
        'I feel anxious and my heart races before work meetings',
        {},
      );

      expect(result.primaryArchetype).toBe('anxiety');
      expect(result.archetypes).toContain('anxiety');
      expect(result.techniques.length).toBeGreaterThan(0);
      expect(result.techniques[0]).toHaveProperty('id');
      expect(result.techniques[0]).toHaveProperty('citations');
      expect(result.followUpQuestions.length).toBeGreaterThan(0);
      expect(result.isComplete).toBe(false);
    });

    it('should infer symptoms from free text and mark completion when all fields are captured', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');

      await orchestrator.handleStep(
        session.id,
        'primary_concern',
        'I have been feeling really stressed at work',
        {},
      );

      const result = await orchestrator.handleStep(
        session.id,
        'primary_concern',
        'It has been going on for weeks. I cannot sleep well, I have poor focus, and I prefer self-reflection exercises. I feel safe.',
        { primary_concern: 'I have been feeling really stressed at work' },
      );

      expect(result.extractedUpdates.concern_duration).toBe('weeks');
      expect(result.extractedUpdates.sleep_impact).toBeDefined();
      expect(result.extractedUpdates.daily_functioning_impact).toBeDefined();
      expect(result.extractedUpdates.support_preference).toBe('general_reflection');
      expect(result.extractedUpdates.feels_safe).toBe('yes');
      expect(result.inferredSymptoms.length).toBeGreaterThan(0);
      expect(result.isComplete).toBe(true);
    });

    it('should surface a safety flag for crisis language', async () => {
      const { orchestrator } = ctx;
      const session = await orchestrator.createSession('GUEST', 'en');

      const result = await orchestrator.handleStep(
        session.id,
        'primary_concern',
        'I want to end my life',
        {},
      );

      expect(result.safetyFlag).toBe(true);
      expect(result.safetyMessage).toBeTruthy();
      expect(result.isComplete).toBe(false);
    });
  });
});
