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
// Routing Engine — Database of Expected Behaviors
// ---------------------------------------------------------------------------
describe('Routing Engine — determineRouting', () => {
  // -------------------------------------------------------------------------
  // 1. GENERAL_WELLBEING — no rules triggered
  // -------------------------------------------------------------------------
  describe('GENERAL_WELLBEING routing (no rules triggered)', () => {
    it('all low-risk indicators → GENERAL_WELLBEING', () => {
      const summary = buildSummary();
      const result = determineRouting(summary, 'req-001');

      expect(result.routingState).toBe('GENERAL_WELLBEING');
      expect(result.triggeredRules).toHaveLength(0);
      expect(result.policyVersion).toBe(SAFETY_POLICY_VERSION);
      expect(result.requestId).toBe('req-001');
      expect(result.timestamp).toBeDefined();
    });

    it('feels_safe=yes, functioning=mild, sleep=mild, duration=days → GENERAL_WELLBEING', () => {
      const summary = buildSummary({
        feels_safe: 'yes',
        daily_functioning_impact: 'mild',
        sleep_impact: 'mild',
        concern_duration: 'days',
      });
      const result = determineRouting(summary, 'req-gw-2');
      expect(result.routingState).toBe('GENERAL_WELLBEING');
      expect(result.triggeredRules).toEqual([]);
    });

    it('support_preference=general_reflection, all low → GENERAL_WELLBEING', () => {
      const summary = buildSummary({ support_preference: 'general_reflection' });
      const result = determineRouting(summary, 'req-gw-3');
      expect(result.routingState).toBe('GENERAL_WELLBEING');
    });

    it('sleep=significant but duration=days (not months/over_year) → no compound rule', () => {
      const summary = buildSummary({ sleep_impact: 'significant', concern_duration: 'days' });
      const result = determineRouting(summary, 'req-gw-4');
      // sleep_duration_compound requires months OR over_year, so this should NOT trigger
      expect(result.triggeredRules).not.toContain('sleep_duration_compound');
      expect(result.routingState).toBe('GENERAL_WELLBEING');
    });

    it('sleep=severe but duration=weeks (not months/over_year) → no compound rule', () => {
      const summary = buildSummary({ sleep_impact: 'severe', concern_duration: 'weeks' });
      const result = determineRouting(summary, 'req-gw-5');
      expect(result.triggeredRules).not.toContain('sleep_duration_compound');
      expect(result.routingState).toBe('GENERAL_WELLBEING');
    });
  });

  // -------------------------------------------------------------------------
  // 2. PROFESSIONAL_SUPPORT_SUGGESTED — elevated but non-urgent
  // -------------------------------------------------------------------------
  describe('PROFESSIONAL_SUPPORT_SUGGESTED routing', () => {
    it('daily_functioning_impact=moderate → triggers functioning_impact_elevated', () => {
      const summary = buildSummary({ daily_functioning_impact: 'moderate' });
      const result = determineRouting(summary, 'req-prof-1');
      expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(result.triggeredRules).toContain('functioning_impact_elevated');
    });

    it('daily_functioning_impact=significant → triggers functioning_impact_elevated', () => {
      const summary = buildSummary({ daily_functioning_impact: 'significant' });
      const result = determineRouting(summary, 'req-prof-2');
      expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(result.triggeredRules).toContain('functioning_impact_elevated');
    });

    it('support_preference=professional_support → triggers support_preference_professional', () => {
      const summary = buildSummary({ support_preference: 'professional_support' });
      const result = determineRouting(summary, 'req-prof-3');
      expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(result.triggeredRules).toContain('support_preference_professional');
    });

    it('sleep=significant + duration=months → triggers sleep_duration_compound', () => {
      const summary = buildSummary({ sleep_impact: 'significant', concern_duration: 'months' });
      const result = determineRouting(summary, 'req-prof-4');
      expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(result.triggeredRules).toContain('sleep_duration_compound');
    });

    it('sleep=severe + duration=over_year → triggers sleep_duration_compound', () => {
      const summary = buildSummary({ sleep_impact: 'severe', concern_duration: 'over_year' });
      const result = determineRouting(summary, 'req-prof-5');
      expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(result.triggeredRules).toContain('sleep_duration_compound');
    });

    it('sleep=significant + duration=over_year → triggers sleep_duration_compound', () => {
      const summary = buildSummary({ sleep_impact: 'significant', concern_duration: 'over_year' });
      const result = determineRouting(summary, 'req-prof-6');
      expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(result.triggeredRules).toContain('sleep_duration_compound');
    });

    it('sleep=severe + duration=months → triggers sleep_duration_compound', () => {
      const summary = buildSummary({ sleep_impact: 'severe', concern_duration: 'months' });
      const result = determineRouting(summary, 'req-prof-7');
      expect(result.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(result.triggeredRules).toContain('sleep_duration_compound');
    });
  });

  // -------------------------------------------------------------------------
  // 3. URGENT_SUPPORT_INFORMATION — safety response triggered
  // -------------------------------------------------------------------------
  describe('URGENT_SUPPORT_INFORMATION routing', () => {
    it('feels_safe=no → triggers safety_response_no', () => {
      const summary = buildSummary({ feels_safe: 'no' });
      const result = determineRouting(summary, 'req-urg-1');
      expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(result.triggeredRules).toContain('safety_response_no');
    });

    it('feels_safe=prefer_not_to_answer → triggers safety_response_prefer_not_to_answer', () => {
      const summary = buildSummary({ feels_safe: 'prefer_not_to_answer' });
      const result = determineRouting(summary, 'req-urg-2');
      expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(result.triggeredRules).toContain('safety_response_prefer_not_to_answer');
    });

    it('feels_safe=no + functioning=significant → URGENT (safety takes priority)', () => {
      const summary = buildSummary({
        feels_safe: 'no',
        daily_functioning_impact: 'significant',
      });
      const result = determineRouting(summary, 'req-priority');
      expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(result.triggeredRules).toContain('safety_response_no');
      expect(result.triggeredRules).toContain('functioning_impact_elevated');
    });

    it('feels_safe=prefer_not_to_answer + professional_support → URGENT wins', () => {
      const summary = buildSummary({
        feels_safe: 'prefer_not_to_answer',
        support_preference: 'professional_support',
      });
      const result = determineRouting(summary, 'req-priority-2');
      expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(result.triggeredRules).toContain('safety_response_prefer_not_to_answer');
      expect(result.triggeredRules).toContain('support_preference_professional');
    });

    it('all elevated + feels_safe=no → URGENT with multiple triggered rules', () => {
      const summary = buildSummary({
        feels_safe: 'no',
        daily_functioning_impact: 'significant',
        sleep_impact: 'severe',
        concern_duration: 'months',
        support_preference: 'professional_support',
      });
      const result = determineRouting(summary, 'req-all');
      expect(result.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(result.triggeredRules).toContain('safety_response_no');
      expect(result.triggeredRules).toContain('functioning_impact_elevated');
      expect(result.triggeredRules).toContain('sleep_duration_compound');
      expect(result.triggeredRules).toContain('support_preference_professional');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Re-routing after user edits
  // -------------------------------------------------------------------------
  describe('re-routing after summary edit', () => {
    it('GENERAL_WELLBEING → URGENT_SUPPORT_INFORMATION when feels_safe changes to no', () => {
      const original = buildSummary({ feels_safe: 'yes', daily_functioning_impact: 'mild' });
      const edited = buildSummary({ feels_safe: 'no', daily_functioning_impact: 'mild' });

      const originalResult = determineRouting(original, 'req-reroute-1');
      const editedResult = determineRouting(edited, 'req-reroute-2');

      expect(originalResult.routingState).toBe('GENERAL_WELLBEING');
      expect(editedResult.routingState).toBe('URGENT_SUPPORT_INFORMATION');
      expect(originalResult.triggeredRules).not.toEqual(editedResult.triggeredRules);
    });

    it('GENERAL_WELLBEING → PROFESSIONAL when functioning impact elevated', () => {
      const original = buildSummary({ daily_functioning_impact: 'mild' });
      const edited = buildSummary({ daily_functioning_impact: 'moderate' });

      const originalResult = determineRouting(original, 'req-reroute-3');
      const editedResult = determineRouting(edited, 'req-reroute-4');

      expect(originalResult.routingState).toBe('GENERAL_WELLBEING');
      expect(editedResult.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
    });

    it('PROFESSIONAL → GENERAL when user lowers severity', () => {
      const original = buildSummary({ daily_functioning_impact: 'significant' });
      const edited = buildSummary({ daily_functioning_impact: 'mild' });

      const originalResult = determineRouting(original, 'req-reroute-5');
      const editedResult = determineRouting(edited, 'req-reroute-6');

      expect(originalResult.routingState).toBe('PROFESSIONAL_SUPPORT_SUGGESTED');
      expect(editedResult.routingState).toBe('GENERAL_WELLBEING');
    });
  });

  // -------------------------------------------------------------------------
  // 5. HUMAN_REVIEW_REQUIRED is never produced
  // -------------------------------------------------------------------------
  describe('HUMAN_REVIEW_REQUIRED is reserved and never produced', () => {
    it('not produced for any feels_safe value', () => {
      const safetyValues = ['yes', 'no', 'prefer_not_to_answer'] as const;
      for (const feelsSafe of safetyValues) {
        const summary = buildSummary({ feels_safe: feelsSafe });
        const result = determineRouting(summary, 'req-reserved');
        expect(result.routingState).not.toBe('HUMAN_REVIEW_REQUIRED');
      }
    });

    it('not produced even with all indicators elevated', () => {
      const summary = buildSummary({
        feels_safe: 'yes',
        daily_functioning_impact: 'significant',
        sleep_impact: 'severe',
        concern_duration: 'months',
        support_preference: 'professional_support',
      });
      const result = determineRouting(summary, 'req-reserved-2');
      expect(result.routingState).not.toBe('HUMAN_REVIEW_REQUIRED');
    });
  });

  // -------------------------------------------------------------------------
  // 6. RoutingDecision metadata
  // -------------------------------------------------------------------------
  describe('RoutingDecision metadata', () => {
    it('policyVersion matches SAFETY_POLICY_VERSION constant', () => {
      const summary = buildSummary();
      const result = determineRouting(summary, 'req-meta');
      expect(result.policyVersion).toBe('safety-v1');
    });

    it('requestId is passed through correctly', () => {
      const summary = buildSummary();
      const result = determineRouting(summary, 'req-abc-123');
      expect(result.requestId).toBe('req-abc-123');
    });

    it('timestamp is a valid ISO string', () => {
      const summary = buildSummary();
      const result = determineRouting(summary, 'req-ts');
      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });
});
