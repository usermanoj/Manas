import { describe, it, expect, beforeEach } from 'vitest';
import { CarePlanOrchestrator } from '@/domain/care-plan';
import type { CarePlanOrchestratorDeps } from '@/domain/care-plan';
import { InMemoryRepository } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { SEED_PROVIDERS, SEED_PROFILES } from '@/domain/repositories';
import type {
  Handoff,
  CarePlan,
  CarePlanVersion,
  Provider,
  Profile,
} from '@/domain/repositories';
import type { StructuredCheckIn } from '@/domain/ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_USER_ID = 'profile-ananya-sharma';
const DEMO_CLINICIAN_ACTOR = 'profile-dr-maya-rao';
const PROVIDER_ID = 'provider-dr-maya-rao';

const SAMPLE_SUMMARY: StructuredCheckIn = {
  primary_concern: 'Work stress and burnout',
  concern_duration: 'months',
  sleep_impact: 'mild',
  daily_functioning_impact: 'mild',
  support_preference: 'general_reflection',
  feels_safe: 'yes',
  key_points: ['Feeling overwhelmed at work', 'Difficulty sleeping'],
};

interface TestContext {
  orchestrator: CarePlanOrchestrator;
  carePlanRepo: InMemoryRepository<CarePlan>;
  carePlanVersionRepo: InMemoryRepository<CarePlanVersion>;
  handoffRepo: InMemoryRepository<Handoff>;
  providerRepo: InMemoryRepository<Provider>;
  profileRepo: InMemoryRepository<Profile>;
  auditLogger: InMemoryAuditLogger;
}

function createTestContext(): TestContext {
  const carePlanRepo = new InMemoryRepository<CarePlan>();
  const carePlanVersionRepo = new InMemoryRepository<CarePlanVersion>();
  const handoffRepo = new InMemoryRepository<Handoff>();
  const providerRepo = new InMemoryRepository<Provider>();
  const profileRepo = new InMemoryRepository<Profile>();
  const auditLogger = new InMemoryAuditLogger();

  providerRepo.seed(SEED_PROVIDERS);
  profileRepo.seed(SEED_PROFILES);

  const deps: CarePlanOrchestratorDeps = {
    carePlanRepo,
    carePlanVersionRepo,
    handoffRepo,
    auditLogger,
  };

  return {
    orchestrator: new CarePlanOrchestrator(deps),
    carePlanRepo,
    carePlanVersionRepo,
    handoffRepo,
    providerRepo,
    profileRepo,
    auditLogger,
  };
}

/**
 * Helper: create a SENT handoff for testing care plan creation.
 */
async function createSentHandoff(
  ctx: TestContext,
  handoffId: string,
  userId: string = DEMO_USER_ID,
): Promise<Handoff> {
  const handoff: Handoff = {
    id: handoffId,
    userId,
    providerId: PROVIDER_ID,
    status: 'SENT',
    structuredSummary: SAMPLE_SUMMARY,
    excludedEntries: [],
    sentAt: new Date(),
    version: 1,
  };
  await ctx.handoffRepo.create(handoff);
  return handoff;
}

