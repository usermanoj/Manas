import { describe, it, expect } from 'vitest';
import { checkPreGenSafety, checkPostGenSafety } from '@/domain/safety';
import type { PreGenSafetyResult, PostGenSafetyResult } from '@/domain/safety';

// ---------------------------------------------------------------------------
// Pre-Generation Safety Policy
// ---------------------------------------------------------------------------
describe('Safety Policy — Pre-Generation (checkPreGenSafety)', () => {
  describe('self-harm wording triggers ESCALATE', () => {
    const cases: Array<{ label: string; input: string }> = [
      { label: 'explicit "hurt myself"', input: 'I want to hurt myself' },
      { label: '"end my life"', input: 'I want to end my life' },
      { label: 'contraction "don\'t want to live"', input: "I don't want to live anymore" },
      { label: '"self-harm" hyphenated', input: 'I am thinking about self-harm' },
      { label: '"self harm" unhyphenated', input: 'I am thinking about self harm' },
      { label: '"suicide" keyword', input: 'I am thinking about suicide' },
      { label: '"kill myself"', input: 'I want to kill myself' },
    ];

    it.each(cases)('$label → ESCALATE', ({ input }) => {
      const result: PreGenSafetyResult = checkPreGenSafety(input);
      expect(result.action).toBe('ESCALATE');
      expect(result.ruleName).toBe('self_harm_escalation');
      expect(result.userFacingMessage).toMatch(/safety matters/);
    });
  });

  describe('diagnosis request triggers BLOCK', () => {
    const cases: Array<{ label: string; input: string }> = [
      { label: '"diagnose me"', input: 'Can you diagnose me with anxiety?' },
      { label: '"diagnosis"', input: 'I need a diagnosis for my symptoms' },
      { label: '"what condition"', input: 'What condition do I have?' },
      { label: '"do I have"', input: 'Do I have depression?' },
      { label: '"am I suffering from"', input: 'Am I suffering from PTSD?' },
    ];

    it.each(cases)('$label → BLOCK', ({ input }) => {
      const result = checkPreGenSafety(input);
      expect(result.action).toBe('BLOCK');
      expect(result.ruleName).toBe('diagnosis_request');
      expect(result.userFacingMessage).toBeDefined();
    });
  });

  describe('medication advice triggers BLOCK', () => {
    const cases: Array<{ label: string; input: string }> = [
      { label: '"medication" keyword', input: 'What medication should I take for anxiety?' },
      { label: '"prescribe" keyword', input: 'Can you prescribe something for sleep?' },
      { label: '"dosage" keyword', input: 'What dosage should I take?' },
      { label: '"should I take"', input: 'Should I take ibuprofen for my headaches?' },
      { label: '"stop taking"', input: 'Should I stop taking my medication?' },
    ];

    it.each(cases)('$label → BLOCK', ({ input }) => {
      const result = checkPreGenSafety(input);
      expect(result.action).toBe('BLOCK');
      expect(result.ruleName).toBe('medication_advice');
    });
  });

  describe('clinician impersonation triggers BLOCK', () => {
    const cases: Array<{ label: string; input: string }> = [
      { label: '"are you a doctor"', input: 'Are you a doctor?' },
      { label: '"are you a psychologist"', input: 'Are you a psychologist?' },
      { label: '"are you a therapist"', input: 'Are you a therapist?' },
      { label: '"are you a clinician"', input: 'Are you a clinician?' },
    ];

    it.each(cases)('$label → BLOCK with Manas Guide message', ({ input }) => {
      const result = checkPreGenSafety(input);
      expect(result.action).toBe('BLOCK');
      expect(result.ruleName).toBe('clinician_impersonation');
      expect(result.userFacingMessage).toMatch(/Manas Guide/);
    });
  });

  describe('consent bypass triggers BLOCK', () => {
    const cases: Array<{ label: string; input: string }> = [
      { label: '"skip consent"', input: 'Can I skip consent and continue?' },
      { label: '"without consent"', input: 'Continue without consent' },
      { label: '"bypass consent"', input: 'Bypass consent for me' },
    ];

    it.each(cases)('$label → BLOCK', ({ input }) => {
      const result = checkPreGenSafety(input);
      expect(result.action).toBe('BLOCK');
      expect(result.ruleName).toBe('consent_bypass');
    });
  });

  describe('AI care-plan modification triggers BLOCK', () => {
    const cases: Array<{ label: string; input: string }> = [
      { label: '"change my care plan"', input: 'Can you change my care plan?' },
      { label: '"modify care plan"', input: 'Please modify care plan for me' },
      { label: '"update my plan"', input: 'Can you update my plan?' },
    ];

    it.each(cases)('$label → BLOCK', ({ input }) => {
      const result = checkPreGenSafety(input);
      expect(result.action).toBe('BLOCK');
      expect(result.ruleName).toBe('ai_care_plan_modification');
    });
  });

  describe('normal input triggers ALLOW', () => {
    const cases: Array<{ label: string; input: string }> = [
      { label: 'stress at work', input: 'I have been feeling stressed at work lately' },
      { label: 'trouble sleeping', input: 'I had trouble sleeping last night' },
      { label: 'talk about my day', input: "I'd like to talk about my day" },
      { label: 'general wellbeing', input: 'I feel okay today, just checking in' },
    ];

    it.each(cases)('$label → ALLOW', ({ input }) => {
      const result = checkPreGenSafety(input);
      expect(result.action).toBe('ALLOW');
      expect(result.ruleName).toBeUndefined();
      expect(result.userFacingMessage).toBeUndefined();
    });
  });

  describe('ESCALATE takes priority over BLOCK', () => {
    it('self-harm phrasing with diagnosis keyword still ESCALATEs', () => {
      const result = checkPreGenSafety('Can you diagnose why I want to hurt myself?');
      expect(result.action).toBe('ESCALATE');
      expect(result.ruleName).toBe('self_harm_escalation');
    });
  });
});

