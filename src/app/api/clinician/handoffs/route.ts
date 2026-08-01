import { NextResponse } from 'next/server';
import { createServices } from '@/lib/services';
import { AuditEventType } from '@/domain/audit';
import type { ConsentRecord } from '@/domain/repositories';
import { randomUUID } from 'node:crypto';

/**
 * Handoff statuses visible to clinicians.
 * A handoff becomes visible once it reaches SENT and remains visible
 * through CLINICIAN_ACCEPTED and COMPLETED.
 */
const CLINICIAN_VISIBLE_STATUSES: ReadonlySet<string> = new Set([
  'SENT',
  'CLINICIAN_ACCEPTED',
  'COMPLETED',
]);

/**
 * Demo-mode clinician profile ID.
 * In production this would come from the auth session.
 */
const DEMO_CLINICIAN_PROFILE_ID = 'profile-dr-maya-rao';

/**
 * Query the clinician inbox: returns SENT-or-later handoffs for providers
 * linked to the given clinician profile.
 *
 * Exported so integration tests can exercise the same logic without HTTP.
 */
export async function getClinicianInboxHandoffs(
  clinicianProfileId: string,
  services: ReturnType<typeof createServices>,
) {
  // 1. Find all providers linked to this clinician profile
  const allProviders = await services.providerRepo.findAll();
  const linkedProviderIds = new Set(
    allProviders
      .filter((p) => p.profileId === clinicianProfileId)
      .map((p) => p.id),
  );

  if (linkedProviderIds.size === 0) {
    return [];
  }

  // 2. Get all handoffs and filter by providerId + visible status
  const allHandoffs = await services.handoffRepo.findAll();
  const visibleHandoffs = allHandoffs.filter(
    (h) =>
      linkedProviderIds.has(h.providerId) &&
      CLINICIAN_VISIBLE_STATUSES.has(h.status),
  );

  // 3. Build response: strip excludedEntries, attach consent metadata
  const results = await Promise.all(
    visibleHandoffs.map(async (handoff) => {
      const consentRecords = await services.consentRecordRepo.findAll({
        handoffId: handoff.id,
      } as Partial<ConsentRecord>);
      const consent = consentRecords[0] ?? null;

      return {
        id: handoff.id,
        userId: handoff.userId,
        providerId: handoff.providerId,
        status: handoff.status,
        sentAt: handoff.sentAt?.toISOString() ?? null,
        version: handoff.version,
        structuredSummary: handoff.structuredSummary,
        consent: consent
          ? {
              id: consent.id,
              status: consent.status,
              grantedAt: consent.grantedAt.toISOString(),
              expiresAt: consent.expiresAt.toISOString(),
            }
          : null,
      };
    }),
  );

  // 4. Log CLINICIAN_HANDOFF_OPENED for each handoff accessed (metadata only)
  for (const handoff of visibleHandoffs) {
    await services.auditLogger.log({
      requestId: randomUUID(),
      userId: clinicianProfileId,
      actor: clinicianProfileId,
      eventType: AuditEventType.CLINICIAN_HANDOFF_OPENED,
      details: {
        handoffId: handoff.id,
        clinicianProfileId,
      },
    });
  }

  return results;
}

/**
 * GET /api/clinician/handoffs
 *
 * Returns SENT-or-later handoffs assigned to the demo clinician's linked provider.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();
    const handoffs = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );

    return NextResponse.json({ handoffs });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
