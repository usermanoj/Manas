import type { RoutingState, RoutingDecision } from './types';
import type { StructuredCheckIn } from '@/domain/ai';
import { SAFETY_POLICY_VERSION } from './types';

/**
 * Deterministic routing engine. Evaluates a structured check-in summary
 * against explicit rules to produce a RoutingDecision. No ML involved.
 *
 * Priority order:
 *   1. URGENT_SUPPORT_INFORMATION (safety_response rules)
 *   2. PROFESSIONAL_SUPPORT_SUGGESTED (any other triggered rule)
 *   3. GENERAL_WELLBEING (no rules triggered)
 *
 * NOTE: HUMAN_REVIEW_REQUIRED is a reserved future state and is NOT
 * produced by any current rule.
 */
export function determineRouting(
  summary: StructuredCheckIn,
  requestId: string,
): RoutingDecision {
  const triggeredRules: string[] = [];

  // Rule 1: feels_safe = 'no' → URGENT_SUPPORT_INFORMATION
  if (summary.feels_safe === 'no') {
    triggeredRules.push('safety_response_no');
  }

  // Rule 2: feels_safe = 'prefer_not_to_answer' → URGENT_SUPPORT_INFORMATION
  if (summary.feels_safe === 'prefer_not_to_answer') {
    triggeredRules.push('safety_response_prefer_not_to_answer');
  }

  // Rule 3: daily_functioning_impact moderate/significant → PROFESSIONAL_SUPPORT_SUGGESTED
  if (
    summary.daily_functioning_impact === 'moderate' ||
    summary.daily_functioning_impact === 'significant'
  ) {
    triggeredRules.push('functioning_impact_elevated');
  }

  // Rule 4: sleep significant/severe AND duration months/over_year → PROFESSIONAL_SUPPORT_SUGGESTED
  if (
    (summary.sleep_impact === 'significant' || summary.sleep_impact === 'severe') &&
    (summary.concern_duration === 'months' || summary.concern_duration === 'over_year')
  ) {
    triggeredRules.push('sleep_duration_compound');
  }

  // Rule 5: support_preference = professional_support → PROFESSIONAL_SUPPORT_SUGGESTED
  if (summary.support_preference === 'professional_support') {
    triggeredRules.push('support_preference_professional');
  }

  // Determine final state (priority order)
  let routingState: RoutingState;
  if (triggeredRules.some((r) => r.startsWith('safety_response'))) {
    routingState = 'URGENT_SUPPORT_INFORMATION';
  } else if (triggeredRules.length > 0) {
    routingState = 'PROFESSIONAL_SUPPORT_SUGGESTED';
  } else {
    routingState = 'GENERAL_WELLBEING';
  }

  return {
    routingState,
    policyVersion: SAFETY_POLICY_VERSION,
    triggeredRules,
    timestamp: new Date().toISOString(),
    requestId,
  };
}
