import { MockModelGateway, FallbackModelGateway } from '@/domain/ai';
import type { ModelGateway } from '@/domain/ai';
import { InMemoryRepository } from '@/domain/repositories';
import type { CheckInSession, SafetyAssessment } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
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
  };
}
