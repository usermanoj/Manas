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
        bio: p.bio,
        isFictionalDemo: p.isFictionalDemo,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
