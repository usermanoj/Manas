import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/lib/services';
import { CreateHandoffRequestSchema, HandoffResponseSchema } from '@/domain/handoff';
import { createDraftHandoff } from '@/domain/handoff';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = CreateHandoffRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const { providerId, structuredSummary, excludedEntries, userNote } = parsed.data;
    const services = createServices();

    const created = await createDraftHandoff(
      { handoffRepo: services.handoffRepo, auditLogger: services.auditLogger },
      'demo-user',
      providerId,
      structuredSummary,
      excludedEntries,
      userNote,
    );

    return NextResponse.json(
      { handoff: HandoffResponseSchema.parse(created) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
