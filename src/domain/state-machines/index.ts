export {
  CHECK_IN_TRANSITIONS,
  validateCheckInTransition,
  isTerminalCheckInStatus,
} from './check-in';
export type { CheckInStatus, CheckInAction } from './check-in';

export {
  CONTENT_REVIEW_TRANSITIONS,
  validateContentReviewTransition,
  isTerminalContentReviewStatus,
} from './content-review';
export type { ContentReviewStatus, ContentReviewAction } from './content-review';

export {
  HANDOFF_TRANSITIONS,
  validateHandoffTransition,
  isTerminalHandoffStatus,
  canSendHandoff,
} from './handoff';
export type { HandoffStatus, HandoffAction, ConsentRecordForGuard } from './handoff';

export {
  CARE_PLAN_TRANSITIONS,
  validateCarePlanTransition,
  isTerminalCarePlanStatus,
  canAiModifyCarePlan,
  canApproveCarePlan,
} from './care-plan';
export type { CarePlanStatus, CarePlanAction } from './care-plan';
