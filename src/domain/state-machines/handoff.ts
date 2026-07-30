/**
 * Handoff / Consent State Machine
 *
 * States: DRAFT | USER_REVIEW | CONSENTED | SENT | CLINICIAN_ACCEPTED | COMPLETED | DECLINED | EXPIRED
 *
 * Transitions:
 *   DRAFT              → USER_REVIEW  (submit_for_review)
 *   DRAFT              → DECLINED     (decline)
 *   USER_REVIEW        → CONSENTED    (grant_consent)
 *   USER_REVIEW        → DECLINED     (decline)
 *   CONSENTED          → SENT         (send)
 *   CONSENTED          → DECLINED     (decline)
 *   SENT               → CLINICIAN_ACCEPTED  (clinician_accept)
 *   SENT               → DECLINED     (decline)
 *   SENT               → EXPIRED      (expire)
 *   CLINICIAN_ACCEPTED → COMPLETED    (complete)
 *   CLINICIAN_ACCEPTED → DECLINED     (decline)
 *
 * Terminal: COMPLETED, DECLINED, EXPIRED
 *
 * SEND guard: requires CONSENTED status AND explicit consent in consent_records
 *             AND NOT revoked AND NOT expired.
 * Consent source of truth: consent_records table ONLY. No consent-status field on handoffs.
 */

export type HandoffStatus =
  | 'DRAFT'
  | 'USER_REVIEW'
  | 'CONSENTED'
  | 'SENT'
  | 'CLINICIAN_ACCEPTED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED';

export type HandoffAction =
  | 'submit_for_review'
  | 'decline'
  | 'grant_consent'
  | 'send'
  | 'clinician_accept'
  | 'complete'
  | 'expire';

export const HANDOFF_TRANSITIONS: Record<HandoffStatus, Partial<Record<HandoffAction, HandoffStatus>>> = {
  DRAFT: {
    submit_for_review: 'USER_REVIEW',
    decline: 'DECLINED',
  },
  USER_REVIEW: {
    grant_consent: 'CONSENTED',
    decline: 'DECLINED',
  },
  CONSENTED: {
    send: 'SENT',
    decline: 'DECLINED',
  },
  SENT: {
    clinician_accept: 'CLINICIAN_ACCEPTED',
    decline: 'DECLINED',
    expire: 'EXPIRED',
  },
  CLINICIAN_ACCEPTED: {
    complete: 'COMPLETED',
    decline: 'DECLINED',
  },
  COMPLETED: {},
  DECLINED: {},
  EXPIRED: {},
};

const TERMINAL_HANDOFF_STATUSES: ReadonlySet<HandoffStatus> = new Set([
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
]);

/**
 * Validate a proposed handoff state transition.
 * Returns a discriminated union: { valid: true; nextStatus } | { valid: false; error }
 */
export function validateHandoffTransition(
  currentStatus: HandoffStatus,
  action: HandoffAction
): { valid: true; nextStatus: HandoffStatus } | { valid: false; error: string } {
  const transitionsForState = HANDOFF_TRANSITIONS[currentStatus];
  const nextStatus = transitionsForState[action];

  if (nextStatus === undefined) {
    return {
      valid: false,
      error: `Invalid handoff transition: cannot perform action "${action}" from status "${currentStatus}".`,
    };
  }

  return { valid: true, nextStatus };
}

/**
 * Type guard — returns true if the status is a terminal handoff state.
 */
export function isTerminalHandoffStatus(status: HandoffStatus): boolean {
  return TERMINAL_HANDOFF_STATUSES.has(status);
}

/**
 * Consent record shape required for SEND guard validation.
 */
export interface ConsentRecordForGuard {
  status: 'GRANTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
}

/**
 * SEND guard — validates that the handoff may transition to SENT.
 * Requires: CONSENTED status AND a valid (non-revoked, non-expired) consent record.
 *
 * Returns: { allowed: true } | { allowed: false; reason: string }
 */
export function canSendHandoff(
  handoffStatus: HandoffStatus,
  consentRecord: ConsentRecordForGuard | null,
  now: Date = new Date()
): { allowed: true } | { allowed: false; reason: string } {
  if (handoffStatus !== 'CONSENTED') {
    return { allowed: false, reason: `Handoff must be in CONSENTED status to send; current status: "${handoffStatus}".` };
  }

  if (consentRecord === null) {
    return { allowed: false, reason: 'No consent record found. SEND requires explicit consent in consent_records.' };
  }

  if (consentRecord.status === 'REVOKED') {
    return { allowed: false, reason: 'Consent has been revoked. Cannot send handoff.' };
  }

  if (consentRecord.status === 'EXPIRED' || consentRecord.expiresAt <= now) {
    return { allowed: false, reason: 'Consent has expired. Cannot send handoff.' };
  }

  if (consentRecord.status !== 'GRANTED') {
    return { allowed: false, reason: `Consent status is "${consentRecord.status}", not "GRANTED". Cannot send handoff.` };
  }

  return { allowed: true };
}
