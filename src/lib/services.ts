import { MockModelGateway, FallbackModelGateway } from '@/domain/ai';
import type { ModelGateway } from '@/domain/ai';
import { InMemoryRepository } from '@/domain/repositories';
import type {
  CheckInSession,
  SafetyAssessment,
  Handoff,
  ConsentRecord,
  CarePlan,
  CarePlanVersion,
  Provider,
  Profile,
} from '@/domain/repositories';
import {
  SEED_PROFILES,
  SEED_PROVIDERS,
  SEED_HANDOFFS,
  SEED_CONSENT_RECORDS,
  SEED_CARE_PLANS,
  SEED_CARE_PLAN_VERSIONS,
} from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { HandoffOrchestrator } from '@/domain/handoff';
import type { HandoffOrchestratorDeps } from '@/domain/handoff';
import { InMemoryUnitOfWork } from '@/domain/handoff';
import { CarePlanOrchestrator } from '@/domain/care-plan';
import type { CarePlanOrchestratorDeps } from '@/domain/care-plan';
import { env } from '@/lib/config/env';

/**
 * Service container — creates all dependencies and wires them together.
 * Used by API route handlers. In-memory repos are for local demo/tests only.
 *
 * Each call to createServices() returns FRESH instances for request isolation.
 */
export interface Services {
  modelGateway: ModelGateway;
  fallbackGateway: ModelGateway;
  sessionRepo: InMemoryRepository<CheckInSession>;
  safetyAssessmentRepo: InMemoryRepository<SafetyAssessment>;
  auditLogger: InMemoryAuditLogger;
  handoffRepo: InMemoryRepository<Handoff>;
  consentRecordRepo: InMemoryRepository<ConsentRecord>;
  carePlanRepo: InMemoryRepository<CarePlan>;
  carePlanVersionRepo: InMemoryRepository<CarePlanVersion>;
  providerRepo: InMemoryRepository<Provider>;
  profileRepo: InMemoryRepository<Profile>;
  unitOfWorkFactory: () => InMemoryUnitOfWork;
}

/**
 * Factory function for model gateway selection.
 * Uses dynamic import to avoid bundling Qwen provider in browser builds.
 */
function createModelGateway(): ModelGateway {
  if (env.MANAS_AI_PROVIDER === 'qwen' && env.ALIBABA_QWEN_API_KEY) {
    // Lazy-require to keep Qwen code out of the browser bundle.
    // This code path only runs server-side (API routes).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { QwenModelGateway } = require('@/infrastructure/model-providers/qwen') as typeof import('@/infrastructure/model-providers/qwen');
    return new QwenModelGateway();
  }
  return new MockModelGateway();
}

/**
 * Singleton repositories — shared across requests in the same process.
 * This is required for the in-memory implementation to maintain state across
 * API calls. The future Supabase adapter will replace these with a real DB.
 */
const sessionRepo = new InMemoryRepository<CheckInSession>();
const safetyAssessmentRepo = new InMemoryRepository<SafetyAssessment>();
const auditLogger = new InMemoryAuditLogger();
const handoffRepo = new InMemoryRepository<Handoff>();
const consentRecordRepo = new InMemoryRepository<ConsentRecord>();
const carePlanRepo = new InMemoryRepository<CarePlan>();
const carePlanVersionRepo = new InMemoryRepository<CarePlanVersion>();
const providerRepo = new InMemoryRepository<Provider>();
const profileRepo = new InMemoryRepository<Profile>();

// Seed demo data into singleton repositories (synchronous via .seed())
profileRepo.seed(SEED_PROFILES);
providerRepo.seed(SEED_PROVIDERS);
handoffRepo.seed(SEED_HANDOFFS);
consentRecordRepo.seed(SEED_CONSENT_RECORDS);
carePlanRepo.seed(SEED_CARE_PLANS);
carePlanVersionRepo.seed(SEED_CARE_PLAN_VERSIONS);

/**
 * Create services for the current request.
 * Model gateways are created per-request; repositories are shared singletons.
 */
export function createServices(): Services {
  const gateway = createModelGateway();
  const fallback = new FallbackModelGateway();

  return {
    modelGateway: gateway,
    fallbackGateway: fallback,
    sessionRepo,
    safetyAssessmentRepo,
    auditLogger,
    handoffRepo,
    consentRecordRepo,
    carePlanRepo,
    carePlanVersionRepo,
    providerRepo,
    profileRepo,
    unitOfWorkFactory: () => new InMemoryUnitOfWork(),
  };
}

/**
 * Create a HandoffOrchestrator wired to the given services.
 */
export function createHandoffOrchestrator(services: Services): HandoffOrchestrator {
  const deps: HandoffOrchestratorDeps = {
    handoffRepo: services.handoffRepo,
    consentRecordRepo: services.consentRecordRepo,
    auditLogger: services.auditLogger,
    unitOfWorkFactory: services.unitOfWorkFactory,
    providerRepo: services.providerRepo,
  };
  return new HandoffOrchestrator(deps);
}

/**
 * Create a CarePlanOrchestrator wired to the given services.
 */
export function createCarePlanOrchestrator(services: Services): CarePlanOrchestrator {
  const deps: CarePlanOrchestratorDeps = {
    carePlanRepo: services.carePlanRepo,
    carePlanVersionRepo: services.carePlanVersionRepo,
    handoffRepo: services.handoffRepo,
    auditLogger: services.auditLogger,
  };
  return new CarePlanOrchestrator(deps);
}
