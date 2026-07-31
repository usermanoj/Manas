import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServices } from '@/lib/services';

const ProviderResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  languages: z.array(z.string()),
  focusAreas: z.array(z.string()),
  availability: z.string(),
  sessionType: z.string(),
  priceRange: z.string(),
  bio: z.string(),
  isFictionalDemo: z.literal(true),
  // profileId intentionally excluded from response
});

export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();
    const allProviders = await services.providerRepo.findAll();

    // Strip profileId and validate isFictionalDemo for every provider.
    const providers = allProviders.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      languages: p.languages,
      focusAreas: p.focusAreas,
      availability: p.availability,
      sessionType: p.sessionType,
      priceRange: p.priceRange,
      bio: p.bio,
      isFictionalDemo: p.isFictionalDemo as true,
    }));

    // Validate every provider against the response schema.
    const parsed = z.array(ProviderResponseSchema).safeParse(providers);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid provider data', details: parsed.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ providers: parsed.data });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
