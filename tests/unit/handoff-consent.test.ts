import { describe, it, expect, beforeEach } from 'vitest';
import { HandoffOrchestrator, computePreviewHash } from '@/domain/handoff';
import type { HandoffOrchestratorDeps } from '@/domain/handoff';
import { InMemoryUnitOfWork } from '@/domain/handoff';
import type { ConsentAndSendRequest } from '@/domain/handoff';
import { InMemoryRepository } from '@/domain/repositories';
import type { Handoff, ConsentRecord, Provider } from '@/domain/repositories';
import type { StructuredCheckIn } from '@/domain/ai';
import { InMemoryAuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SUMMARY: StructuredCheckIn = {
  primary_concern: 'Work stress',
  concern_duration: 'weeks',
  sleep_impact: 'mild',
  daily_functioning_impact: 'mild',
  support_preference: 'general_reflection',
  feels_safe: 'yes',
  key_points: ['feeling overwhelmed'],
};

const DEFAULT_EXCLUDED: string[] = [];

function buildConsentRequest(
  summary: Record<string, unknown> = TEST_SUMMARY as unknown as Record<string, unknown>,
  excluded: string[] = DEFAULT_EXCLUDED,
): ConsentAndSendRequest {
  return {
    explicitConsent: true,
    consentVersion: 'v1.0',
    previewHash: computePreviewHash(summary, excluded),
  };
}

function createDeps(): HandoffOrchestratorDeps {
  return {
    handoffRepo: new InMemoryRepository<Handoff>(),
    consentRecordRepo: new InMemoryRepository<ConsentRecord>(),
    auditLogger: new InMemoryAuditLogger(),
    unitOfWorkFactory: () => new InMemoryUnitOfWork(),
    providerRepo: new InMemoryRepository<Provider>(),
  };
}

async function seedProvider(deps: HandoffOrchestratorDeps): Promise<void> {
  await deps.providerRepo!.create({
    id: 'provider-dr-maya-rao',
    profileId: 'profile-dr-maya-rao',
    name: 'Dr. Maya Rao',
    title: 'Clinical Psychologist',
    languages: ['en'],
    focusAreas: ['stress'],
    availability: 'Mon-Fri',
    sessionType: 'Video',
    priceRange: '₹1,500',
    bio: 'Demo provider',
    isFictionalDemo: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HandoffOrchestrator', () => {
  let deps: HandoffOrchestratorDeps;
  let orchestrator: HandoffOrchestrator;

  beforeEach(async () => {
    deps = createDeps();
    orchestrator = new HandoffOrchestrator(deps);
    await seedProvider(deps);
  });

  it('createDraft creates handoff with DRAFT status and logs HANDOFF_DRAFT_CREATED', async () => {
    const handoff = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);

    expect(handoff).toBeDefined();
    expect(handoff.status).toBe('DRAFT');
    expect(handoff.userId).toBe('user-1');
    expect(handoff.providerId).toBe('provider-dr-maya-rao');
    expect(handoff.version).toBe(1);

    const events = await deps.auditLogger.findAll({ eventType: AuditEventType.HANDOFF_DRAFT_CREATED });
    expect(events.length).toBe(1);
    expect(events[0].details).toHaveProperty('handoffId', handoff.id);
  });

  it('submitForReview transitions DRAFT → USER_REVIEW', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    const submitted = await orchestrator.submitForReview(draft.id, 'user-1');

    expect(submitted.status).toBe('USER_REVIEW');

    const events = await deps.auditLogger.findAll({ eventType: AuditEventType.HANDOFF_SUBMITTED_FOR_REVIEW });
    expect(events.length).toBe(1);
  });

  it('consentAndSend happy path: USER_REVIEW → SENT with consent record and both audit events', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const result = await orchestrator.consentAndSend(draft.id, 'user-1', buildConsentRequest());

    expect(result.handoff.status).toBe('SENT');
    expect(result.handoff.sentAt).toBeInstanceOf(Date);
    expect(result.consentRecord.status).toBe('GRANTED');
    expect(result.consentRecord.handoffId).toBe(draft.id);

    const consentEvents = await deps.auditLogger.findAll({ eventType: AuditEventType.HANDOFF_CONSENT_GRANTED });
    const sentEvents = await deps.auditLogger.findAll({ eventType: AuditEventType.HANDOFF_SENT });
    expect(consentEvents.length).toBe(1);
    expect(sentEvents.length).toBe(1);
  });

  it('creating draft does not create consent record', async () => {
    await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);

    const consentRecords = await deps.consentRecordRepo.findAll();
    expect(consentRecords.length).toBe(0);
  });

  it('consent must be explicit (explicitConsent must be true literal)', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const req = buildConsentRequest();
    const invalidRequest = { ...req, explicitConsent: false as unknown as true };

    await expect(
      orchestrator.consentAndSend(draft.id, 'user-1', invalidRequest)
    ).rejects.toThrow();
  });

  it('consent scoped to handoff version (version mismatch rejected)', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const result = await orchestrator.consentAndSend(draft.id, 'user-1', buildConsentRequest());
    expect(result.consentRecord.scope).toHaveProperty('handoffVersion', 1);
  });

  it('consent scoped to preview hash (hash must be non-empty)', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const invalidRequest = { ...buildConsentRequest(), previewHash: '' };

    await expect(
      orchestrator.consentAndSend(draft.id, 'user-1', invalidRequest)
    ).rejects.toThrow();
  });

  it('rejects mismatched preview hash', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const badRequest = { ...buildConsentRequest(), previewHash: 'deadbeef' };

    await expect(
      orchestrator.consentAndSend(draft.id, 'user-1', badRequest)
    ).rejects.toThrow(/Preview hash mismatch/);
  });

  it('consent record contains the server-computed preview hash', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const expectedHash = computePreviewHash(
      TEST_SUMMARY as unknown as Record<string, unknown>,
      DEFAULT_EXCLUDED,
    );

    const result = await orchestrator.consentAndSend(draft.id, 'user-1', buildConsentRequest());
    expect(result.consentRecord.scope.previewHash).toBe(expectedHash);
  });

  it('forced failure after consent creation → no consent persists', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const failingUnit = new InMemoryUnitOfWork();
    failingUnit.failAt(0);
    (deps as { unitOfWorkFactory: () => InMemoryUnitOfWork }).unitOfWorkFactory = () => failingUnit;
    const failingOrchestrator = new HandoffOrchestrator(deps);

    await expect(
      failingOrchestrator.consentAndSend(draft.id, 'user-1', buildConsentRequest())
    ).rejects.toThrow(/Forced failure at stage 0/);

    const consentRecords = await deps.consentRecordRepo.findAll();
    expect(consentRecords.length).toBe(0);
  });

  it('forced failure after handoff transition → no transition persists', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const failingUnit = new InMemoryUnitOfWork();
    failingUnit.failAt(1);
    (deps as { unitOfWorkFactory: () => InMemoryUnitOfWork }).unitOfWorkFactory = () => failingUnit;
    const failingOrchestrator = new HandoffOrchestrator(deps);

    await expect(
      failingOrchestrator.consentAndSend(draft.id, 'user-1', buildConsentRequest())
    ).rejects.toThrow(/Forced failure at stage 1/);

    const handoff = await deps.handoffRepo.findById(draft.id);
    expect(handoff!.status).toBe('USER_REVIEW');
  });

  it('forced failure after first audit event → no events persist', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const failingUnit = new InMemoryUnitOfWork();
    failingUnit.failAt(3);
    (deps as { unitOfWorkFactory: () => InMemoryUnitOfWork }).unitOfWorkFactory = () => failingUnit;
    const failingOrchestrator = new HandoffOrchestrator(deps);

    await expect(
      failingOrchestrator.consentAndSend(draft.id, 'user-1', buildConsentRequest())
    ).rejects.toThrow(/Forced failure at stage 3/);

    const events = await deps.auditLogger.findAll();
    expect(events.length).toBe(2);
  });

  it('duplicate consentAndSend on SENT handoff → idempotent', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const req = buildConsentRequest();
    const result1 = await orchestrator.consentAndSend(draft.id, 'user-1', req);
    const result2 = await orchestrator.consentAndSend(draft.id, 'user-1', req);

    expect(result2.handoff.status).toBe('SENT');
    expect(result2.consentRecord.id).toBe(result1.consentRecord.id);

    const consentRecords = await deps.consentRecordRepo.findAll();
    expect(consentRecords.length).toBe(1);
  });

  it('unsent handoff not visible in clinician query', async () => {
    const draft = await orchestrator.createDraft('user-1', 'provider-dr-maya-rao', TEST_SUMMARY);
    await orchestrator.submitForReview(draft.id, 'user-1');

    const sentHandoffs = await deps.handoffRepo.findAll({ status: 'SENT' });
    expect(sentHandoffs.length).toBe(0);
  });
});
