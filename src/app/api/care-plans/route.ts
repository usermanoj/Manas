import { NextRequest, NextResponse } from 'next/server';
import { CreateCarePlanRequestSchema } from '@/domain/care-plan';
import { createServices, createCarePlanOrchestrator } from '@/lib/services';

/** Fallback actor when the handoff's destination provider has no linked profile. */
const DEMO_CLINICIAN_ACTOR = 'profile-dr-maya-rao';

/**
 * POST /api/care-plans
 *
 * Create a new care plan from a SENT handoff.
 * The server derives userId from the handoff; the client does NOT supply
 * userId, clinicianProfileId, actor, or timestamp.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = CreateCarePlanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();

    // Validate the handoff exists and is in SENT status
    const handoff = await services.handoffRepo.findById(parsed.data.handoffId);
    if (!handoff) {
      return NextResponse.json(
        { error: `Handoff "${parsed.data.handoffId}" not found.` },
        { status: 404 },
      );
    }
    if (handoff.status !== 'SENT') {
      return NextResponse.json(
        { error: `Handoff "${parsed.data.handoffId}" is not in SENT status (current: "${handoff.status}").` },
        { status: 400 },
      );
    }

    const orchestrator = createCarePlanOrchestrator(services);

    // Attribute the plan to the clinician linked to the handoff's destination
    // provider so the care plan and its audit trail name the right professional.
    const linkedProviders = await services.providerRepo.findAll({ id: handoff.providerId });
    const clinicianActor = linkedProviders[0]?.profileId ?? DEMO_CLINICIAN_ACTOR;

    const { carePlan, version } = await orchestrator.createFromHandoff(
      parsed.data.handoffId,
      clinicianActor,
      {
        handoffId: parsed.data.handoffId,
        goals: parsed.data.goals,
        assignedModuleIds: parsed.data.assignedModuleIds,
        checkInFrequency: parsed.data.checkInFrequency,
        boundaries: parsed.data.boundaries,
        followUpDate: parsed.data.followUpDate,
      },
    );

    return NextResponse.json(
      {
        carePlan: {
          id: carePlan.id,
          userId: carePlan.userId,
          clinicianId: carePlan.clinicianId,
          status: carePlan.status,
          overallStatus: carePlan.overallStatus,
          activeVersionId: carePlan.activeVersionId,
          latestVersionId: carePlan.latestVersionId,
          createdAt: carePlan.createdAt?.toISOString() ?? null,
        },
        version: {
          id: version.id,
          carePlanId: version.carePlanId,
          versionNumber: version.versionNumber,
          goals: version.goals,
          assignedModules: version.assignedModules,
          checkInFrequency: version.checkInFrequency,
          boundaries: version.boundaries,
          followUpDate: version.followUpDate?.toISOString() ?? null,
          status: version.status,
          createdAt: version.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
