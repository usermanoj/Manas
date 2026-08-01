import { NextRequest, NextResponse } from 'next/server';
import { TransitionCarePlanRequestSchema } from '@/domain/care-plan';
import { createServices, createCarePlanOrchestrator } from '@/lib/services';

const DEMO_CLINICIAN_ACTOR = 'profile-dr-maya-rao';

/**
 * POST /api/care-plans/[id]/transition
 *
 * Perform a state transition on a care plan.
 * The server derives the actor role from the action type (demo mode).
 * No actorRole is supplied by the client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = TransitionCarePlanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();
    const orchestrator = createCarePlanOrchestrator(services);

    // Verify the care plan exists
    const carePlan = await services.carePlanRepo.findById(id);
    if (!carePlan) {
      return NextResponse.json(
        { error: `CarePlan "${id}" not found.` },
        { status: 404 },
      );
    }

    const { action, changes } = parsed.data;

    switch (action) {
      case 'propose': {
        const version = await orchestrator.propose(id);
        return NextResponse.json({ version: serializeVersion(version) });
      }

      case 'approve': {
        const version = await orchestrator.clinicianApprove(id, 'clinician');
        return NextResponse.json({ version: serializeVersion(version) });
      }

      case 'accept': {
        const result = await orchestrator.userAcceptAndActivate(id, 'user');
        return NextResponse.json({
          carePlan: {
            id: result.carePlan.id,
            status: result.carePlan.status,
            overallStatus: result.carePlan.overallStatus,
            activeVersionId: result.carePlan.activeVersionId,
          },
          version: serializeVersion(result.version),
          supersededVersion: result.supersededVersion
            ? serializeVersion(result.supersededVersion)
            : null,
        });
      }

      case 'revise': {
        const version = await orchestrator.revise(id, DEMO_CLINICIAN_ACTOR, changes);
        return NextResponse.json({ version: serializeVersion(version) });
      }

      case 'pause': {
        const version = await orchestrator.pause(id);
        return NextResponse.json({ version: serializeVersion(version) });
      }

      case 'retire': {
        const retiredCarePlan = await orchestrator.retire(id);
        return NextResponse.json({
          carePlan: {
            id: retiredCarePlan.id,
            status: retiredCarePlan.status,
            overallStatus: retiredCarePlan.overallStatus,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action as string}` },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('Invalid care-plan transition') || message.includes('requires')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes('clinician') && message.includes('role')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('user') && message.includes('role')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

function serializeVersion(v: {
  id: string;
  carePlanId: string;
  versionNumber: number;
  goals: string[];
  assignedModules: string[];
  checkInFrequency: string;
  boundaries: Record<string, unknown>;
  followUpDate?: Date;
  status: string;
  clinicianApprovedAt?: Date;
  userAcceptedAt?: Date;
  createdAt: Date;
  previousVersionId?: string;
}): Record<string, unknown> {
  return {
    id: v.id,
    carePlanId: v.carePlanId,
    versionNumber: v.versionNumber,
    goals: v.goals,
    assignedModules: v.assignedModules,
    checkInFrequency: v.checkInFrequency,
    boundaries: v.boundaries,
    followUpDate: v.followUpDate ? new Date(v.followUpDate).toISOString() : null,
    status: v.status,
    clinicianApprovedAt: v.clinicianApprovedAt ? new Date(v.clinicianApprovedAt).toISOString() : null,
    userAcceptedAt: v.userAcceptedAt ? new Date(v.userAcceptedAt).toISOString() : null,
    createdAt: new Date(v.createdAt).toISOString(),
    previousVersionId: v.previousVersionId ?? null,
  };
}
