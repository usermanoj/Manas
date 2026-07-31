import type { Handoff, Repository } from '@/domain/repositories';
import type { AuditLogger } from '@/domain/audit';
import type { StructuredCheckIn } from '@/domain/ai';
import { validateHandoffTransition } from '@/domain/state-machines';
import type { HandoffStatus, HandoffAction } from '@/domain/state-machines';
import { SAFETY_POLICY_VERSION } from '@/domain/safety';

// ---------------------------------------------------------------------------
// Dependency container
// ---------------------------------------------------------------------------

export interface HandoffServiceDeps {
  handoffRepo: Repository<Handoff>;
  auditLogger: AuditLogger;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Service functions — sole authority for handoff transitions
// ---------------------------------------------------------------------------

/**
 * Create a new DRAFT handoff from a confirmed structured summary.
 */
export async function createDraftHandoff(
  deps: HandoffServiceDeps,
  userId: string,
  providerId: string,
  structuredSummary: StructuredCheckIn,
  excludedEntries: string[] = [],
  userNote?: string,
): Promise<Handoff> {
  const handoff: Handoff = {
    id: generateId(),
    userId,
    providerId,
    status: 'DRAFT',
    structuredSummary,
    excludedEntries,
    userNote,
    version: 1,
  };

  const created = await deps.handoffRepo.create(handoff);

  await deps.auditLogger.log({
    requestId: created.id,
    userId,
    actor: 'user',
    eventType: 'HANDOFF_DRAFT_CREATED',
    details: { handoffId: created.id, providerId, excludedCount: excludedEntries.length },
    policyVersion: SAFETY_POLICY_VERSION,
  });

  return created;
}

/**
 * Update editable fields on a DRAFT handoff (structuredSummary and/or userNote).
 */
export async function updateHandoff(
  deps: HandoffServiceDeps,
  id: string,
  updates: { structuredSummary?: StructuredCheckIn; userNote?: string },
): Promise<Handoff> {
  const existing = await deps.handoffRepo.findById(id);
  if (!existing) throw new Error(`Handoff "${id}" not found.`);

  const updated = await deps.handoffRepo.update(id, {
    ...updates,
    version: existing.version + 1,
  });

  await deps.auditLogger.log({
    requestId: id,
    userId: existing.userId,
    actor: 'user',
    eventType: 'HANDOFF_EDITED',
    details: { handoffId: id },
    policyVersion: SAFETY_POLICY_VERSION,
  });

  return updated;
}

/**
 * Add a field key to the excludedEntries list.
 */
export async function excludeField(
  deps: HandoffServiceDeps,
  id: string,
  fieldKey: string,
): Promise<Handoff> {
  const existing = await deps.handoffRepo.findById(id);
  if (!existing) throw new Error(`Handoff "${id}" not found.`);

  const excludedEntries = [...existing.excludedEntries, fieldKey];
  const updated = await deps.handoffRepo.update(id, {
    excludedEntries,
    version: existing.version + 1,
  });

  await deps.auditLogger.log({
    requestId: id,
    userId: existing.userId,
    actor: 'user',
    eventType: 'HANDOFF_FIELD_EXCLUDED',
    details: { handoffId: id, fieldKey },
    policyVersion: SAFETY_POLICY_VERSION,
  });

  return updated;
}

/**
 * Transition a DRAFT handoff to USER_REVIEW via 'submit_for_review'.
 * Validates the state machine before persisting.
 */
export async function submitForReview(
  deps: HandoffServiceDeps,
  id: string,
): Promise<Handoff> {
  const existing = await deps.handoffRepo.findById(id);
  if (!existing) throw new Error(`Handoff "${id}" not found.`);

  const transition = validateHandoffTransition(
    existing.status as HandoffStatus,
    'submit_for_review' as HandoffAction,
  );
  if (!transition.valid) throw new Error(transition.error);

  const updated = await deps.handoffRepo.update(id, {
    status: transition.nextStatus,
    version: existing.version + 1,
  });

  await deps.auditLogger.log({
    requestId: id,
    userId: existing.userId,
    actor: 'user',
    eventType: 'HANDOFF_READY_FOR_REVIEW',
    details: { handoffId: id },
    policyVersion: SAFETY_POLICY_VERSION,
  });

  return updated;
}

/**
 * Build a preview of what will be shared: included fields, excluded fields,
 * and the optional userNote.
 */
export function buildPreview(handoff: Handoff): {
  includedFields: Record<string, unknown>;
  excludedFields: string[];
  userNote?: string;
} {
  const summary = handoff.structuredSummary;
  const allFields: Record<string, unknown> = {
    primary_concern: summary.primary_concern,
    concern_duration: summary.concern_duration,
    sleep_impact: summary.sleep_impact,
    daily_functioning_impact: summary.daily_functioning_impact,
    support_preference: summary.support_preference,
    feels_safe: summary.feels_safe,
    key_points: summary.key_points,
  };

  const excludedFields = handoff.excludedEntries;
  const includedFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(allFields)) {
    if (!excludedFields.includes(key)) {
      includedFields[key] = value;
    }
  }

  return { includedFields, excludedFields, userNote: handoff.userNote };
}
