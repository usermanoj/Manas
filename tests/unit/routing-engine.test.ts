import { describe, it, expect } from 'vitest';
import { determineRouting, SAFETY_POLICY_VERSION } from '@/domain/safety';
import type { StructuredCheckIn } from '@/domain/ai';

// ---------------------------------------------------------------------------
// Helper: build a valid StructuredCheckIn with sensible defaults
// ---------------------------------------------------------------------------
function buildSummary(overrides: Partial<StructuredCheckIn> = {}): StructuredCheckIn {
  return {
    primary_concern: 'work stress',
    concern_duration: 'weeks',
    sleep_impact: 'mild',
    daily_functioning_impact: 'mild',
    support_preference: 'general_reflection',
    feels_safe: 'yes',
    key_points: ['feeling overwhelmed at work'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Routing Engine Tests
// ---------------------------------------------------------------------------
describe('determineRouting', () => {
  describe('GENERAL_WELLBEING routing', () => {
    it('should route to GENERAL_WELLBEING when all indicators are low-risk', () => {
      const summary = buildSummary();
      const result = determineRouting(summary, 'req-001');

      expect(result.routingState).toBe('GENERAL_WELLBEING');
      expect(result.triggeredRules).toHaveLength(0);
      expect(result.policyVersion).toBe(SAFETY_POLICY_VERSION);
      expect(result.requestId).toBe('req-001');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('PROFESSIONAL_SUPPORT_SUGGESTED routing', () => {
    const professionalCases = [
      {
        label: 'moderate functioning impact',
        overrides: { daily_functioning_impact: 'moderate' as const },
        expectedRule: 'functioning_impact_elevated',
      },
      {
        label: 'significant functioning impact',
        overrides: { daily_functioning_impact: 'significant' as const },
        expectedRule: 'functioning_impact_elevated',
      },
      {
        label: 'professional support preference',
        overrides: { support_preference: 'professional_support' as const },
        expectedRule: 'support_preference_professional',
      },
      {
        label: 'severe sleep + months duration compound rule',
        overrides: { sleep_impact: 'severe' as const, concern_duration: 'months' as const },
        expectedRule: 'sleep_duration_compound',
      },
    ] as const;

    it.each(professionalCases)(
      'should route to PROFESSIONAL_SUPPORT_SUGGESTED for $label',
      ({ overrides, expectedRule }) => {
        const summary = buildSummary(overrides);
        const result = determineRouting(summary, 'req-prof');

        expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
        expect(result.triggeredRules).toContain(expectedRule);
      },
    );
  });

  describe('URGENT_SUPPORT_INFORMATION routing', () => {
    const urgentCases = [
      {
        label: 'feels_safe = no',
        overrides: { feels_safe: 'no' as const },
        expectedRule: 'safety_response_no',
      },
      {
        label: 'feels_safe = prefer_not_to_answer',
        overrides: { feels_safe: 'prefer_not_to_answer' as const },
        expectedRule: 'safety_response_prefer_not_to_answer',
      },
    ] as const;

    it.each(urgentCases)(
      'should route to URGENT_SUPPORT_INFORMATION for $label',
      ({ overrides, expectedRule }) => {
        const summary = buildSummary(overrides);
        const result = determineRouting(summary, 'req-urgent');

        expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
        expect(result.triggeredRules).toContain(expectedRule);
      },
    );

    it('should prioritize URGENT over PROFESSIONAL when safety + functioning both trigger', () => {
      const summary = buildSummary({
        feels_safe: 'no',
        daily_functioning_impact: 'significant',
      });
      const result = determineRouting(summary, 'req-priority');

      expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(result.triggeredRules).toContain('safety_response_no');
      expect(result.triggeredRules).toContain('functioning_impact_elevated');
    });
  });

  describe('re-routing after edit', () => {
    it('should produce different routing when summary changes', () => {
      const original = buildSummary({ feels_safe: 'yes', daily_functioning_impact: 'mild' });
      const edited = buildSummary({ feels_safe: 'no', daily_functioning_impact: 'mild' });

      const originalResult = determineRouting(original, 'req-reroute-1');
      const editedResult = determineRouting(edited, 'req-reroute-2');

      expect(originalResult.routingState).toBe('GENERAL_WELLBEING');
      expect(editedResult.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(originalResult.triggeredRules).not.toEqual(editedResult.triggeredRules);
    });
  });

  describe('HUMAN_REVIEW_REQUIRED is never produced', () => {
    it('should not route to HUMAN_REVIEW_REQUIRED for any combination', () => {
      // Exhaustive check across all feels_safe values
      const safetyValues = ['yes', 'no', 'prefer_not_to_answer'] as const;
      for (const feelsSafe of safetyValues) {
        const summary = buildSummary({ feels_safe: feelsSafe });
        const result = determineRouting(summary, 'req-reserved');
        expect(result.routingState).not.toBe('HUMAN_REVIEW_REQUIRED');
      }
    });
  });
});
