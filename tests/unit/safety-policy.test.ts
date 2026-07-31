import { describe, it, expect } from 'vitest';
import { checkPreGenSafety, checkPostGenSafety } from '@/domain/safety';

// ---------------------------------------------------------------------------
// Pre-Generation Safety Policy
// ---------------------------------------------------------------------------
describe('checkPreGenSafety', () => {
  describe('diagnosis request blocked', () => {
    const diagnosisCases = [
      { input: 'Can you diagnose me with anxiety?', expectedRule: 'diagnosis_request' },
      { input: 'What condition do I have?', expectedRule: 'diagnosis_request' },
      { input: 'Do I have depression?', expectedRule: 'diagnosis_request' },
      { input: 'Am I suffering from PTSD?', expectedRule: 'diagnosis_request' },
    ] as const;

    it.each(diagnosisCases)(
      'should BLOCK "$input" with rule $expectedRule',
      ({ input, expectedRule }) => {
        const result = checkPreGenSafety(input);
        expect(result.action).toBe('BLOCK');
        expect(result.ruleName).toBe(expectedRule);
        expect(result.userFacingMessage).toBeDefined();
      },
    );
  });

  describe('medication request blocked', () => {
    const medicationCases = [
      { input: 'Should I take ibuprofen for my headaches?', expectedRule: 'medication_advice' },
      { input: 'Can you prescribe something for sleep?', expectedRule: 'medication_advice' },
      { input: 'What dosage should I take?', expectedRule: 'medication_advice' },
    ] as const;

    it.each(medicationCases)(
      'should BLOCK "$input" with rule $expectedRule',
      ({ input, expectedRule }) => {
        const result = checkPreGenSafety(input);
        expect(result.action).toBe('BLOCK');
        expect(result.ruleName).toBe(expectedRule);
      },
    );
  });

  describe('clinician impersonation blocked', () => {
    const impersonationCases = [
      { input: 'Are you a doctor?', expectedRule: 'clinician_impersonation' },
      { input: 'Are you a psychologist?', expectedRule: 'clinician_impersonation' },
      { input: 'Are you a therapist?', expectedRule: 'clinician_impersonation' },
    ] as const;

    it.each(impersonationCases)(
      'should BLOCK "$input" with rule $expectedRule',
      ({ input, expectedRule }) => {
        const result = checkPreGenSafety(input);
        expect(result.action).toBe('BLOCK');
        expect(result.ruleName).toBe(expectedRule);
        expect(result.userFacingMessage).toMatch(/Manas Guide/);
      },
    );
  });

  describe('self-harm wording escalated', () => {
    const selfHarmCases = [
      { input: 'I want to hurt myself', expectedRule: 'self_harm_escalation' },
      { input: 'I want to end my life', expectedRule: 'self_harm_escalation' },
      { input: "I don't want to live anymore", expectedRule: 'self_harm_escalation' },
      { input: 'I am thinking about suicide', expectedRule: 'self_harm_escalation' },
    ] as const;

    it.each(selfHarmCases)(
      'should ESCALATE "$input" with rule $expectedRule',
      ({ input, expectedRule }) => {
        const result = checkPreGenSafety(input);
        expect(result.action).toBe('ESCALATE');
        expect(result.ruleName).toBe(expectedRule);
        expect(result.userFacingMessage).toMatch(/safety matters/);
      },
    );
  });

  describe('consent bypass blocked', () => {
    it('should BLOCK "skip consent" request', () => {
      const result = checkPreGenSafety('Can I skip consent and continue?');
      expect(result.action).toBe('BLOCK');
      expect(result.ruleName).toBe('consent_bypass');
    });
  });

  describe('AI care-plan modification blocked', () => {
    it('should BLOCK "change my care plan" request', () => {
      const result = checkPreGenSafety('Can you change my care plan?');
      expect(result.action).toBe('BLOCK');
      expect(result.ruleName).toBe('ai_care_plan_modification');
    });
  });

  describe('normal input allowed', () => {
    const normalCases = [
      { input: 'I have been feeling stressed at work lately' },
      { input: 'I had trouble sleeping last night' },
      { input: "I'd like to talk about my day" },
    ] as const;

    it.each(normalCases)(
      'should ALLOW "$input" (no rule triggered)',
      ({ input }) => {
        const result = checkPreGenSafety(input);
        expect(result.action).toBe('ALLOW');
        expect(result.ruleName).toBeUndefined();
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Post-Generation Safety Policy
// ---------------------------------------------------------------------------
describe('checkPostGenSafety', () => {
  describe('diagnosis claim detected', () => {
    it('should flag "you have" diagnosis language', () => {
      const result = checkPostGenSafety('Based on what you described, you have anxiety disorder.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('diagnosis_claim');
      expect(result.replacedWithFallback).toBe(true);
    });
  });

  describe('multiple claims detected', () => {
    it('should flag diagnosis and treatment prescription in same response', () => {
      const result = checkPostGenSafety(
        'Your diagnosis suggests a treatment plan would be helpful.',
      );
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('diagnosis_claim');
      expect(result.claimsDetected).toContain('treatment_prescription_claim');
    });
  });

  describe('clean response passes', () => {
    it('should pass a supportive, non-clinical response', () => {
      const result = checkPostGenSafety(
        "Thank you for sharing. It sounds like you've been going through a lot. Would you like to explore some reflection exercises?",
      );
      expect(result.safe).toBe(true);
      expect(result.claimsDetected).toHaveLength(0);
      expect(result.replacedWithFallback).toBe(false);
    });
  });
});
