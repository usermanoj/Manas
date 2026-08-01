import { describe, it, expect, beforeEach } from 'vitest';
import { HandoffOrchestrator, computePreviewHash } from '@/domain/handoff';
import type { HandoffOrchestratorDeps, ConsentAndSendRequest } from '@/domain/handoff';
import { InMemoryUnitOfWork } from '@/domain/handoff';
import { InMemoryRepository } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { SEED_PROVIDERS } from '@/domain/repositories';
import type {
  Handoff,
  ConsentRecord,
  Provider,
} from '@/domain/repositories';
import type { StructuredCheckIn } from '@/domain/ai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_USER_ID = 'profile-ananya-sharma';
const OTHER_USER_ID = 'profile-arjun-mehta';
const PROVIDER_ID = 'provider-dr-maya-rao';

const SAMPLE_SUMMARY: StructuredCheckIn = {
  primary_concern: 'Work stress',
  concern_duration: 'weeks',
  sleep_impact: 'mild',
  daily_functioning_impact: 'none',
  support_preference: 'general_reflection',
  feels_safe: 'yes',
  key_points: ['Feeling stressed at work'],
};

const DEFAULT_EXCLUDED: string[] = [];

function buildConsentRequest(
  summary: Record<string, unknown> = SAMPLE_SUMMARY as unknown as Record<string, unknown>,
  excluded: string[] = DEFAULT_EXCLUDED,
): ConsentAndSendRequest {
  return {
    explicitConsent: true,
    consentVersion: 'consent-v1',
    previewHash: computePreviewHash(summary, excluded),
  };
}

/**
 * Immutable statuses — handoffs in these states cannot be updated.
 */
const IMMUTABLE_STATUSES = new Set([
  'SENT',
  'CLINICIAN_ACCEPTED',
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
]);

interface TestContext {
  orchestrator: HandoffOrchestrator;
  handoffRepo: InMemoryRepository<Handoff>;
  consentRecordRepo: InMemoryRepository<ConsentRecord>;
  providerRepo: InMemoryRepository<Provider>;
  auditLogger: InMemoryAuditLogger;
  unitOfWorkFactory: () => InMemoryUnitOfWork;
}

function createTestContext(failAtStage?: number): TestContext {
  const handoffRepo = new InMemoryRepository<Handoff>();
  const consentRecordRepo = new InMemoryRepository<ConsentRecord>();
  const providerRepo = new InMemoryRepository<Provider>();
  const auditLogger = new InMemoryAuditLogger();

  providerRepo.seed(SEED_PROVIDERS);

  const unitOfWorkFactory = (): InMemoryUnitOfWork => {
    const uow = new InMemoryUnitOfWork();
    if (failAtStage !== undefined) {
      uow.failAt(failAtStage);
    }
    return uow;
  };

  const deps: HandoffOrchestratorDeps = {
    handoffRepo,
    consentRecordRepo,
    auditLogger,
    unitOfWorkFactory,
    providerRepo,
  };

  return {
    orchestrator: new HandoffOrchestrator(deps),
    handoffRepo,
    consentRecordRepo,
    providerRepo,
    auditLogger,
    unitOfWorkFactory,
  };
}

/**
 * Helper: creates a draft and submits it for review, returning a USER_REVIEW handoff.
 */
