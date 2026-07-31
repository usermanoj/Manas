import { z } from 'zod';

/**
 * AI Output Contract — every model response MUST match this schema.
 * Version: prompt-v1 / model-v1
 */
export const AIOutputSchema = z.object({
  user_facing_response: z.string().min(1).max(500),
  extracted_updates: z.record(z.string(), z.unknown()).optional().default({}),
  requested_follow_up: z.enum([
    'duration', 'sleep_impact', 'functioning',
    'support_preference', 'safety_check', 'none'
  ]).nullable(),
  routing_indicators: z.array(z.enum([
    'stress_indicators', 'sleep_disruption',
    'functional_impact', 'support_readiness'
  ])).default([]),
  content_module_request: z.enum(['pause_reflect']).nullable(),
  tool_request: z.null(),
  unsupported_clinical_claims: z.array(z.string()).default([]),
  language: z.enum(['en', 'hi', 'hi-hinglish']),
  confidence: z.number().min(0).max(1),
  model_version: z.string(),
  prompt_version: z.string(),
});

export type AIOutput = z.infer<typeof AIOutputSchema>;

/**
 * Structured Check-In Summary — generated after check-in completion.
 * feels_safe is a DIRECT USER RESPONSE, not an AI inference.
 */
export const StructuredCheckInSchema = z.object({
  primary_concern: z.string().min(1).max(200),
  concern_duration: z.enum(['days', 'weeks', 'months', 'over_year']),
  sleep_impact: z.enum(['none', 'mild', 'significant', 'severe']),
  daily_functioning_impact: z.enum(['none', 'mild', 'moderate', 'significant']),
  support_preference: z.enum(['general_reflection', 'professional_support', 'immediate_resources']),
  feels_safe: z.enum(['yes', 'no', 'prefer_not_to_answer']),
  key_points: z.array(z.string()).max(10),
});

export type StructuredCheckIn = z.infer<typeof StructuredCheckInSchema>;

/**
 * Safe fallback — returned when model output is invalid, times out, or is unavailable.
 */
export const SAFE_FALLBACK: AIOutput = {
  user_facing_response: "I'm having trouble right now. Please try the form below to continue.",
  extracted_updates: {},
  requested_follow_up: null,
  routing_indicators: [],
  content_module_request: null,
  tool_request: null,
  unsupported_clinical_claims: [],
  language: 'en',
  confidence: 0,
  model_version: 'fallback',
  prompt_version: 'fallback-v1',
};

// ---------------------------------------------------------------------------
// Check-In API Contract Schemas
// ---------------------------------------------------------------------------

/**
 * Check-in step enum — identifies which structured question is being asked.
 */
export const CheckInStepSchema = z.enum([
  'primary_concern', 'duration', 'sleep_impact',
  'daily_functioning_impact', 'support_preference', 'safety_response'
]);
export type CheckInStep = z.infer<typeof CheckInStepSchema>;

/**
 * POST /api/check-in — create a new check-in session.
 */
export const CreateCheckInRequestSchema = z.object({
  mode: z.enum(['GUEST', 'CONNECTED_CARE']),
  language: z.enum(['en']).default('en'),
});
export type CreateCheckInRequest = z.infer<typeof CreateCheckInRequestSchema>;

export const CreateCheckInResponseSchema = z.object({
  id: z.string(),
  status: z.literal('INITIATED'),
  createdAt: z.string(),
});
export type CreateCheckInResponse = z.infer<typeof CreateCheckInResponseSchema>;

/**
 * POST /api/check-in/:id/message — post a user message and receive AI response.
 */
export const PostMessageRequestSchema = z.object({
  content: z.string().min(1).max(1000),
  currentStep: CheckInStepSchema,
  structuredAnswers: StructuredCheckInSchema.partial(),
});
export type PostMessageRequest = z.infer<typeof PostMessageRequestSchema>;

export const PostMessageResponseSchema = z.object({
  userFacingResponse: z.string(),
  extractedUpdates: z.record(z.string(), z.unknown()).default({}),
  requestedFollowUp: z.string().nullable(),
  modelVersion: z.string(),
  promptVersion: z.string(),
  fallbackUsed: z.boolean(),
});
export type PostMessageResponse = z.infer<typeof PostMessageResponseSchema>;

/**
 * POST /api/check-in/:id/complete — complete the check-in and get DRAFT summary.
 */
export const CompleteCheckInResponseSchema = z.object({
  draftSummary: StructuredCheckInSchema,
  provisionalRouting: z.object({
    routingState: z.enum([
      'GENERAL_WELLBEING',
      'PROFESSIONAL_SUPPORT_SUGGESTED',
      'HUMAN_REVIEW_REQUIRED',
      'URGENT_SUPPORT_INFORMATION',
    ]),
    policyVersion: z.string(),
    triggeredRules: z.array(z.string()),
  }),
  modelVersion: z.string(),
  promptVersion: z.string(),
  policyVersion: z.string(),
});
export type CompleteCheckInResponse = z.infer<typeof CompleteCheckInResponseSchema>;

/**
 * POST /api/check-in/:id/confirm — user submits edited/final summary.
 */
export const ConfirmCheckInRequestSchema = z.object({
  confirmedSummary: StructuredCheckInSchema,
});
export type ConfirmCheckInRequest = z.infer<typeof ConfirmCheckInRequestSchema>;

export const ConfirmCheckInResponseSchema = z.object({
  confirmedSummary: StructuredCheckInSchema,
  routingDecision: z.object({
    routingState: z.enum([
      'GENERAL_WELLBEING',
      'PROFESSIONAL_SUPPORT_SUGGESTED',
      'HUMAN_REVIEW_REQUIRED',
      'URGENT_SUPPORT_INFORMATION',
    ]),
    policyVersion: z.string(),
    triggeredRules: z.array(z.string()),
    timestamp: z.string(),
    requestId: z.string(),
  }),
  routingState: z.enum([
    'GENERAL_WELLBEING',
    'PROFESSIONAL_SUPPORT_SUGGESTED',
    'HUMAN_REVIEW_REQUIRED',
    'URGENT_SUPPORT_INFORMATION',
  ]),
  policyVersion: z.string(),
  edited: z.boolean(),
});
export type ConfirmCheckInResponse = z.infer<typeof ConfirmCheckInResponseSchema>;
