/**
 * Check-In State Machine
 *
 * States: INITIATED | IN_PROGRESS | COMPLETED | SUMMARIZED
 *
 * Transitions:
 *   INITIATED   → IN_PROGRESS  (first_message)
 *   IN_PROGRESS → IN_PROGRESS  (subsequent_message)
 *   IN_PROGRESS → COMPLETED    (complete: 6 turns or user ends)
 *   COMPLETED   → SUMMARIZED   (summary_stored)
 *
 * Invalid: SUMMARIZED → any, COMPLETED → IN_PROGRESS
 */

export type CheckInStatus = 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUMMARIZED';
export type CheckInAction = 'first_message' | 'subsequent_message' | 'complete' | 'summary_stored';

export const CHECK_IN_TRANSITIONS: Record<CheckInStatus, Partial<Record<CheckInAction, CheckInStatus>>> = {
  INITIATED: {
    first_message: 'IN_PROGRESS',
  },
  IN_PROGRESS: {
    subsequent_message: 'IN_PROGRESS',
    complete: 'COMPLETED',
  },
  COMPLETED: {
    summary_stored: 'SUMMARIZED',
  },
  SUMMARIZED: {},
};

const TERMINAL_CHECK_IN_STATUSES: ReadonlySet<CheckInStatus> = new Set(['SUMMARIZED']);

/**
 * Validate a proposed check-in state transition.
 * Returns a discriminated union: { valid: true; nextStatus } | { valid: false; error }
 */
export function validateCheckInTransition(
  currentStatus: CheckInStatus,
  action: CheckInAction
): { valid: true; nextStatus: CheckInStatus } | { valid: false; error: string } {
  const transitionsForState = CHECK_IN_TRANSITIONS[currentStatus];
  const nextStatus = transitionsForState[action];

  if (nextStatus === undefined) {
    return {
      valid: false,
      error: `Invalid check-in transition: cannot perform action "${action}" from status "${currentStatus}".`,
    };
  }

  return { valid: true, nextStatus };
}

/**
 * Type guard — returns true if the status is a terminal check-in state.
 */
export function isTerminalCheckInStatus(status: CheckInStatus): boolean {
  return TERMINAL_CHECK_IN_STATUSES.has(status);
}
