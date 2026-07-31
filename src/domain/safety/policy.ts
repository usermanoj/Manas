import type { PreGenSafetyResult, PostGenSafetyResult } from './types';

// ---------------------------------------------------------------------------
// Pre-Generation Safety Rules (regex-based, deterministic)
// ---------------------------------------------------------------------------

interface PreGenRule {
  name: string;
  patterns: RegExp[];
  action: 'BLOCK' | 'ESCALATE';
  message: string;
}

const PRE_GEN_RULES: PreGenRule[] = [
  {
    name: 'self_harm_escalation',
    patterns: [
      /hurt\s+myself/i,
      /end\s+my\s+life/i,
      /don'?t\s+want\s+to\s+live/i,
      /self[- ]?harm/i,
      /suicide/i,
      /kill\s+myself/i,
    ],
    action: 'ESCALATE',
    message:
      "Your safety matters. This demonstration does not provide crisis support. If you're in distress, please reach out to a qualified professional or emergency service.",
  },
  {
    name: 'diagnosis_request',
    patterns: [
      /diagnos(?:e|is)/i,
      /what\s+condition/i,
      /do\s+I\s+have/i,
      /am\s+I\s+suffering\s+from/i,
    ],
    action: 'BLOCK',
    message: "I can't provide diagnoses. A qualified professional can help with that.",
  },
  {
    name: 'medication_advice',
    patterns: [
      /medication/i,
      /prescribe/i,
      /dosage/i,
      /should\s+I\s+take/i,
      /stop\s+taking/i,
    ],
    action: 'BLOCK',
    message: "I can't advise on medications. Please consult your healthcare provider.",
  },
  {
    name: 'clinician_impersonation',
    patterns: [
      /are\s+you\s+a\s+doctor/i,
      /are\s+you\s+a\s+psychologist/i,
      /are\s+you\s+a\s+therapist/i,
      /are\s+you\s+a\s+clinician/i,
    ],
    action: 'BLOCK',
    message: "I'm Manas Guide, an AI wellbeing companion — not a clinician.",
  },
  {
    name: 'consent_bypass',
    patterns: [
      /skip\s+consent/i,
      /without\s+consent/i,
      /bypass\s+consent/i,
    ],
    action: 'BLOCK',
    message: "I can only work with your explicit consent.",
  },
  {
    name: 'ai_care_plan_modification',
    patterns: [
      /change\s+my\s+care\s+plan/i,
      /modify\s+care\s+plan/i,
      /update\s+my\s+plan/i,
    ],
    action: 'BLOCK',
    message: "Care plans can only be modified by your clinician.",
  },
];

// ---------------------------------------------------------------------------
// Post-Generation Safety Rules (claim detection)
// ---------------------------------------------------------------------------

interface PostGenClaim {
  name: string;
  patterns: RegExp[];
}

const POST_GEN_CLAIMS: PostGenClaim[] = [
  {
    name: 'diagnosis_claim',
    patterns: [
      /you\s+have\b/i,
      /\bdiagnosis\b/i,
      /condition\s+is\b/i,
    ],
  },
  {
    name: 'medication_advice_claim',
    patterns: [
      /take\s+this\s+medication/i,
      /\bdosage\b/i,
      /\bprescription\b/i,
    ],
  },
  {
    name: 'clinician_impersonation_claim',
    patterns: [
      /as\s+a\s+clinician/i,
      /as\s+your\s+doctor/i,
      /I\s+recommend\s+treatment/i,
    ],
  },
  {
    name: 'treatment_prescription_claim',
    patterns: [
      /treatment\s+plan/i,
      /therapy\s+approach/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Exported Functions
// ---------------------------------------------------------------------------

/**
 * Pre-generation safety check. Evaluates user input against deterministic
 * regex rules BEFORE it reaches the AI model.
 *
 * Priority: ESCALATE (self-harm) is checked first so it takes precedence.
 */
export function checkPreGenSafety(userInput: string): PreGenSafetyResult {
  for (const rule of PRE_GEN_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(userInput)) {
        return {
          action: rule.action,
          reason: rule.name,
          userFacingMessage: rule.message,
          ruleName: rule.name,
        };
      }
    }
  }

  return { action: 'ALLOW' };
}

/**
 * Post-generation safety check. Scans the AI response for unsupported
 * clinical claims that should not reach the user.
 */
export function checkPostGenSafety(aiResponse: string): PostGenSafetyResult {
  const claimsDetected: string[] = [];

  for (const claim of POST_GEN_CLAIMS) {
    for (const pattern of claim.patterns) {
      if (pattern.test(aiResponse)) {
        claimsDetected.push(claim.name);
        break; // one hit per claim category is sufficient
      }
    }
  }

  return {
    safe: claimsDetected.length === 0,
    claimsDetected,
    replacedWithFallback: claimsDetected.length > 0,
  };
}
