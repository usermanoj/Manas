import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/lib/services';
import type { CarePlanVersion } from '@/domain/repositories';

/**
 * GET /api/care-plans/[id]/versions
 *
 * Returns all versions for a specific care plan, sorted by versionNumber descending.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const services = createServices();

    // Verify the care plan exists
    const carePlan = await services.carePlanRepo.findById(id);
    if (!carePlan) {
      return NextResponse.json(
        { error: `CarePlan "${id}" not found.` },
        { status: 404 },
      );
    }

    // Fetch all versions for this care plan
    const allVersions = await services.carePlanVersionRepo.findAll({
      carePlanId: id,
    } as Partial<CarePlanVersion>);

    const versions = allVersions.sort((a, b) => b.versionNumber - a.versionNumber);

    return NextResponse.json({
      versions: versions.map(serializeVersion),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

function serializeVersion(v: CarePlanVersion): Record<string, unknown> {
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
