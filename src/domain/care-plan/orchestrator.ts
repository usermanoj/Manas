import type { CarePlan, CarePlanVersion, Handoff, Repository } from '@/domain/repositories';
import type { AuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';
import {
  validateCarePlanTransition,
  canApproveCarePlan,
} from '@/domain/state-machines';
import type { CarePlanStatus } from '@/domain/state-machines';
import type { CreateCarePlanRequest, TransitionCarePlanRequest } from './schemas';

export interface CarePlanOrchestratorDeps {
  carePlanRepo: Repository<CarePlan>;
  carePlanVersionRepo: Repository<CarePlanVersion>;
  handoffRepo?: Repository<Handoff>;
  auditLogger: AuditLogger;
}

export class CarePlanOrchestrator {
  constructor(private deps: CarePlanOrchestratorDeps) {}

  async createFromHandoff(
    handoffId: string,
    actorId: string,
    data: CreateCarePlanRequest
  ): Promise<{ carePlan: CarePlan; version: CarePlanVersion }> {
    let userId = 'unknown';

    if (this.deps.handoffRepo) {
      const handoff = await this.deps.handoffRepo.findById(handoffId);
      if (handoff) {
        userId = handoff.userId;
      }
    }

    const versionId = crypto.randomUUID();
    const carePlanId = crypto.randomUUID();

    const version: CarePlanVersion = {
      id: versionId,
      carePlanId,
      versionNumber: 1,
      goals: data.goals.map(g => g.title),
      assignedModules: data.assignedModuleIds,
      checkInFrequency: data.checkInFrequency,
      boundaries: { items: data.boundaries },
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      status: 'DRAFT',
      createdAt: new Date(),
    };

    const carePlan: CarePlan = {
      id: carePlanId,
      userId,
      clinicianId: actorId,
      status: 'DRAFT',
      overallStatus: 'DRAFT',
      activeVersionId: null,
      latestVersionId: versionId,
      createdAt: new Date(),
    };

    await this.deps.carePlanVersionRepo.create(version);
    await this.deps.carePlanRepo.create(carePlan);

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId,
      actor: actorId,
      eventType: AuditEventType.CARE_PLAN_CREATED,
      details: { carePlanId, versionId: version.id, versionNumber: 1 },
    });

    return { carePlan, version };
  }

  async propose(carePlanId: string): Promise<CarePlanVersion> {
    const carePlan = await this.deps.carePlanRepo.findById(carePlanId);
    if (!carePlan) {
      throw new Error(`CarePlan "${carePlanId}" not found.`);
    }

    const version = await this.deps.carePlanVersionRepo.findById(carePlan.latestVersionId);
    if (!version) {
      throw new Error(`Latest CarePlanVersion "${carePlan.latestVersionId}" not found.`);
    }

    const transition = validateCarePlanTransition(version.status as CarePlanStatus, 'propose');
    if (!transition.valid) {
      throw new Error(transition.error);
    }

    const updatedVersion = await this.deps.carePlanVersionRepo.update(version.id, { status: 'PROPOSED' });
    await this.deps.carePlanRepo.update(carePlanId, { status: 'PROPOSED', overallStatus: 'PROPOSED' });

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId: carePlan.userId,
      actor: 'system',
      eventType: AuditEventType.CARE_PLAN_PROPOSED,
      details: { carePlanId, versionId: version.id },
    });

    return updatedVersion;
  }

  async clinicianApprove(carePlanId: string, actorRole: string): Promise<CarePlanVersion> {
    const guard = canApproveCarePlan(actorRole);
    if (!guard.allowed) {
      throw new Error(guard.reason);
    }

    const carePlan = await this.deps.carePlanRepo.findById(carePlanId);
    if (!carePlan) {
      throw new Error(`CarePlan "${carePlanId}" not found.`);
    }

    const version = await this.deps.carePlanVersionRepo.findById(carePlan.latestVersionId);
    if (!version) {
      throw new Error(`Latest CarePlanVersion "${carePlan.latestVersionId}" not found.`);
    }

    // Idempotency: if already approved or later, return current
    if (version.status === 'CLINICIAN_APPROVED' || version.status === 'USER_ACCEPTED' || version.status === 'ACTIVE') {
      return version;
    }

    const transition = validateCarePlanTransition(version.status as CarePlanStatus, 'approve');
    if (!transition.valid) {
      throw new Error(transition.error);
    }

    const updatedVersion = await this.deps.carePlanVersionRepo.update(version.id, {
      status: 'CLINICIAN_APPROVED',
      clinicianApprovedAt: new Date(),
    });

    await this.deps.carePlanRepo.update(carePlanId, { status: 'CLINICIAN_APPROVED', overallStatus: 'CLINICIAN_APPROVED' });

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId: carePlan.userId,
      actor: 'clinician',
      eventType: AuditEventType.CARE_PLAN_CLINICIAN_APPROVED,
      details: { carePlanId, versionId: version.id },
    });

    return updatedVersion;
  }

  async userAcceptAndActivate(
    carePlanId: string,
    actorRole: string
  ): Promise<{ carePlan: CarePlan; version: CarePlanVersion; supersededVersion?: CarePlanVersion }> {
    if (actorRole !== 'user') {
      throw new Error(`Care-plan acceptance requires "user" role; actor role: "${actorRole}".`);
    }

    const carePlan = await this.deps.carePlanRepo.findById(carePlanId);
    if (!carePlan) {
      throw new Error(`CarePlan "${carePlanId}" not found.`);
    }

    const version = await this.deps.carePlanVersionRepo.findById(carePlan.latestVersionId);
    if (!version) {
      throw new Error(`Latest CarePlanVersion "${carePlan.latestVersionId}" not found.`);
    }

    // Idempotency: if already ACTIVE with this version, return current
    if (version.status === 'ACTIVE' && carePlan.activeVersionId === version.id) {
      return { carePlan, version };
    }

    if (version.status !== 'CLINICIAN_APPROVED') {
      throw new Error(`CarePlanVersion "${version.id}" is not in CLINICIAN_APPROVED status (current: "${version.status}").`);
    }

    // USER_ACCEPTED
    await this.deps.carePlanVersionRepo.update(version.id, { status: 'USER_ACCEPTED', userAcceptedAt: new Date() });

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId: carePlan.userId,
      actor: 'user',
      eventType: AuditEventType.CARE_PLAN_USER_ACCEPTED,
      details: { carePlanId, versionId: version.id },
    });

    // ACTIVE
    const activatedVersion = await this.deps.carePlanVersionRepo.update(version.id, { status: 'ACTIVE' });
    const updatedCarePlan = await this.deps.carePlanRepo.update(carePlanId, {
      status: 'ACTIVE',
      overallStatus: 'ACTIVE',
      activeVersionId: version.id,
    });

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId: carePlan.userId,
      actor: 'system',
      eventType: AuditEventType.CARE_PLAN_ACTIVATED,
      details: { carePlanId, versionId: version.id },
    });

    // Supersede previous version if this is V2+
    let supersededVersion: CarePlanVersion | undefined;
    if (version.versionNumber > 1 && carePlan.activeVersionId) {
      const previousVersion = await this.deps.carePlanVersionRepo.findById(carePlan.activeVersionId);
      if (previousVersion && previousVersion.status === 'ACTIVE') {
        supersededVersion = await this.deps.carePlanVersionRepo.update(previousVersion.id, { status: 'SUPERSEDED' });

        await this.deps.auditLogger.log({
          requestId: carePlanId,
          userId: carePlan.userId,
          actor: 'system',
          eventType: AuditEventType.CARE_PLAN_VERSION_SUPERSEDED,
          details: { supersededVersionId: previousVersion.id, newActiveVersionId: version.id },
        });
      }
    }

    return { carePlan: updatedCarePlan, version: activatedVersion, supersededVersion };
  }

  async revise(
    carePlanId: string,
    actorId: string,
    changes: TransitionCarePlanRequest['changes']
  ): Promise<CarePlanVersion> {
    const carePlan = await this.deps.carePlanRepo.findById(carePlanId);
    if (!carePlan) {
      throw new Error(`CarePlan "${carePlanId}" not found.`);
    }

    if (!carePlan.activeVersionId) {
      throw new Error(`CarePlan "${carePlanId}" has no ACTIVE version to revise.`);
    }

    const activeVersion = await this.deps.carePlanVersionRepo.findById(carePlan.activeVersionId);
    if (!activeVersion) {
      throw new Error(`Active CarePlanVersion "${carePlan.activeVersionId}" not found.`);
    }

    // Clone active version
    const newVersionId = crypto.randomUUID();
    const newVersion: CarePlanVersion = {
      id: newVersionId,
      carePlanId,
      versionNumber: activeVersion.versionNumber + 1,
      goals: changes?.goals ? changes.goals.map(g => g.title) : [...activeVersion.goals],
      assignedModules: changes?.assignedModuleIds ?? [...activeVersion.assignedModules],
      checkInFrequency: changes?.checkInFrequency ?? activeVersion.checkInFrequency,
      boundaries: changes?.boundaries ? { items: changes.boundaries } : { ...activeVersion.boundaries },
      followUpDate: changes?.followUpDate ? new Date(changes.followUpDate) : activeVersion.followUpDate,
      status: 'DRAFT',
      createdAt: new Date(),
      previousVersionId: activeVersion.id,
    };

    await this.deps.carePlanVersionRepo.create(newVersion);
    await this.deps.carePlanRepo.update(carePlanId, { latestVersionId: newVersionId });

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId: carePlan.userId,
      actor: actorId,
      eventType: AuditEventType.CARE_PLAN_REVISION_CREATED,
      details: { carePlanId, versionId: newVersionId, previousVersionId: activeVersion.id },
    });

    return newVersion;
  }

  async pause(carePlanId: string): Promise<CarePlanVersion> {
    const carePlan = await this.deps.carePlanRepo.findById(carePlanId);
    if (!carePlan) {
      throw new Error(`CarePlan "${carePlanId}" not found.`);
    }

    const version = await this.deps.carePlanVersionRepo.findById(carePlan.latestVersionId);
    if (!version) {
      throw new Error(`Latest CarePlanVersion "${carePlan.latestVersionId}" not found.`);
    }

    const transition = validateCarePlanTransition(version.status as CarePlanStatus, 'pause');
    if (!transition.valid) {
      throw new Error(transition.error);
    }

    const updatedVersion = await this.deps.carePlanVersionRepo.update(version.id, { status: 'PAUSED' });
    await this.deps.carePlanRepo.update(carePlanId, { status: 'PAUSED', overallStatus: 'PAUSED' });

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId: carePlan.userId,
      actor: 'system',
      eventType: AuditEventType.CARE_PLAN_PAUSED,
      details: { carePlanId, versionId: version.id },
    });

    return updatedVersion;
  }

  async retire(carePlanId: string): Promise<CarePlan> {
    const carePlan = await this.deps.carePlanRepo.findById(carePlanId);
    if (!carePlan) {
      throw new Error(`CarePlan "${carePlanId}" not found.`);
    }

    const version = await this.deps.carePlanVersionRepo.findById(carePlan.latestVersionId);
    if (version) {
      await this.deps.carePlanVersionRepo.update(version.id, { status: 'RETIRED' });
    }

    const updatedCarePlan = await this.deps.carePlanRepo.update(carePlanId, { status: 'RETIRED', overallStatus: 'RETIRED' });

    await this.deps.auditLogger.log({
      requestId: carePlanId,
      userId: carePlan.userId,
      actor: 'system',
      eventType: AuditEventType.CARE_PLAN_RETIRED,
      details: { carePlanId },
    });

    return updatedCarePlan;
  }
}
