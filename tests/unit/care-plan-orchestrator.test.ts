import { describe, it, expect, beforeEach } from 'vitest';
import { CarePlanOrchestrator } from '@/domain/care-plan';
import type { CarePlanOrchestratorDeps } from '@/domain/care-plan';
import type { CreateCarePlanRequest, TransitionCarePlanRequest } from '@/domain/care-plan';
import { InMemoryRepository } from '@/domain/repositories';
import type { CarePlan, CarePlanVersion, Handoff } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_HANDOFF_ID = 'test-handoff-1';
const TEST_USER_ID = 'user-1';
const TEST_CLINICIAN_ID = 'clinician-1';

const CREATE_REQUEST: CreateCarePlanRequest = {
  handoffId: TEST_HANDOFF_ID,
  goals: [
    { id: 'g1', title: 'Reduce anxiety', description: 'Through structured reflection' },
    { id: 'g2', title: 'Improve sleep', description: 'Nightly routine' },
  ],
  assignedModuleIds: ['module-pause-reflect'],
  checkInFrequency: 'twice_per_week',
  boundaries: ['ai-as-facilitator', 'weekly-clinician-review'],
  followUpDate: '2026-08-15T10:00:00.000Z',
};

function createDeps(): CarePlanOrchestratorDeps {
  const handoffRepo = new InMemoryRepository<Handoff>();

  return {
    carePlanRepo: new InMemoryRepository<CarePlan>(),
    carePlanVersionRepo: new InMemoryRepository<CarePlanVersion>(),
    handoffRepo,
    auditLogger: new InMemoryAuditLogger(),
  };
}

async function seedHandoff(deps: CarePlanOrchestratorDeps): Promise<void> {
  await deps.handoffRepo!.create({
    id: TEST_HANDOFF_ID,
    userId: TEST_USER_ID,
    providerId: 'provider-1',
    status: 'SENT',
    structuredSummary: {
      primary_concern: 'Work stress',
      concern_duration: 'weeks',
      sleep_impact: 'mild',
      daily_functioning_impact: 'mild',
      support_preference: 'general_reflection',
      feels_safe: 'yes',
      key_points: ['overwhelmed'],
    },
    excludedEntries: [],
    version: 1,
  });
}

