import { NextResponse } from 'next/server';
import { createServices } from '@/lib/services';
import type { CarePlan, CarePlanVersion } from '@/domain/repositories';

const DEMO_USER_ID = 'profile-ananya-sharma';

/**
 * GET /api/care-plans/current
 *
 * Returns the user's current (latest) care plan with versions.
 * For demo mode: filters by userId `profile-ananya-sharma`.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();

    // Find all care plans for the demo user
    const allCarePlans = await services.carePlanRepo.findAll({
      userId: DEMO_USER_ID,
    } as Partial<CarePlan>);

    if (allCarePlans.length === 0) {
      return NextResponse.json({
        carePlan: null,
        activeVersion: null,
        latestVersion: null,
        versions: [],
      });
    }

    // Sort by createdAt descending to get the latest care plan
    const sortedCarePlans = allCarePlans.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const carePlan = sortedCarePlans[0];

    // Fetch all versions for this care plan
    const allVersions = await services.carePlanVersionRepo.findAll({
      carePlanId: carePlan.id,
    } as Partial<CarePlanVersion>);

    const versions = allVersions.sort((a, b) => b.versionNumber - a.versionNumber);

    const activeVersion = carePlan.activeVersionId
      ? versions.find((v) => v.id === carePlan.activeVersionId) ?? null
      : null;

    const latestVersion = versions.find((v) => v.id === carePlan.latestVersionId) ?? null;

    return NextResponse.json({
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
      activeVersion: activeVersion ? serializeVersion(activeVersion) : null,
      latestVersion: latestVersion ? serializeVersion(latestVersion) : null,
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
