import { NextRequest, NextResponse } from 'next/server';
import { createServices, createSymptomService } from '@/lib/services';
import { getSession } from '@/domain/auth';
import { z } from 'zod';

const RecordSymptomSchema = z.object({
  text: z.string().min(1).max(300),
  category: z.enum([
    'sleep', 'mood', 'energy', 'focus', 'physical_tension', 'social', 'work_stress', 'other',
  ]).optional(),
  severity: z.enum(['mild', 'moderate', 'significant', 'severe']),
  frequency: z.enum(['occasionally', 'weekly', 'several_times_a_week', 'daily', 'constant']),
  impact: z.string().min(1).max(300),
  sessionId: z.string().optional(),
});

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const services = createServices();
  const symptomService = createSymptomService(services);
  const symptoms = await symptomService.getSymptomsForUser(session.sub);

  return NextResponse.json({ symptoms });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RecordSymptomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid symptom data.', details: parsed.error.format() }, { status: 400 });
    }

    const services = createServices();
    const symptomService = createSymptomService(services);
    const entry = await symptomService.recordSymptom({
      userId: session.sub,
      sessionId: parsed.data.sessionId,
      text: parsed.data.text,
      category: parsed.data.category,
      severity: parsed.data.severity,
      frequency: parsed.data.frequency,
      impact: parsed.data.impact,
    });

    return NextResponse.json({ symptom: entry }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to record symptom.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
