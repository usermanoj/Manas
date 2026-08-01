/**
 * Care-Plan Versioning State Machine
 *
 * States: DRAFT | PROPOSED | CLINICIAN_APPROVED | USER_ACCEPTED | ACTIVE | PAUSED | REVISED | COMPLETED | RETIRED
 *
 * Transitions:
 *   DRAFT              → PROPOSED           (propose)
 *   PROPOSED           → CLINICIAN_APPROVED (approve) — clinician role required
 *   PROPOSED           → RETIRED            (retire)
 *   CLINICIAN_APPROVED → USER_ACCEPTED      (accept)
 *   CLINICIAN_APPROVED → RETIRED            (retire)
 *   USER_ACCEPTED      → ACTIVE             (activate)
 *   USER_ACCEPTED      → RETIRED            (retire)
 *   ACTIVE             → PAUSED             (pause)
 *   ACTIVE             → REVISED            (revise) — creates NEW version, V1 preserved
 *   ACTIVE             → COMPLETED          (complete)
 *   ACTIVE             → RETIRED            (retire)
 *   PAUSED             → ACTIVE             (resume)
 *   PAUSED             → RETIRED            (retire)
 *   REVISED            → PROPOSED           (propose) — new version starts approval cycle
 *   Any                → RETIRED            (retire) — terminal
 *
 * Critical:
 *   - AI CANNOT modify an ACTIVE care plan
 *   - Version 2 creates a NEW care_plan_versions record; V1 preserved immutably
 *   - ACTIVE requires BOTH clinician approval AND user acceptance
 */

export type CarePlanStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'CLINICIAN_APPROVED'
  | 'USER_ACCEPTED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REVISED'
  | 'COMPLETED'
  | 'RETIRED'
  | 'SUPERSEDED';

export type CarePlanAction =
  | 'propose'
  | 'approve'
  | 'retire'
  | 'accept'
  | 'activate'
  | 'pause'
  | 'revise'
  | 'complete'
  | 'resume';

export const CARE_PLAN_TRANSITIONS: Record<CarePlanStatus, Partial<Record<CarePlanAction, CarePlanStatus>>> = {
  DRAFT: {
    propose: 'PROPOSED',
    retire: 'RETIRED',
  },
  PROPOSED: {
    approve: 'CLINICIAN_APPROVED',
    retire: 'RETIRED',
  },
  CLINICIAN_APPROVED: {
    accept: 'USER_ACCEPTED',
    retire: 'RETIRED',
  },
  USER_ACCEPTED: {
    activate: 'ACTIVE',
    retire: 'RETIRED',
  },
  ACTIVE: {
    pause: 'PAUSED',
    revise: 'REVISED',
    complete: 'COMPLETED',
    retire: 'RETIRED',
  },
  PAUSED: {
    resume: 'ACTIVE',
    retire: 'RETIRED',
  },
  REVISED: {
    propose: 'PROPOSED',
    retire: 'RETIRED',
  },
  COMPLETED: {
    retire: 'RETIRED',
  },
  RETIRED: {},
  SUPERSEDED: {},
};

const TERMINAL_CARE_PLAN_STATUSES: ReadonlySet<CarePlanStatus> = new Set(['RETIRED', 'SUPERSEDED']);

/**
 * Validate a proposed care-plan state transition.
 * Returns a discriminated union: { valid: true; nextStatus } | { valid: false; error }
 */
export function validateCarePlanTransition(
  currentStatus: CarePlanStatus,
  action: CarePlanAction
): { valid: true; nextStatus: CarePlanStatus } | { valid: false; error: string } {
  const transitionsForState = CARE_PLAN_TRANSITIONS[currentStatus];
  const nextStatus = transitionsForState[action];

  if (nextStatus === undefined) {
    return {
      valid: false,
      error: `Invalid care-plan transition: cannot perform action "${action}" from status "${currentStatus}".`,
    };
  }

  return { valid: true, nextStatus };
}

/**
 * Type guard — returns true if the status is a terminal care-plan state.
 */
export function isTerminalCarePlanStatus(status: CarePlanStatus): boolean {
  return TERMINAL_CARE_PLAN_STATUSES.has(status);
}

/**
 * Guard: AI may not modify an ACTIVE care plan.
 * Returns { allowed: true } | { allowed: false; reason: string }
 */
export function canAiModifyCarePlan(
  currentStatus: CarePlanStatus
): { allowed: true } | { allowed: false; reason: string } {
  if (currentStatus === 'ACTIVE') {
    return { allowed: false, reason: 'AI cannot modify an ACTIVE care plan. Human clinician review is required.' };
  }
  return { allowed: true };
}

/**
 * Guard: the 'approve' action requires a clinician role.
 * Returns { allowed: true } | { allowed: false; reason: string }
 */
export function canApproveCarePlan(
  actorRole: string
): { allowed: true } | { allowed: false; reason: string } {
  if (actorRole !== 'clinician') {
    return { allowed: false, reason: `Care-plan approval requires "clinician" role; actor role: "${actorRole}".` };
  }
  return { allowed: true };
}
