import { z } from 'zod';

// ---------------------------------------------------------------------------
// Routing State
// ---------------------------------------------------------------------------

export const RoutingStateSchema = z.enum([
  'GENERAL_WELLBEING',
  'PROFESSIONAL_SUPPORT_SUGGESTED',
  'HUMAN_REVIEW_REQUIRED',
  'URGENT_SUPPORT_INFORMATION',
]);
export type RoutingState = z.infer<typeof RoutingStateSchema>;

// ---------------------------------------------------------------------------
// Safety Action Types
// ---------------------------------------------------------------------------

export type SafetyAction = 'BLOCK' | 'ESCALATE' | 'ALLOW';

// ---------------------------------------------------------------------------
// Pre-Generation Safety Result
// ---------------------------------------------------------------------------

export interface PreGenSafetyResult {
  action: SafetyAction;
  reason?: string;
  userFacingMessage?: string;
  ruleName?: string;
}

// ---------------------------------------------------------------------------
// Post-Generation Safety Result
// ---------------------------------------------------------------------------

export interface PostGenSafetyResult {
  safe: boolean;
  claimsDetected: string[];
  replacedWithFallback: boolean;
}

// ---------------------------------------------------------------------------
// Routing Decision
// ---------------------------------------------------------------------------

export const RoutingDecisionSchema = z.object({
  routingState: RoutingStateSchema,
  policyVersion: z.string(),
  triggeredRules: z.array(z.string()),
  timestamp: z.string(),
  requestId: z.string(),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// ---------------------------------------------------------------------------
// Safety Assessment
// ---------------------------------------------------------------------------

export const SafetyAssessmentSchema = z.object({
  preGenResult: z.object({
    action: z.enum(['BLOCK', 'ESCALATE', 'ALLOW']),
    reason: z.string().optional(),
    ruleName: z.string().optional(),
  }),
  postGenResult: z.object({
    safe: z.boolean(),
    claimsDetected: z.array(z.string()),
    replacedWithFallback: z.boolean(),
  }),
  routingState: RoutingStateSchema,
  policyVersion: z.string(),
});
export type SafetyAssessment = z.infer<typeof SafetyAssessmentSchema>;

// ---------------------------------------------------------------------------
// Policy Version Constant
// ---------------------------------------------------------------------------

export const SAFETY_POLICY_VERSION = 'safety-v1';
