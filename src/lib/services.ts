import { MockModelGateway, FallbackModelGateway } from '@/domain/ai';
import type { ModelGateway } from '@/domain/ai';
import { InMemoryRepository } from '@/domain/repositories';
import type { CheckInSession, SafetyAssessment, Provider, Handoff, Repository } from '@/domain/repositories';
import { SEED_PROVIDERS } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import type { AuditLogger } from '@/domain/audit';
import { env } from '@/lib/config/env';

/**
 * Service container — creates all dependencies and wires them together.
 * Used by API route handlers. Supports in-memory (default) and Supabase persistence.
 *
 * Each call to createServices() returns FRESH gateway instances for request isolation;
 * repositories are shared singletons to maintain state across API calls.
 */
export interface Services {
  modelGateway: ModelGateway;
  fallbackGateway: ModelGateway;
  sessionRepo: Repository<CheckInSession>;
  safetyAssessmentRepo: Repository<SafetyAssessment>;
  providerRepo: Repository<Provider>;
  handoffRepo: Repository<Handoff>;
  auditLogger: AuditLogger;
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

/* ------------------------------------------------------------------ */
/*  In-memory singletons (default persistence mode)                   */
/* ------------------------------------------------------------------ */

const memSessionRepo = new InMemoryRepository<CheckInSession>();
const memSafetyAssessmentRepo = new InMemoryRepository<SafetyAssessment>();
const memProviderRepo = new InMemoryRepository<Provider>();
memProviderRepo.seed(SEED_PROVIDERS);
const memHandoffRepo = new InMemoryRepository<Handoff>();
const memAuditLogger = new InMemoryAuditLogger();

/* ------------------------------------------------------------------ */
/*  Supabase singletons — lazy-initialised only when needed           */
/* ------------------------------------------------------------------ */

let supabaseRepos: {
  sessionRepo: Repository<CheckInSession>;
  safetyAssessmentRepo: Repository<SafetyAssessment>;
  providerRepo: Repository<Provider>;
  handoffRepo: Repository<Handoff>;
  auditLogger: AuditLogger;
} | null = null;

function getSupabaseRepos() {
  if (!supabaseRepos) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseSessionRepository } = require('@/infrastructure/database/repositories/supabase-session-repository');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseProviderRepository } = require('@/infrastructure/database/repositories/supabase-provider-repository');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseHandoffRepository } = require('@/infrastructure/database/repositories/supabase-handoff-repository');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseAuditLogger } = require('@/infrastructure/database/supabase-audit-logger');

    supabaseRepos = {
      sessionRepo: new SupabaseSessionRepository(),
      safetyAssessmentRepo: memSafetyAssessmentRepo, // No Supabase adapter — falls back to in-memory
      providerRepo: new SupabaseProviderRepository(),
      handoffRepo: new SupabaseHandoffRepository(),
      auditLogger: new SupabaseAuditLogger(),
    };
  }
  return supabaseRepos;
}

/**
 * Create services for the current request.
 * Model gateways are created per-request; repositories are shared singletons.
 * When MANAS_PERSISTENCE=supabase, Supabase adapter modules are loaded via
 * require() so that memory mode never bundles Supabase dependencies.
 */
export function createServices(): Services {
  const gateway = createModelGateway();
  const fallback = new FallbackModelGateway();

  if (env.MANAS_PERSISTENCE === 'supabase') {
    const repos = getSupabaseRepos();
    return {
      modelGateway: gateway,
      fallbackGateway: fallback,
      sessionRepo: repos.sessionRepo,
      safetyAssessmentRepo: repos.safetyAssessmentRepo,
      providerRepo: repos.providerRepo,
      handoffRepo: repos.handoffRepo,
      auditLogger: repos.auditLogger,
    };
  }

  // Default: in-memory mode — unchanged from original behaviour
  return {
    modelGateway: gateway,
    fallbackGateway: fallback,
    sessionRepo: memSessionRepo,
    safetyAssessmentRepo: memSafetyAssessmentRepo,
    providerRepo: memProviderRepo,
    handoffRepo: memHandoffRepo,
    auditLogger: memAuditLogger,
  };
}
