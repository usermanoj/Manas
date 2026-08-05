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
  ContentModule,
  ContentModuleVersion,
  UserAccount,
  ProfessionalAccount,
  SymptomEntry,
} from '@/domain/repositories';
import {
  SEED_PROFILES,
  SEED_PROVIDERS,
  SEED_HANDOFFS,
  SEED_CONSENT_RECORDS,
  SEED_CONTENT_MODULES,
  SEED_CONTENT_MODULE_VERSIONS,
  SEED_USER_ACCOUNTS,
  SEED_PROFESSIONAL_ACCOUNTS,
  SEED_SYMPTOM_ENTRIES,
} from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { HandoffOrchestrator } from '@/domain/handoff';
import type { HandoffOrchestratorDeps } from '@/domain/handoff';
import { InMemoryUnitOfWork } from '@/domain/handoff';
import { CarePlanOrchestrator } from '@/domain/care-plan';
import type { CarePlanOrchestratorDeps } from '@/domain/care-plan';
import { ContentModuleOrchestrator } from '@/domain/content';
import type { ContentModuleOrchestratorDeps } from '@/domain/content';
import { AuthService } from '@/domain/auth';
import type { AuthServiceDeps } from '@/domain/auth';
import { SymptomService } from '@/domain/symptoms';
import type { SymptomServiceDeps } from '@/domain/symptoms';
import { ChatbotService } from '@/domain/chatbot';
import type { ChatbotServiceDeps } from '@/domain/chatbot';
import { ProactiveWellbeingEngine } from '@/domain/wellbeing';
import { CheckInOrchestrator } from '@/domain/check-in';
import type { CheckInOrchestratorDeps } from '@/domain/check-in';
import { FileBackedUserAccountRepository } from '@/infrastructure/database/file-user-account-repository';
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
  contentModuleRepo: InMemoryRepository<ContentModule>;
  contentModuleVersionRepo: InMemoryRepository<ContentModuleVersion>;
  userAccountRepo: InMemoryRepository<UserAccount>;
  professionalAccountRepo: InMemoryRepository<ProfessionalAccount>;
  symptomEntryRepo: InMemoryRepository<SymptomEntry>;
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
 *
 * Anchored on globalThis so dev-server hot reloads (which re-instantiate the
 * server module graph) do not silently wipe runtime state mid-demo.
 */
interface RepositoryStore {
  sessionRepo: InMemoryRepository<CheckInSession>;
  safetyAssessmentRepo: InMemoryRepository<SafetyAssessment>;
  auditLogger: InMemoryAuditLogger;
  handoffRepo: InMemoryRepository<Handoff>;
  consentRecordRepo: InMemoryRepository<ConsentRecord>;
  carePlanRepo: InMemoryRepository<CarePlan>;
  carePlanVersionRepo: InMemoryRepository<CarePlanVersion>;
  providerRepo: InMemoryRepository<Provider>;
  profileRepo: InMemoryRepository<Profile>;
  contentModuleRepo: InMemoryRepository<ContentModule>;
  contentModuleVersionRepo: InMemoryRepository<ContentModuleVersion>;
  userAccountRepo: FileBackedUserAccountRepository;
  professionalAccountRepo: InMemoryRepository<ProfessionalAccount>;
  symptomEntryRepo: InMemoryRepository<SymptomEntry>;
}

const globalStore = globalThis as unknown as { __manasRepositoryStore?: RepositoryStore };

