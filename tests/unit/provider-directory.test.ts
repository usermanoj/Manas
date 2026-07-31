import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SEED_PROVIDERS } from '@/domain/repositories/seed-data';

// ---------------------------------------------------------------------------
// Provider Directory — Seed Data & Response Schema Tests
// ---------------------------------------------------------------------------

// Mirror the response schema from src/app/api/providers/route.ts
// (not exported, so we replicate the exact definition here).
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

describe('Provider directory — seed data', () => {
  it('should contain exactly 3 providers in seed data', () => {
    expect(SEED_PROVIDERS).toHaveLength(3);
  });

  it('should have isFictionalDemo: true for every seed provider', () => {
    for (const provider of SEED_PROVIDERS) {
      expect(provider.isFictionalDemo).toBe(true);
    }
  });
});

describe('Provider directory — response schema enforcement', () => {
  it('should reject a provider with isFictionalDemo: false', () => {
    const nonFictionalProvider = {
      id: 'provider-real',
      name: 'Dr. Real Person',
      title: 'Psychiatrist',
      languages: ['en'],
      focusAreas: ['trauma'],
      availability: 'Mon–Fri',
      sessionType: 'Video',
      priceRange: '₹3,000 per session',
      bio: 'A real, non-demo provider.',
      isFictionalDemo: false,
    };

    const result = ProviderResponseSchema.safeParse(nonFictionalProvider);
    expect(result.success).toBe(false);
  });

  it('should reject a real-looking / unmarked provider fixture', () => {
    // A provider that looks like a real listing but claims isFictionalDemo: true
    // is acceptable; one that omits the flag entirely should fail.
    const unmarkedProvider = {
      id: 'provider-unmarked',
      name: 'Dr. Unmarked',
      title: 'Therapist',
      languages: ['en', 'hi'],
      focusAreas: ['anxiety'],
      availability: 'Weekdays',
      sessionType: 'Chat',
      priceRange: '₹1,000 per session',
      bio: 'No demo flag set.',
      // isFictionalDemo omitted entirely
    };

    const result = ProviderResponseSchema.safeParse(unmarkedProvider);
    expect(result.success).toBe(false);
  });

  it('should not include profileId in the provider response schema', () => {
    const shape = ProviderResponseSchema.shape;
    expect(shape).not.toHaveProperty('profileId');
  });
});
