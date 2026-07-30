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
