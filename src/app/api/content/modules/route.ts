import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PAUSE_REFLECT_MODULE, PAUSE_REFLECT_VERSION } from '@/domain/content';

const ModuleResponseSchema = z.object({
  modules: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      purpose: z.string(),
      status: z.string(),
      version: z.object({
        id: z.string(),
        steps: z.array(z.record(z.string(), z.unknown())),
        warnings: z.array(z.string()),
      }),
    }),
  ),
});

export async function GET(): Promise<NextResponse> {
  try {
    // Only expose modules that are PENDING_CLINICAL_REVIEW or APPROVED — never DRAFT.
    const allowedStatuses = ['PENDING_CLINICAL_REVIEW', 'APPROVED'];
    if (!allowedStatuses.includes(PAUSE_REFLECT_MODULE.status)) {
      return NextResponse.json({ modules: [] });
    }

    const response = {
      modules: [
        {
          id: PAUSE_REFLECT_MODULE.id,
          title: PAUSE_REFLECT_MODULE.title,
          purpose: PAUSE_REFLECT_MODULE.purpose,
          status: PAUSE_REFLECT_MODULE.status,
          version: {
            id: PAUSE_REFLECT_VERSION.id,
            steps: PAUSE_REFLECT_VERSION.steps,
            warnings: PAUSE_REFLECT_VERSION.warnings,
          },
        },
      ],
    };

    // Validate response shape before returning.
    const parsed = ModuleResponseSchema.safeParse(response);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Internal response validation error', details: parsed.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
