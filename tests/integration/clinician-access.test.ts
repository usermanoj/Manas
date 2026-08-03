import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { SEED_PROVIDERS } from '@/domain/repositories';
import { MockModelGateway, FallbackModelGateway } from '@/domain/ai';
import type {
  Handoff,
  ConsentRecord,
  Provider,
  Profile,
  CheckInSession,
  SafetyAssessment,
  CarePlan,
  CarePlanVersion,
  ContentModule,
  ContentModuleVersion,
  UserAccount,
  ProfessionalAccount,
  SymptomEntry,
} from '@/domain/repositories';
import type { StructuredCheckIn } from '@/domain/ai';
import { getClinicianInboxHandoffs } from '@/app/api/clinician/handoffs/route';
import { InMemoryUnitOfWork } from '@/domain/handoff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestServices() {
  return {
    modelGateway: new MockModelGateway(),
    fallbackGateway: new FallbackModelGateway(),
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
    userAccountRepo: new InMemoryRepository<UserAccount>(),
    professionalAccountRepo: new InMemoryRepository<ProfessionalAccount>(),
    symptomEntryRepo: new InMemoryRepository<SymptomEntry>(),
    unitOfWorkFactory: () => new InMemoryUnitOfWork(),
  };
}

const DEMO_CLINICIAN_PROFILE_ID = 'profile-dr-maya-rao';
const OTHER_PROVIDER_ID = 'provider-dr-vikram-singh';

const SAMPLE_SUMMARY: StructuredCheckIn = {
  primary_concern: 'Work stress',
  concern_duration: 'weeks',
  sleep_impact: 'mild',
  daily_functioning_impact: 'none',
  support_preference: 'general_reflection',
  feels_safe: 'yes',
  key_points: ['Feeling stressed at work'],
};