function createRepositoryStore(): RepositoryStore {
  const store: RepositoryStore = {
    sessionRepo: new InMemoryRepository<CheckInSession>(),
    safetyAssessmentRepo: new InMemoryRepository<SafetyAssessment>(),
    auditLogger: new InMemoryAuditLogger(),
    handoffRepo: new InMemoryRepository<Handoff>(),
    consentRecordRepo: new InMemoryRepository<ConsentRecord>(),
    carePlanRepo: new InMemoryRepository<CarePlan>(),
    carePlanVersionRepo: new InMemoryRepository<CarePlanVersion>(),
    providerRepo: new InMemoryRepository<Provider>(),
    profileRepo: new InMemoryRepository<Profile>(),
    contentModuleRepo: new InMemoryRepository<ContentModule>(),
    contentModuleVersionRepo: new InMemoryRepository<ContentModuleVersion>(),
    // File-backed so runtime-registered accounts survive dev-server restarts.
    userAccountRepo: new FileBackedUserAccountRepository(SEED_USER_ACCOUNTS as UserAccount[]),
    professionalAccountRepo: new InMemoryRepository<ProfessionalAccount>(),
    symptomEntryRepo: new InMemoryRepository<SymptomEntry>(),
  };

  // Seed demo data into singleton repositories (synchronous via .seed())
  store.profileRepo.seed(SEED_PROFILES);
  store.providerRepo.seed(SEED_PROVIDERS);
  store.handoffRepo.seed(SEED_HANDOFFS);
  store.consentRecordRepo.seed(SEED_CONSENT_RECORDS);
  store.contentModuleRepo.seed(SEED_CONTENT_MODULES);
  store.contentModuleVersionRepo.seed(SEED_CONTENT_MODULE_VERSIONS);
  store.professionalAccountRepo.seed(SEED_PROFESSIONAL_ACCOUNTS as ProfessionalAccount[]);
  store.symptomEntryRepo.seed(SEED_SYMPTOM_ENTRIES);

  return store;
}

const repos: RepositoryStore = globalStore.__manasRepositoryStore ?? createRepositoryStore();
globalStore.__manasRepositoryStore = repos;

const {
  sessionRepo,
  safetyAssessmentRepo,
  auditLogger,
  handoffRepo,
  consentRecordRepo,
  carePlanRepo,
  carePlanVersionRepo,
  providerRepo,
  profileRepo,
  contentModuleRepo,
  contentModuleVersionRepo,
  userAccountRepo,
  professionalAccountRepo,
  symptomEntryRepo,
} = repos;

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
    contentModuleRepo,
    contentModuleVersionRepo,
    userAccountRepo,
    professionalAccountRepo,
    symptomEntryRepo,
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

/**
 * Create a ContentModuleOrchestrator wired to the given services.
 */
export function createContentModuleOrchestrator(services: Services): ContentModuleOrchestrator {
  const deps: ContentModuleOrchestratorDeps = {
    contentModuleRepo: services.contentModuleRepo,
    contentModuleVersionRepo: services.contentModuleVersionRepo,
    auditLogger: services.auditLogger,
  };
  return new ContentModuleOrchestrator(deps);
}

/**
 * Create an AuthService wired to the given services.
 */
export function createAuthService(services: Services): AuthService {
  const deps: AuthServiceDeps = {
    userAccountRepo: services.userAccountRepo,
    professionalAccountRepo: services.professionalAccountRepo,
    auditLogger: services.auditLogger,
  };
  return new AuthService(deps);
}

/**
 * Create a SymptomService wired to the given services.
 */
export function createSymptomService(services: Services): SymptomService {
  const deps: SymptomServiceDeps = {
    symptomEntryRepo: services.symptomEntryRepo,
    auditLogger: services.auditLogger,
  };
  return new SymptomService(deps);
}

/**
 * Create a ChatbotService wired to the given services.
 */
export function createChatbotService(services: Services): ChatbotService {
  const deps: ChatbotServiceDeps = {
    auditLogger: services.auditLogger,
  };
  return new ChatbotService(deps);
}

/**
 * Create a CheckInOrchestrator wired to the given services.
 */
export function createCheckInOrchestrator(services: Services): CheckInOrchestrator {
  const deps: CheckInOrchestratorDeps = {
    modelGateway: services.modelGateway,
    fallbackGateway: services.fallbackGateway,
    sessionRepo: services.sessionRepo,
    safetyAssessmentRepo: services.safetyAssessmentRepo,
    auditLogger: services.auditLogger,
    proactiveEngine: new ProactiveWellbeingEngine(),
    symptomEntryRepo: services.symptomEntryRepo,
  };
  return new CheckInOrchestrator(deps);
}
