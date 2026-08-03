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
  CompleteCheckInResponse,
  ModelGateway,
  ModelGatewayContext,
} from './ai';

// ─── Wellbeing / Proactive Companion Engine ────────────────────────────────────
export {
  ProactiveWellbeingEngine,
  CONCERN_ARCHETYPES,
  getArchetype,
  listArchetypes,
  WELLBEING_TECHNIQUES,
  getTechniqueById,
  getTechniquesForArchetype,
  listTechniques,
  getCitationsForTechniqueIds,
  inferSymptoms,
  applyUserSeverity,
  refineSymptomText,
  StaticCitationService,
  WebCitationService,
  HybridCitationService,
  buildCitationQuery,
} from './wellbeing';
export type {
  ConcernArchetype,
  ArchetypeDefinition,
  Technique,
  Citation,
  InferredSymptom,
  CitationService,
  CitationQuery,
  CitationResult,
  ProactiveEngineInput,
  ProactiveResponse,
  PreviousSessionContext,
} from './wellbeing';

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
  SEED_HANDOFFS,
  SEED_CONSENT_RECORDS,
  SEED_USER_ACCOUNTS,
  SEED_PROFESSIONAL_ACCOUNTS,
  SEED_SYMPTOM_ENTRIES,
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
  UserAccount,
  ProfessionalAccount,
  SymptomEntry,
  SymptomCategory,
  SymptomSeverity,
  SymptomFrequency,
} from './repositories';

// ─── Audit ─────────────────────────────────────────────────────────────────────
export { InMemoryAuditLogger, AuditEventType } from './audit';
export type { AuditLogger } from './audit';

// ─── Auth ──────────────────────────────────────────────────────────────────────
export { AuthService, hashPassword, verifyPassword } from './auth';
export type { AuthServiceDeps, UserRegistrationInput, AuthResult, SessionPayload } from './auth';
export { createSession, getSession, clearSession, requireUser, requireProfessional } from './auth';

// ─── Symptoms ──────────────────────────────────────────────────────────────────
export { SymptomService } from './symptoms';
export type { SymptomServiceDeps, RecordSymptomInput } from './symptoms';

// ─── Chatbot ───────────────────────────────────────────────────────────────────
export { ChatbotService, ChatbotResponseSchema } from './chatbot';
export type { ChatbotServiceDeps, ChatMessage, ChatbotResponse } from './chatbot';

// ─── Safety ────────────────────────────────────────────────────────────────────
export { checkPreGenSafety, checkPostGenSafety } from './safety';
export { determineRouting } from './safety';
export { SAFETY_POLICY_VERSION } from './safety';
export type {
  RoutingState,
  RoutingDecision,
  SafetyAction,
  PreGenSafetyResult,
  PostGenSafetyResult,
} from './safety';

// ─── Check-In ──────────────────────────────────────────────────────────────────
export { CheckInOrchestrator } from './check-in';
export type {
  StepResult,
  DraftCompleteResult,
  ConfirmResult,
  CheckInOrchestratorDeps,
} from './check-in';

// ─── Handoff ───────────────────────────────────────────────────────────────────
export { HandoffOrchestrator, InMemoryUnitOfWork } from './handoff';
export type { HandoffOrchestratorDeps } from './handoff';
export {
  ConsentAndSendRequestSchema,
  CreateHandoffRequestSchema,
} from './handoff';
export type { ConsentAndSendRequest, CreateHandoffRequest } from './handoff';

// ─── Care Plan ─────────────────────────────────────────────────────────────────
export { CarePlanOrchestrator } from './care-plan';
export type { CarePlanOrchestratorDeps } from './care-plan';
export {
  GoalSchema,
  CreateCarePlanRequestSchema,
  TransitionCarePlanRequestSchema,
} from './care-plan';
export type { CreateCarePlanRequest, TransitionCarePlanRequest } from './care-plan';
