/**
 * Content Review State Machine (P0 scope)
 *
 * States: DRAFT | PENDING_CLINICAL_REVIEW
 *
 * Transitions:
 *   DRAFT → PENDING_CLINICAL_REVIEW  (submit_for_review)
 *
 * Note: Full lifecycle (APPROVED, CHANGES_REQUESTED, SUSPENDED, RETIRED)
 *       is deferred to post-hackathon blueprint.
 *
 * AI constraint: AI creates DRAFT only.
 * Content compiler creates: DRAFT or PENDING_CLINICAL_REVIEW only.
 */

export type ContentReviewStatus = 'DRAFT' | 'PENDING_CLINICAL_REVIEW';
export type ContentReviewAction = 'submit_for_review';

export const CONTENT_REVIEW_TRANSITIONS: Record<ContentReviewStatus, Partial<Record<ContentReviewAction, ContentReviewStatus>>> = {
  DRAFT: {
    submit_for_review: 'PENDING_CLINICAL_REVIEW',
  },
  PENDING_CLINICAL_REVIEW: {},
};

const TERMINAL_CONTENT_REVIEW_STATUSES: ReadonlySet<ContentReviewStatus> = new Set(['PENDING_CLINICAL_REVIEW']);

/**
 * Validate a proposed content-review state transition.
 * Returns a discriminated union: { valid: true; nextStatus } | { valid: false; error }
 */
export function validateContentReviewTransition(
  currentStatus: ContentReviewStatus,
  action: ContentReviewAction
): { valid: true; nextStatus: ContentReviewStatus } | { valid: false; error: string } {
  const transitionsForState = CONTENT_REVIEW_TRANSITIONS[currentStatus];
  const nextStatus = transitionsForState[action];

  if (nextStatus === undefined) {
    return {
      valid: false,
      error: `Invalid content-review transition: cannot perform action "${action}" from status "${currentStatus}".`,
    };
  }

  return { valid: true, nextStatus };
}

/**
 * Type guard — returns true if the status is a terminal content-review state (P0 scope).
 * In P0, PENDING_CLINICAL_REVIEW is terminal because the full lifecycle is deferred.
 */
export function isTerminalContentReviewStatus(status: ContentReviewStatus): boolean {
  return TERMINAL_CONTENT_REVIEW_STATUSES.has(status);
}
