import { NextRequest, NextResponse } from 'next/server';
import { createServices, createSymptomService } from '@/lib/services';
import { getSession } from '@/domain/auth';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UpdateSymptomSchema = z
  .object({
    text: z.string().min(1).max(300),
    category: z.enum([
      'sleep', 'mood', 'energy', 'focus', 'physical_tension', 'social', 'work_stress', 'other',
    ]),
    severity: z.enum(['mild', 'moderate', 'significant', 'severe']),
    frequency: z.enum(['occasionally', 'weekly', 'several_times_a_week', 'daily', 'constant']),
    impact: z.string().min(1).max(300),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update.' });

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = UpdateSymptomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid symptom data.', details: parsed.error.format() }, { status: 400 });
    }

    const { id } = await params;
    const services = createServices();
    const symptomService = createSymptomService(services);
    const updated = await symptomService.updateSymptom(session.sub, id, parsed.data);

    if (!updated) {
      return NextResponse.json({ error: 'Symptom not found.' }, { status: 404 });
    }

    return NextResponse.json({ symptom: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update symptom.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const services = createServices();
    const symptomService = createSymptomService(services);
    const deleted = await symptomService.deleteSymptom(session.sub, id);

    if (!deleted) {
      return NextResponse.json({ error: 'Symptom not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete symptom.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
