import { NextResponse } from 'next/server';
import { createServices } from '@/lib/services';

/**
 * GET /api/providers
 *
 * Returns all fictional demo providers.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();
    const allProviders = await services.providerRepo.findAll();
    return NextResponse.json({
      providers: allProviders.map((p) => ({
        id: p.id,
        profileId: p.profileId,
        name: p.name,
        title: p.title,
        languages: p.languages,
        focusAreas: p.focusAreas,
        availability: p.availability,
        sessionType: p.sessionType,
        priceRange: p.priceRange,
        pricePerSession: p.pricePerSession,
        currency: p.currency,
        sessionDurationMinutes: p.sessionDurationMinutes,
        nextAvailable: p.nextAvailable,
        timezone: p.timezone,
        availabilityDays: p.availabilityDays,
        availabilityStartHour: p.availabilityStartHour,
        availabilityStartMinute: p.availabilityStartMinute,
        availabilityEndHour: p.availabilityEndHour,
        availabilityEndMinute: p.availabilityEndMinute,
        nextAvailableDay: p.nextAvailableDay,
        nextAvailableHour: p.nextAvailableHour,
        nextAvailableMinute: p.nextAvailableMinute,
        credentialsNote: p.credentialsNote,
        bio: p.bio,
        isFictionalDemo: p.isFictionalDemo,
        isActualProfile: p.isActualProfile,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