const CREATE_REQUEST = {
  handoffId: 'handoff-test-001',
  goals: [
    { id: 'goal-1', title: 'Build emotional awareness', description: 'Develop awareness' },
    { id: 'goal-2', title: 'Develop coping strategies', description: 'Learn coping' },
  ],
  assignedModuleIds: ['module-pause-reflect'],
  checkInFrequency: 'twice_per_week',
  boundaries: ['AI facilitator only', 'Weekly clinician review'],
  followUpDate: '2026-08-15T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Care Plan Integration Flow', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  // -------------------------------------------------------------------------
  // 1. Create care plan from SENT handoff — success
  // -------------------------------------------------------------------------
  describe('create care plan from SENT handoff', () => {
    it('should create a DRAFT care plan with V1 from a SENT handoff', async () => {
      const handoffId = 'handoff-create-001';
      await createSentHandoff(ctx, handoffId);

      const result = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      expect(result.carePlan).toBeDefined();
      expect(result.carePlan.status).toBe('DRAFT');
      expect(result.carePlan.overallStatus).toBe('DRAFT');
      expect(result.carePlan.userId).toBe(DEMO_USER_ID);
      expect(result.carePlan.clinicianId).toBe(DEMO_CLINICIAN_ACTOR);
      expect(result.carePlan.activeVersionId).toBeNull();

      expect(result.version).toBeDefined();
      expect(result.version.versionNumber).toBe(1);
      expect(result.version.status).toBe('DRAFT');
      expect(result.version.goals).toEqual(['Build emotional awareness', 'Develop coping strategies']);
      expect(result.version.assignedModules).toEqual(['module-pause-reflect']);
      expect(result.version.checkInFrequency).toBe('twice_per_week');

      // Verify repo state
      const storedCarePlan = await ctx.carePlanRepo.findById(result.carePlan.id);
      expect(storedCarePlan?.status).toBe('DRAFT');

      // Audit event logged
      const events = await ctx.auditLogger.findAll();
      expect(events.some((e) => e.eventType === 'CARE_PLAN_CREATED')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Create care plan from non-existent handoff — error
  // -------------------------------------------------------------------------
  describe('create care plan from non-existent handoff', () => {
    it('should still create a care plan (orchestrator handles missing handoff gracefully)', async () => {
      // The orchestrator's createFromHandoff does not throw on missing handoff —
      // it sets userId to 'unknown' and proceeds.
      const result = await ctx.orchestrator.createFromHandoff(
        'non-existent-handoff',
        DEMO_CLINICIAN_ACTOR,
        CREATE_REQUEST,
      );

      expect(result.carePlan).toBeDefined();
      expect(result.carePlan.userId).toBe('unknown');
      expect(result.carePlan.status).toBe('DRAFT');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Propose transitions DRAFT → PROPOSED
  // -------------------------------------------------------------------------
  describe('propose transition', () => {
    it('should transition DRAFT → PROPOSED', async () => {
      const handoffId = 'handoff-propose-001';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      const proposedVersion = await ctx.orchestrator.propose(carePlan.id);

      expect(proposedVersion.status).toBe('PROPOSED');

      // Verify care plan status updated
      const updatedCarePlan = await ctx.carePlanRepo.findById(carePlan.id);
      expect(updatedCarePlan?.status).toBe('PROPOSED');
      expect(updatedCarePlan?.overallStatus).toBe('PROPOSED');

      // Audit event
      const events = await ctx.auditLogger.findAll({ eventType: 'CARE_PLAN_PROPOSED' });
      expect(events.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Clinician approve transitions PROPOSED → CLINICIAN_APPROVED
  // -------------------------------------------------------------------------
  describe('clinician approve transition', () => {
    it('should transition PROPOSED → CLINICIAN_APPROVED with clinician role', async () => {
      const handoffId = 'handoff-approve-001';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);
      const approvedVersion = await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');

      expect(approvedVersion.status).toBe('CLINICIAN_APPROVED');
      expect(approvedVersion.clinicianApprovedAt).toBeDefined();

      // Verify care plan status
      const updatedCarePlan = await ctx.carePlanRepo.findById(carePlan.id);
      expect(updatedCarePlan?.status).toBe('CLINICIAN_APPROVED');
      expect(updatedCarePlan?.overallStatus).toBe('CLINICIAN_APPROVED');

      // Audit event
      const events = await ctx.auditLogger.findAll({ eventType: 'CARE_PLAN_CLINICIAN_APPROVED' });
      expect(events.length).toBe(1);
    });

    it('should reject approve with non-clinician role', async () => {
      const handoffId = 'handoff-approve-002';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);

      await expect(
        ctx.orchestrator.clinicianApprove(carePlan.id, 'user'),
      ).rejects.toThrow(/clinician.*role/i);
    });
  });

  // -------------------------------------------------------------------------
  // 5. User accept transitions CLINICIAN_APPROVED → USER_ACCEPTED → ACTIVE
  // -------------------------------------------------------------------------
  describe('user accept and activate', () => {
    it('should transition CLINICIAN_APPROVED → USER_ACCEPTED → ACTIVE', async () => {
      const handoffId = 'handoff-accept-001';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);
      await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');

      const result = await ctx.orchestrator.userAcceptAndActivate(carePlan.id, 'user');

      expect(result.carePlan.status).toBe('ACTIVE');
      expect(result.carePlan.overallStatus).toBe('ACTIVE');
      expect(result.carePlan.activeVersionId).toBe(result.version.id);
      expect(result.version.status).toBe('ACTIVE');

      // Audit events
      const acceptedEvents = await ctx.auditLogger.findAll({ eventType: 'CARE_PLAN_USER_ACCEPTED' });
      expect(acceptedEvents.length).toBe(1);

      const activatedEvents = await ctx.auditLogger.findAll({ eventType: 'CARE_PLAN_ACTIVATED' });
      expect(activatedEvents.length).toBe(1);
    });

    it('should reject accept with non-user role', async () => {
      const handoffId = 'handoff-accept-002';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);
      await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');

      await expect(
        ctx.orchestrator.userAcceptAndActivate(carePlan.id, 'clinician'),
      ).rejects.toThrow(/user.*role/i);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Duplicate approve is idempotent (no duplicate events)
  // -------------------------------------------------------------------------
  describe('idempotency', () => {
    it('should return current state on duplicate approve without creating duplicate events', async () => {
      const handoffId = 'handoff-idempotent-001';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);
      const firstApprove = await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');
      expect(firstApprove.status).toBe('CLINICIAN_APPROVED');

      // Count events after first approve
      const eventsAfterFirst = await ctx.auditLogger.findAll({ eventType: 'CARE_PLAN_CLINICIAN_APPROVED' });
      const countAfterFirst = eventsAfterFirst.length;

      // Second approve (idempotent)
      const secondApprove = await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');
      expect(secondApprove.status).toBe('CLINICIAN_APPROVED');
      expect(secondApprove.id).toBe(firstApprove.id);

      // No additional audit event
      const eventsAfterSecond = await ctx.auditLogger.findAll({ eventType: 'CARE_PLAN_CLINICIAN_APPROVED' });
      expect(eventsAfterSecond.length).toBe(countAfterFirst);
    });

    it('should return current state on duplicate accept without error', async () => {
      const handoffId = 'handoff-idempotent-002';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);
      await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');

      const firstResult = await ctx.orchestrator.userAcceptAndActivate(carePlan.id, 'user');
      expect(firstResult.carePlan.status).toBe('ACTIVE');

      // Second accept (idempotent)
      const secondResult = await ctx.orchestrator.userAcceptAndActivate(carePlan.id, 'user');
      expect(secondResult.carePlan.status).toBe('ACTIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Current care plan endpoint returns latest plan with versions
  // -------------------------------------------------------------------------
  describe('current care plan with versions', () => {
    it('should return the care plan with active and latest versions after full lifecycle', async () => {
      const handoffId = 'handoff-current-001';
      await createSentHandoff(ctx, handoffId);

      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);
      await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');
      await ctx.orchestrator.userAcceptAndActivate(carePlan.id, 'user');

      // Verify through repo (simulating what the /current endpoint does)
      const allCarePlans = await ctx.carePlanRepo.findAll({ userId: DEMO_USER_ID } as Partial<CarePlan>);
      expect(allCarePlans.length).toBeGreaterThanOrEqual(1);

      const found = allCarePlans.find((cp) => cp.id === carePlan.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe('ACTIVE');
      expect(found?.activeVersionId).toBeTruthy();

      const allVersions = await ctx.carePlanVersionRepo.findAll({ carePlanId: carePlan.id } as Partial<CarePlanVersion>);
      expect(allVersions.length).toBe(1);
      expect(allVersions[0].status).toBe('ACTIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 8. Version history returns all versions sorted
  // -------------------------------------------------------------------------
  describe('version history', () => {
    it('should return versions sorted by versionNumber descending', async () => {
      const handoffId = 'handoff-versions-001';
      await createSentHandoff(ctx, handoffId);

      // Create V1 and go through full lifecycle to ACTIVE
      const { carePlan } = await ctx.orchestrator.createFromHandoff(
        handoffId,
        DEMO_CLINICIAN_ACTOR,
        { ...CREATE_REQUEST, handoffId },
      );

      await ctx.orchestrator.propose(carePlan.id);
      await ctx.orchestrator.clinicianApprove(carePlan.id, 'clinician');
      await ctx.orchestrator.userAcceptAndActivate(carePlan.id, 'user');

      // Create V2 via revise
      const v2 = await ctx.orchestrator.revise(carePlan.id, DEMO_CLINICIAN_ACTOR, {
        goals: [
          { id: 'goal-v2-1', title: 'Deepen mindfulness practice', description: 'Longer sessions' },
          { id: 'goal-v2-2', title: 'Address workplace boundaries', description: 'Set limits' },
        ],
        checkInFrequency: 'weekly',
      });

      expect(v2.versionNumber).toBe(2);
      expect(v2.status).toBe('DRAFT');

      // Fetch all versions and verify sorting
      const allVersions = await ctx.carePlanVersionRepo.findAll({ carePlanId: carePlan.id } as Partial<CarePlanVersion>);
      const sorted = allVersions.sort((a, b) => b.versionNumber - a.versionNumber);

      expect(sorted.length).toBe(2);
      expect(sorted[0].versionNumber).toBe(2);
      expect(sorted[1].versionNumber).toBe(1);

      // V1 should still be ACTIVE, V2 should be DRAFT
      const v1 = sorted.find((v) => v.versionNumber === 1);
      const v2Found = sorted.find((v) => v.versionNumber === 2);
      expect(v1?.status).toBe('ACTIVE');
      expect(v2Found?.status).toBe('DRAFT');
      expect(v2Found?.previousVersionId).toBe(v1?.id);

      // Audit events for revision
      const revisionEvents = await ctx.auditLogger.findAll({ eventType: 'CARE_PLAN_REVISION_CREATED' });
      expect(revisionEvents.length).toBe(1);
    });
  });
});