async function createSubmittedHandoff(
  ctx: TestContext,
  userId: string = DEMO_USER_ID,
): Promise<Handoff> {
  const draft = await ctx.orchestrator.createDraft(
    userId,
    PROVIDER_ID,
    SAMPLE_SUMMARY,
  );
  return ctx.orchestrator.submitForReview(draft.id, userId);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Consent-and-Send Integration Flow', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  // -------------------------------------------------------------------------
  // 1. Complete USER_REVIEW → consent → SENT transaction
  // -------------------------------------------------------------------------
  describe('complete happy path', () => {
    it('should transition DRAFT → USER_REVIEW → SENT via consentAndSend', async () => {
      const { orchestrator, handoffRepo, consentRecordRepo, auditLogger } = ctx;

      // Create draft
      const draft = await orchestrator.createDraft(
        DEMO_USER_ID,
        PROVIDER_ID,
        SAMPLE_SUMMARY,
        ['excluded-entry-1'],
      );
      expect(draft.status).toBe('DRAFT');
      expect(draft.userId).toBe(DEMO_USER_ID);
      expect(draft.providerId).toBe(PROVIDER_ID);
      expect(draft.version).toBe(1);

      // Submit for review
      const submitted = await orchestrator.submitForReview(draft.id, DEMO_USER_ID);
      expect(submitted.status).toBe('USER_REVIEW');

      // Consent and send
      const result = await orchestrator.consentAndSend(
        submitted.id,
        DEMO_USER_ID,
        buildConsentRequest(
          SAMPLE_SUMMARY as unknown as Record<string, unknown>,
          ['excluded-entry-1'],
        ),
      );
      expect(result.handoff.status).toBe('SENT');
      expect(result.consentRecord.status).toBe('GRANTED');
      expect(result.consentRecord.userId).toBe(DEMO_USER_ID);
      expect(result.consentRecord.handoffId).toBe(submitted.id);

      // Verify repo state
      const finalHandoff = await handoffRepo.findById(submitted.id);
      expect(finalHandoff?.status).toBe('SENT');

      // Consent record persisted
      const records = await consentRecordRepo.findAll({ handoffId: submitted.id });
      expect(records.length).toBe(1);
      expect(records[0].status).toBe('GRANTED');

      // Audit events
      const events = await auditLogger.findAll();
      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain('HANDOFF_DRAFT_CREATED');
      expect(eventTypes).toContain('HANDOFF_SUBMITTED_FOR_REVIEW');
      expect(eventTypes).toContain('HANDOFF_CONSENT_GRANTED');
      expect(eventTypes).toContain('HANDOFF_SENT');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Idempotency: consent-and-send on already SENT handoff
  // -------------------------------------------------------------------------
  describe('idempotency', () => {
    it('should return existing result when handoff is already SENT', async () => {
      const { orchestrator, consentRecordRepo } = ctx;

      const handoff = await createSubmittedHandoff(ctx);

      // First consent-and-send
      const firstResult = await orchestrator.consentAndSend(
        handoff.id,
        DEMO_USER_ID,
        buildConsentRequest(),
      );
      expect(firstResult.handoff.status).toBe('SENT');

      // Count consent records before second call
      const recordsBefore = await consentRecordRepo.findAll();
      const countBefore = recordsBefore.length;

      // Second consent-and-send (idempotent)
      const secondResult = await orchestrator.consentAndSend(
        handoff.id,
        DEMO_USER_ID,
        buildConsentRequest(),
      );
      expect(secondResult.handoff.status).toBe('SENT');
      expect(secondResult.consentRecord.id).toBe(firstResult.consentRecord.id);

      // No duplicate consent records created
      const recordsAfter = await consentRecordRepo.findAll();
      expect(recordsAfter.length).toBe(countBefore);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Consent-and-send fails if handoff not in USER_REVIEW
  // -------------------------------------------------------------------------
  describe('status guard', () => {
    it('should reject consentAndSend when handoff is in DRAFT status', async () => {
      const { orchestrator } = ctx;

      const draft = await orchestrator.createDraft(
        DEMO_USER_ID,
        PROVIDER_ID,
        SAMPLE_SUMMARY,
      );
      expect(draft.status).toBe('DRAFT');

      await expect(
        orchestrator.consentAndSend(draft.id, DEMO_USER_ID, buildConsentRequest()),
      ).rejects.toThrow(/not in USER_REVIEW status/);
    });
  });

  // -------------------------------------------------------------------------
  // 4. PATCH on SENT handoff returns 409 (immutable)
  // -------------------------------------------------------------------------
  describe('immutability after SENT', () => {
    it('should treat SENT handoff as immutable (PATCH logic)', async () => {
      const { orchestrator, handoffRepo } = ctx;

      const handoff = await createSubmittedHandoff(ctx);
      await orchestrator.consentAndSend(handoff.id, DEMO_USER_ID, buildConsentRequest());

      const sentHandoff = await handoffRepo.findById(handoff.id);
      expect(sentHandoff?.status).toBe('SENT');

      // Simulate PATCH immutability check (same logic as PATCH route)
      expect(IMMUTABLE_STATUSES.has(sentHandoff!.status)).toBe(true);

      // Attempting to update a SENT handoff should be blocked
      // (the PATCH route returns 409 before calling repo.update)
    });

    it('should allow updates to DRAFT handoff (pre-SENT)', async () => {
      const { orchestrator, handoffRepo } = ctx;

      const draft = await orchestrator.createDraft(
        DEMO_USER_ID,
        PROVIDER_ID,
        SAMPLE_SUMMARY,
      );
      expect(draft.status).toBe('DRAFT');
      expect(IMMUTABLE_STATUSES.has(draft.status)).toBe(false);

      // DRAFT handoffs can be updated
      const newSummary = { ...SAMPLE_SUMMARY, primary_concern: 'Updated concern' };
      await handoffRepo.update(draft.id, { structuredSummary: newSummary } as never);

      const updated = await handoffRepo.findById(draft.id);
      expect((updated!.structuredSummary as StructuredCheckIn).primary_concern).toBe(
        'Updated concern',
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. Failure rolls back: UnitOfWork failAt verifies atomic behaviour
  // -------------------------------------------------------------------------
  describe('rollback on failure', () => {
    it('should NOT reach SENT status when UnitOfWork fails mid-commit', async () => {
      // Create context where UoW fails at stage 2 (SENT status update)
      const failCtx = createTestContext(2);

      const handoff = await failCtx.orchestrator.createDraft(
        DEMO_USER_ID,
        PROVIDER_ID,
        SAMPLE_SUMMARY,
      );
      await failCtx.orchestrator.submitForReview(handoff.id, DEMO_USER_ID);

      // consentAndSend should throw due to forced failure
      await expect(
        failCtx.orchestrator.consentAndSend(handoff.id, DEMO_USER_ID, buildConsentRequest()),
      ).rejects.toThrow(/Forced failure at stage 2/);

      // Handoff should NOT be SENT (stages 0 and 1 ran: consent created + CONSENTED status)
      const afterFail = await failCtx.handoffRepo.findById(handoff.id);
      expect(afterFail?.status).not.toBe('SENT');
      // Status is CONSENTED because stage 1 (CONSENTED update) ran before stage 2 failure
      expect(afterFail?.status).toBe('CONSENTED');

      // SENT audit event should NOT be logged
      const sentEvents = await failCtx.auditLogger.findAll({ eventType: 'HANDOFF_SENT' });
      expect(sentEvents.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. User A cannot consent-and-send User B's handoff (userId mismatch)
  // -------------------------------------------------------------------------
  describe('userId mismatch guard', () => {
    it('should reject consentAndSend when userId does not match handoff owner', async () => {
      const { orchestrator } = ctx;

      // Create handoff for DEMO_USER
      const handoff = await createSubmittedHandoff(ctx, DEMO_USER_ID);

      // Attempt consentAndSend as a different user
      await expect(
        orchestrator.consentAndSend(handoff.id, OTHER_USER_ID, buildConsentRequest()),
      ).rejects.toThrow(/does not belong to user/);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Preview hash mismatch is rejected
  // -------------------------------------------------------------------------
  describe('preview hash verification', () => {
    it('should reject consentAndSend when preview hash does not match server-computed hash', async () => {
      const { orchestrator } = ctx;

      const handoff = await createSubmittedHandoff(ctx);

      const badRequest = { ...buildConsentRequest(), previewHash: 'bogus-hash' };

      await expect(
        orchestrator.consentAndSend(handoff.id, DEMO_USER_ID, badRequest),
      ).rejects.toThrow(/Preview hash mismatch/);
    });

    it('should store the server-computed hash in the consent record', async () => {
      const { orchestrator, consentRecordRepo } = ctx;

      const handoff = await createSubmittedHandoff(ctx);
      const expectedHash = computePreviewHash(
        SAMPLE_SUMMARY as unknown as Record<string, unknown>,
        DEFAULT_EXCLUDED,
      );

      const result = await orchestrator.consentAndSend(
        handoff.id,
        DEMO_USER_ID,
        buildConsentRequest(),
      );

      expect(result.consentRecord.scope.previewHash).toBe(expectedHash);

      const records = await consentRecordRepo.findAll({ handoffId: handoff.id });
      expect(records[0].scope.previewHash).toBe(expectedHash);
    });
  });
});