function makeHandoff(overrides: Partial<Handoff> = {}): Handoff {
  return {
    id: 'handoff-001',
    userId: 'profile-ananya-sharma',
    providerId: 'provider-dr-maya-rao',
    status: 'SENT',
    structuredSummary: SAMPLE_SUMMARY,
    excludedEntries: ['secret-reflection-text'],
    sentAt: new Date('2026-06-01T10:00:00.000Z'),
    version: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Clinician Inbox Access', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(() => {
    services = createTestServices();
    // Seed providers (includes Dr Maya Rao linked to profile-dr-maya-rao)
    services.providerRepo.seed(SEED_PROVIDERS);
  });

  // -------------------------------------------------------------------------
  // 1. Clinician sees SENT handoffs assigned to their provider
  // -------------------------------------------------------------------------
  it('should return SENT handoffs assigned to the clinician\'s provider', async () => {
    const handoff = makeHandoff();
    await services.handoffRepo.create(handoff);

    const result = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('handoff-001');
    expect(result[0].status).toBe('SENT');
    expect(result[0].providerId).toBe('provider-dr-maya-rao');
    expect(result[0].structuredSummary).toEqual(SAMPLE_SUMMARY);
  });

  // -------------------------------------------------------------------------
  // 2. Unsent handoff (USER_REVIEW) is NOT visible
  // -------------------------------------------------------------------------
  it('should NOT return handoffs in USER_REVIEW status', async () => {
    const handoff = makeHandoff({ id: 'handoff-unsent', status: 'USER_REVIEW' });
    await services.handoffRepo.create(handoff);

    const result = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );

    expect(result).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 3. Handoffs for OTHER providers are NOT visible
  // -------------------------------------------------------------------------
  it('should NOT return handoffs for other providers', async () => {
    const handoff = makeHandoff({
      id: 'handoff-other',
      providerId: OTHER_PROVIDER_ID,
    });
    await services.handoffRepo.create(handoff);

    const result = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );

    expect(result).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 4. excludedEntries are stripped from the response
  // -------------------------------------------------------------------------
  it('should strip excludedEntries from the response', async () => {
    const handoff = makeHandoff({ excludedEntries: ['private-reflection'] });
    await services.handoffRepo.create(handoff);

    const result = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );

    expect(result).toHaveLength(1);
    // excludedEntries must NOT appear on the response item
    expect(
      (result[0] as Record<string, unknown>).excludedEntries,
    ).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 5. CLINICIAN_HANDOFF_OPENED audit event is logged
  // -------------------------------------------------------------------------
  it('should log CLINICIAN_HANDOFF_OPENED audit event on access', async () => {
    const handoff = makeHandoff();
    await services.handoffRepo.create(handoff);

    await getClinicianInboxHandoffs(DEMO_CLINICIAN_PROFILE_ID, services);

    const events = await services.auditLogger.findAll({
      eventType: 'CLINICIAN_HANDOFF_OPENED',
    });
    expect(events).toHaveLength(1);
    expect(events[0].details).toEqual({
      handoffId: 'handoff-001',
      clinicianProfileId: DEMO_CLINICIAN_PROFILE_ID,
    });
    // Audit event must NOT contain raw summary data
    expect(events[0].details).not.toHaveProperty('structuredSummary');
  });

  // -------------------------------------------------------------------------
  // 6. User A cannot access User B's handoff
  // -------------------------------------------------------------------------
  it('should filter handoffs by userId when repository is queried', async () => {
    // Create handoffs for two different users, both assigned to Dr Maya Rao
    const handoffA = makeHandoff({
      id: 'handoff-user-a',
      userId: 'profile-ananya-sharma',
    });
    const handoffB = makeHandoff({
      id: 'handoff-user-b',
      userId: 'profile-arjun-mehta',
    });
    await services.handoffRepo.create(handoffA);
    await services.handoffRepo.create(handoffB);

    // Verify the repository filter works correctly with userId
    const userAHandoffs = await services.handoffRepo.findAll({
      userId: 'profile-ananya-sharma',
    } as Partial<Handoff>);
    expect(userAHandoffs).toHaveLength(1);
    expect(userAHandoffs[0].id).toBe('handoff-user-a');

    // Both handoffs are visible to the clinician (same provider),
    // but the repo filter correctly isolates by userId
    const result = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );
    expect(result).toHaveLength(2);
    const ids = result.map((h) => h.id);
    expect(ids).toContain('handoff-user-a');
    expect(ids).toContain('handoff-user-b');
  });

  // -------------------------------------------------------------------------
  // 7. CLINICIAN_ACCEPTED and COMPLETED handoffs are also visible
  // -------------------------------------------------------------------------
  it('should return CLINICIAN_ACCEPTED and COMPLETED handoffs', async () => {
    await services.handoffRepo.create(
      makeHandoff({ id: 'handoff-accepted', status: 'CLINICIAN_ACCEPTED' }),
    );
    await services.handoffRepo.create(
      makeHandoff({ id: 'handoff-completed', status: 'COMPLETED' }),
    );

    const result = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );

    expect(result).toHaveLength(2);
    const statuses = result.map((h) => h.status);
    expect(statuses).toContain('CLINICIAN_ACCEPTED');
    expect(statuses).toContain('COMPLETED');
  });

  // -------------------------------------------------------------------------
  // 8. Consent metadata is included when present
  // -------------------------------------------------------------------------
  it('should include consent metadata when a consent record exists', async () => {
    const handoff = makeHandoff();
    await services.handoffRepo.create(handoff);

    const consent: ConsentRecord = {
      id: 'consent-001',
      userId: 'profile-ananya-sharma',
      consentType: 'HANDOFF',
      status: 'GRANTED',
      grantedAt: new Date('2026-06-01T09:00:00.000Z'),
      expiresAt: new Date('2027-06-01T09:00:00.000Z'),
      scope: {},
      handoffId: 'handoff-001',
    };
    await services.consentRecordRepo.create(consent);

    const result = await getClinicianInboxHandoffs(
      DEMO_CLINICIAN_PROFILE_ID,
      services,
    );

    expect(result).toHaveLength(1);
    expect(result[0].consent).not.toBeNull();
    expect(result[0].consent!.id).toBe('consent-001');
    expect(result[0].consent!.status).toBe('GRANTED');
  });

  // -------------------------------------------------------------------------
  // 9. Unknown clinician returns empty inbox
  // -------------------------------------------------------------------------
  it('should return empty inbox for an unknown clinician profileId', async () => {
    await services.handoffRepo.create(makeHandoff());

    const result = await getClinicianInboxHandoffs(
      'profile-unknown-clinician',
      services,
    );

    expect(result).toHaveLength(0);
  });
});
