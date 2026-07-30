// ─── AI / Model Gateway ────────────────────────────────────────────────────────
export {
  AIOutputSchema,
  StructuredCheckInSchema,
  SAFE_FALLBACK,
  MockModelGateway,
  FallbackModelGateway,
} from './ai';
export type {
  AIOutput,
  StructuredCheckIn,
  ModelGateway,
  ModelGatewayContext,
} from './ai';

// ─── State Machines ────────────────────────────────────────────────────────────
export {
  CHECK_IN_TRANSITIONS,
  validateCheckInTransition,
  isTerminalCheckInStatus,
  CONTENT_REVIEW_TRANSITIONS,
  validateContentReviewTransition,
  isTerminalContentReviewStatus,
  HANDOFF_TRANSITIONS,
  validateHandoffTransition,
  isTerminalHandoffStatus,
  canSendHandoff,
  CARE_PLAN_TRANSITIONS,
  validateCarePlanTransition,
  isTerminalCarePlanStatus,
  canAiModifyCarePlan,
  canApproveCarePlan,
} from './state-machines';
export type {
  CheckInStatus,
  CheckInAction,
  ContentReviewStatus,
  ContentReviewAction,
  HandoffStatus,
  HandoffAction,
  ConsentRecordForGuard,
  CarePlanStatus,
  CarePlanAction,
} from './state-machines';

// ─── Repositories / Entity Types ───────────────────────────────────────────────
export {
  InMemoryRepository,
  SEED_PROFILES,
  SEED_USER_PREFERENCES,
  SEED_PROVIDERS,
  SEED_CONTENT_MODULES,
  SEED_CONTENT_MODULE_VERSIONS,
  SEED_CARE_PLANS,
  SEED_CARE_PLAN_VERSIONS,
} from './repositories';
export type {
  Profile,
  UserPreferences,
  ConsentRecord,
  CheckInSession,
  SafetyAssessment,
  ContentModule,
  ContentModuleVersion,
  Provider,
  Handoff,
  CarePlan,
  CarePlanVersion,
  AuditEvent,
  Repository,
} from './repositories';

// ─── Audit ─────────────────────────────────────────────────────────────────────
export { InMemoryAuditLogger } from './audit';
export type { AuditLogger } from './audit';
