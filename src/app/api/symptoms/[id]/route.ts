import { NextResponse } from 'next/server';
import { createServices, createSymptomService } from '@/lib/services';
import { getSession } from '@/domain/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
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
