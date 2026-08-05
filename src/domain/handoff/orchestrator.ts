import { createHash } from 'crypto';
import type { Handoff, ConsentRecord, Provider, Repository } from '@/domain/repositories';
import type { StructuredCheckIn } from '@/domain/ai';
import type { AuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';
import { validateHandoffTransition } from '@/domain/state-machines';
import { InMemoryUnitOfWork } from './unit-of-work';
import { ConsentAndSendRequestSchema } from './schemas';
import type { ConsentAndSendRequest } from './schemas';

export function computePreviewHash(
  summary: Record<string, unknown>,
  excluded: string[],
): string {
  const payload = JSON.stringify({ summary, excluded });
  return createHash('sha256').update(payload).digest('hex');
}

export interface HandoffOrchestratorDeps {
  handoffRepo: Repository<Handoff>;
  consentRecordRepo: Repository<ConsentRecord>;
  auditLogger: AuditLogger;
  unitOfWorkFactory: () => InMemoryUnitOfWork;
  providerRepo?: Repository<Provider>;
}

export class HandoffOrchestrator {
  constructor(private deps: HandoffOrchestratorDeps) {}

  async createDraft(
    userId: string,
    providerId: string,
    structuredSummary: StructuredCheckIn,
    excludedEntries: string[] = []
  ): Promise<Handoff> {
    const handoffId = crypto.randomUUID();
    const handoff: Handoff = {
      id: handoffId,
      userId,
      providerId,
      status: 'DRAFT',
      structuredSummary,
      excludedEntries,
      createdAt: new Date(),
      version: 1,
    };

    await this.deps.handoffRepo.create(handoff);

    await this.deps.auditLogger.log({
      requestId: handoffId,
      userId,
      actor: 'user',
      eventType: AuditEventType.HANDOFF_DRAFT_CREATED,
      details: { handoffId, providerId },
    });

    return handoff;
  }

  async submitForReview(handoffId: string, userId: string): Promise<Handoff> {
    const handoff = await this.deps.handoffRepo.findById(handoffId);
    if (!handoff) {
      throw new Error(`Handoff "${handoffId}" not found.`);
    }
    if (handoff.userId !== userId) {
      throw new Error(`Handoff "${handoffId}" does not belong to user "${userId}".`);
    }
    if (handoff.status !== 'DRAFT') {
      throw new Error(`Handoff "${handoffId}" is not in DRAFT status (current: "${handoff.status}").`);
    }

    const transition = validateHandoffTransition('DRAFT', 'submit_for_review');
    if (!transition.valid) {
      throw new Error(transition.error);
    }

    const updated = await this.deps.handoffRepo.update(handoffId, { status: 'USER_REVIEW' });

    await this.deps.auditLogger.log({
      requestId: handoffId,
      userId,
      actor: 'user',
      eventType: AuditEventType.HANDOFF_SUBMITTED_FOR_REVIEW,
      details: { handoffId },
    });

    return updated;
  }

  async consentAndSend(
    handoffId: string,
    userId: string,
    request: ConsentAndSendRequest
  ): Promise<{ handoff: Handoff; consentRecord: ConsentRecord }> {
    // Validate request schema
    ConsentAndSendRequestSchema.parse(request);

    const handoff = await this.deps.handoffRepo.findById(handoffId);
    if (!handoff) {
      throw new Error(`Handoff "${handoffId}" not found.`);
    }
    if (handoff.userId !== userId) {
      throw new Error(`Handoff "${handoffId}" does not belong to user "${userId}".`);
    }

    // Idempotency: if already SENT, return existing
    if (handoff.status === 'SENT') {
      const consentRecords = await this.deps.consentRecordRepo.findAll({ handoffId });
      const existing = consentRecords.find(r => r.status === 'GRANTED');
      if (existing) {
        return { handoff, consentRecord: existing };
      }
    }

    if (handoff.status !== 'USER_REVIEW') {
      throw new Error(`Handoff "${handoffId}" is not in USER_REVIEW status (current: "${handoff.status}").`);
    }

    // Verify provider exists and is fictional demo
    if (this.deps.providerRepo) {
      const provider = await this.deps.providerRepo.findById(handoff.providerId);
      if (!provider) {
        throw new Error(`Provider "${handoff.providerId}" not found.`);
      }
      if (!provider.isFictionalDemo) {
        throw new Error(`Provider "${handoff.providerId}" is not a fictional demo provider.`);
      }
    }

    // Server-side hash verification
    const expectedHash = computePreviewHash(
      handoff.structuredSummary as Record<string, unknown>,
      handoff.excludedEntries,
    );
    if (request.previewHash !== expectedHash) {
      throw new Error(
        'Preview hash mismatch: the handoff content has changed since the preview was generated.',
      );
    }

    const unitOfWork = this.deps.unitOfWorkFactory();

    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      userId,
      consentType: 'handoff_send',
      status: 'GRANTED',
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      scope: {
        handoffId,
        handoffVersion: handoff.version,
        providerId: handoff.providerId,
        consentVersion: request.consentVersion,
        previewHash: expectedHash,
      },
      handoffId,
    };

    unitOfWork.prepare({
      type: 'create',
      repo: this.deps.consentRecordRepo as Repository<{ id: string }>,
      entity: consentRecord,
    });

    unitOfWork.prepare({
      type: 'update',
      repo: this.deps.handoffRepo as Repository<{ id: string }>,
      id: handoffId,
      updates: { status: 'CONSENTED' },
    });

    unitOfWork.prepare({
      type: 'update',
      repo: this.deps.handoffRepo as Repository<{ id: string }>,
      id: handoffId,
      updates: { status: 'SENT', sentAt: new Date() },
    });

    unitOfWork.prepare({
      type: 'audit',
      auditLogger: this.deps.auditLogger,
      event: {
        requestId: handoffId,
        userId,
        actor: 'user',
        eventType: AuditEventType.HANDOFF_CONSENT_GRANTED,
        details: { handoffId, consentRecordId: consentRecord.id },
      },
    });

    unitOfWork.prepare({
      type: 'audit',
      auditLogger: this.deps.auditLogger,
      event: {
        requestId: handoffId,
        userId,
        actor: 'system',
        eventType: AuditEventType.HANDOFF_SENT,
        details: { handoffId, providerId: handoff.providerId },
      },
    });

    try {
      await unitOfWork.commit();
    } catch (error) {
      await unitOfWork.rollback();
      throw error;
    }

    const updatedHandoff = await this.deps.handoffRepo.findById(handoffId);
    if (!updatedHandoff) {
      throw new Error(`Handoff "${handoffId}" not found after commit.`);
    }

    return { handoff: updatedHandoff, consentRecord };
  }
}