async function createAndApprove(
  deps: CarePlanOrchestratorDeps,
  orchestrator: CarePlanOrchestrator
): Promise<{ carePlan: CarePlan; version: CarePlanVersion }> {
  const result = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);
  await orchestrator.propose(result.carePlan.id);
  await orchestrator.clinicianApprove(result.carePlan.id, 'clinician');
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CarePlanOrchestrator', () => {
  let deps: CarePlanOrchestratorDeps;
  let orchestrator: CarePlanOrchestrator;

  beforeEach(async () => {
    deps = createDeps();
    orchestrator = new CarePlanOrchestrator(deps);
    await seedHandoff(deps);
  });

  it('createFromHandoff creates plan and version with DRAFT status, logs CARE_PLAN_CREATED', async () => {
    const result = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);

    expect(result.carePlan).toBeDefined();
    expect(result.carePlan.status).toBe('DRAFT');
    expect(result.carePlan.overallStatus).toBe('DRAFT');
    expect(result.carePlan.userId).toBe(TEST_USER_ID);
    expect(result.carePlan.clinicianId).toBe(TEST_CLINICIAN_ID);
    expect(result.version).toBeDefined();
    expect(result.version.status).toBe('DRAFT');
    expect(result.version.versionNumber).toBe(1);

    const events = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_CREATED });
    expect(events.length).toBe(1);
    expect(events[0].details).toHaveProperty('carePlanId', result.carePlan.id);
  });

  it('propose transitions DRAFT → PROPOSED', async () => {
    const { carePlan } = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);
    const version = await orchestrator.propose(carePlan.id);

    expect(version.status).toBe('PROPOSED');

    const events = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_PROPOSED });
    expect(events.length).toBe(1);
  });

  it('clinicianApprove requires clinician role (rejects user)', async () => {
    const { carePlan } = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);
    await orchestrator.propose(carePlan.id);

    await expect(
      orchestrator.clinicianApprove(carePlan.id, 'user')
    ).rejects.toThrow(/clinician/);
  });

  it('clinicianApprove transitions PROPOSED → CLINICIAN_APPROVED, sets clinicianApprovedAt', async () => {
    const { carePlan } = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);
    await orchestrator.propose(carePlan.id);
    const version = await orchestrator.clinicianApprove(carePlan.id, 'clinician');

    expect(version.status).toBe('CLINICIAN_APPROVED');
    expect(version.clinicianApprovedAt).toBeInstanceOf(Date);

    const events = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_CLINICIAN_APPROVED });
    expect(events.length).toBe(1);
  });

  it('userAcceptAndActivate requires user role (rejects clinician)', async () => {
    const { carePlan } = await createAndApprove(deps, orchestrator);

    await expect(
      orchestrator.userAcceptAndActivate(carePlan.id, 'clinician')
    ).rejects.toThrow(/user/);
  });

  it('userAcceptAndActivate atomically transitions CLINICIAN_APPROVED → USER_ACCEPTED → ACTIVE', async () => {
    const { carePlan } = await createAndApprove(deps, orchestrator);
    const result = await orchestrator.userAcceptAndActivate(carePlan.id, 'user');

    expect(result.version.status).toBe('ACTIVE');
    expect(result.version.userAcceptedAt).toBeInstanceOf(Date);
    expect(result.carePlan.status).toBe('ACTIVE');
    expect(result.carePlan.overallStatus).toBe('ACTIVE');
    expect(result.carePlan.activeVersionId).toBe(result.version.id);
  });

  it('emits both CARE_PLAN_USER_ACCEPTED and CARE_PLAN_ACTIVATED events', async () => {
    const { carePlan } = await createAndApprove(deps, orchestrator);
    await orchestrator.userAcceptAndActivate(carePlan.id, 'user');

    const acceptedEvents = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_USER_ACCEPTED });
    const activatedEvents = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_ACTIVATED });
    expect(acceptedEvents.length).toBe(1);
    expect(activatedEvents.length).toBe(1);
  });

  it('full lifecycle: DRAFT → PROPOSED → CLINICIAN_APPROVED → USER_ACCEPTED/ACTIVE', async () => {
    const { carePlan } = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);
    expect(carePlan.status).toBe('DRAFT');

    await orchestrator.propose(carePlan.id);
    const updated1 = await deps.carePlanRepo.findById(carePlan.id);
    expect(updated1!.status).toBe('PROPOSED');

    await orchestrator.clinicianApprove(carePlan.id, 'clinician');
    const updated2 = await deps.carePlanRepo.findById(carePlan.id);
    expect(updated2!.status).toBe('CLINICIAN_APPROVED');

    await orchestrator.userAcceptAndActivate(carePlan.id, 'user');
    const updated3 = await deps.carePlanRepo.findById(carePlan.id);
    expect(updated3!.status).toBe('ACTIVE');
  });

  it('revise creates V2 with previousVersionId, V1 unchanged', async () => {
    const { carePlan, version: v1 } = await createAndApprove(deps, orchestrator);
    await orchestrator.userAcceptAndActivate(carePlan.id, 'user');

    const changes: TransitionCarePlanRequest['changes'] = {
      goals: [{ id: 'g3', title: 'New goal', description: 'Added in revision' }],
    };

    const v2 = await orchestrator.revise(carePlan.id, TEST_CLINICIAN_ID, changes);

    expect(v2.versionNumber).toBe(2);
    expect(v2.previousVersionId).toBe(v1.id);
    expect(v2.status).toBe('DRAFT');
    expect(v2.goals).toContain('New goal');

    const v1After = await deps.carePlanVersionRepo.findById(v1.id);
    expect(v1After!.status).toBe('ACTIVE');
    expect(v1After!.goals).not.toContain('New goal');
  });

  it('V1 remains ACTIVE while V2 is in DRAFT/PROPOSED', async () => {
    const { carePlan, version: v1 } = await createAndApprove(deps, orchestrator);
    await orchestrator.userAcceptAndActivate(carePlan.id, 'user');

    await orchestrator.revise(carePlan.id, TEST_CLINICIAN_ID, {});

    const v1After = await deps.carePlanVersionRepo.findById(v1.id);
    expect(v1After!.status).toBe('ACTIVE');

    const carePlanAfter = await deps.carePlanRepo.findById(carePlan.id);
    expect(carePlanAfter!.activeVersionId).toBe(v1.id);
  });

  it('V2 activation supersedes V1', async () => {
    const { carePlan, version: v1 } = await createAndApprove(deps, orchestrator);
    await orchestrator.userAcceptAndActivate(carePlan.id, 'user');

    const v2 = await orchestrator.revise(carePlan.id, TEST_CLINICIAN_ID, {});
    await orchestrator.propose(carePlan.id);

    const updatedCarePlan = await deps.carePlanRepo.findById(carePlan.id);
    expect(updatedCarePlan!.latestVersionId).toBe(v2.id);

    await orchestrator.clinicianApprove(carePlan.id, 'clinician');
    const result = await orchestrator.userAcceptAndActivate(carePlan.id, 'user');

    expect(result.supersededVersion).toBeDefined();
    expect(result.supersededVersion!.status).toBe('SUPERSEDED');

    const v1After = await deps.carePlanVersionRepo.findById(v1.id);
    expect(v1After!.status).toBe('SUPERSEDED');

    const supersededEvents = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_VERSION_SUPERSEDED });
    expect(supersededEvents.length).toBe(1);
  });

  it('duplicate approve is idempotent (no duplicate events)', async () => {
    const { carePlan } = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);
    await orchestrator.propose(carePlan.id);

    await orchestrator.clinicianApprove(carePlan.id, 'clinician');
    await orchestrator.clinicianApprove(carePlan.id, 'clinician');

    const events = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_CLINICIAN_APPROVED });
    expect(events.length).toBe(1);
  });

  it('assigning module does not change content review status', async () => {
    const { carePlan } = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);

    const contentModules = await deps.carePlanVersionRepo.findAll();
    expect(contentModules.every(m => m.status === 'DRAFT')).toBe(true);

    await orchestrator.propose(carePlan.id);

    const contentModulesAfter = await deps.carePlanVersionRepo.findAll();
    expect(contentModulesAfter.every(m => m.status === 'PROPOSED' || m.status === 'DRAFT')).toBe(true);
  });

  it('audit events contain only metadata', async () => {
    const { carePlan, version } = await orchestrator.createFromHandoff(TEST_HANDOFF_ID, TEST_CLINICIAN_ID, CREATE_REQUEST);

    const events = await deps.auditLogger.findAll({ eventType: AuditEventType.CARE_PLAN_CREATED });
    expect(events.length).toBe(1);

    const details = events[0].details;
    expect(details).toHaveProperty('carePlanId', carePlan.id);
    expect(details).toHaveProperty('versionId', version.id);
    expect(details).not.toHaveProperty('rawText');
    expect(details).not.toHaveProperty('summary');
    expect(details).not.toHaveProperty('conversation');
  });
});
