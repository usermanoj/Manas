import { NextRequest, NextResponse } from 'next/server';
import { CreateHandoffRequestSchema } from '@/domain/handoff';
import { createServices, createHandoffOrchestrator } from '@/lib/services';
import type { Handoff } from '@/domain/repositories';

const DEMO_USER_ID = 'profile-ananya-sharma';

/**
 * GET /api/handoffs
 *
 * Returns all handoffs for the demo user, newest first.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();
    const allHandoffs = await services.handoffRepo.findAll({ userId: DEMO_USER_ID } as Partial<Handoff>);
    const sorted = allHandoffs.sort((a, b) => {
      const aTime = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const bTime = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return bTime - aTime;
    });
    return NextResponse.json({
      handoffs: sorted.map((h) => ({
        id: h.id,
        userId: h.userId,
        providerId: h.providerId,
        status: h.status,
        version: h.version,
        sentAt: h.sentAt ? new Date(h.sentAt).toISOString() : null,
        structuredSummary: h.structuredSummary,
        excludedEntries: h.excludedEntries,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const services = createServices();
    const orchestrator = createHandoffOrchestrator(services);

    const handoff = await orchestrator.createDraft(
      DEMO_USER_ID,
      parsed.data.providerId,
      parsed.data.structuredSummary as never,
      parsed.data.excludedEntries,
    );

    return NextResponse.json(
      {
        id: handoff.id,
        status: handoff.status,
        version: handoff.version,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) {
      return NextResponse.json(
        { error: message },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