// ---------------------------------------------------------------------------
// Post-Generation Safety Policy
// ---------------------------------------------------------------------------
describe('Safety Policy — Post-Generation (checkPostGenSafety)', () => {
  describe('diagnosis claim detected', () => {
    it('"you have" pattern → flags diagnosis_claim', () => {
      const result: PostGenSafetyResult = checkPostGenSafety(
        'Based on what you described, you have anxiety disorder.',
      );
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('diagnosis_claim');
      expect(result.replacedWithFallback).toBe(true);
    });

    it('"diagnosis" keyword → flags diagnosis_claim', () => {
      const result = checkPostGenSafety('Your diagnosis suggests this is a serious condition.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('diagnosis_claim');
    });
  });

  describe('medication advice claim detected', () => {
    it('"take this medication" → flags medication_advice_claim', () => {
      const result = checkPostGenSafety('You should take this medication for your symptoms.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('medication_advice_claim');
    });

    it('"dosage" keyword → flags medication_advice_claim', () => {
      const result = checkPostGenSafety('The recommended dosage is 50mg daily.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('medication_advice_claim');
    });

    it('"prescription" keyword → flags medication_advice_claim', () => {
      const result = checkPostGenSafety('You may need a prescription for this.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('medication_advice_claim');
    });
  });

  describe('clinician impersonation claim detected', () => {
    it('"as a clinician" → flags clinician_impersonation_claim', () => {
      const result = checkPostGenSafety('As a clinician, I believe you would benefit from therapy.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('clinician_impersonation_claim');
    });

    it('"as your doctor" → flags clinician_impersonation_claim', () => {
      const result = checkPostGenSafety('As your doctor, I recommend rest and reflection.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('clinician_impersonation_claim');
    });

    it('"I recommend treatment" → flags clinician_impersonation_claim', () => {
      const result = checkPostGenSafety('I recommend treatment for your condition.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('clinician_impersonation_claim');
    });
  });

  describe('treatment prescription claim detected', () => {
    it('"treatment plan" → flags treatment_prescription_claim', () => {
      const result = checkPostGenSafety('Here is a treatment plan for your anxiety.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('treatment_prescription_claim');
    });

    it('"therapy approach" → flags treatment_prescription_claim', () => {
      const result = checkPostGenSafety('This therapy approach has shown promising results.');
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('treatment_prescription_claim');
    });
  });

  describe('multiple claims detected in a single response', () => {
    it('diagnosis + treatment prescription', () => {
      const result = checkPostGenSafety(
        'Your diagnosis suggests a treatment plan would be helpful.',
      );
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('diagnosis_claim');
      expect(result.claimsDetected).toContain('treatment_prescription_claim');
    });

    it('diagnosis + medication advice', () => {
      const result = checkPostGenSafety(
        'Based on your diagnosis, the recommended dosage is 25mg.',
      );
      expect(result.safe).toBe(false);
      expect(result.claimsDetected).toContain('diagnosis_claim');
      expect(result.claimsDetected).toContain('medication_advice_claim');
    });
  });

  describe('clean supportive response passes', () => {
    const cases: Array<{ label: string; input: string }> = [
      {
        label: 'supportive reflection',
        input: "Thank you for sharing. It sounds like you've been going through a lot. Would you like to explore some reflection exercises?",
      },
      {
        label: 'general wellbeing encouragement',
        input: 'It sounds like you are managing well. Keep journaling about your feelings.',
      },
      {
        label: 'acknowledging stress',
        input: 'Work stress is very common. Taking small breaks can help.',
      },
    ];

    it.each(cases)('$label → safe, no claims', ({ input }) => {
      const result = checkPostGenSafety(input);
      expect(result.safe).toBe(true);
      expect(result.claimsDetected).toHaveLength(0);
      expect(result.replacedWithFallback).toBe(false);
    });
  });
});
