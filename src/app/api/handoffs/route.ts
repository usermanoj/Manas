import { NextRequest, NextResponse } from 'next/server';
import { CreateHandoffRequestSchema } from '@/domain/handoff';
import { createServices, createHandoffOrchestrator } from '@/lib/services';
import { getSession } from '@/domain/auth';
import type { Handoff } from '@/domain/repositories';

const DEMO_USER_ID = 'profile-ananya-sharma';

/**
 * Resolve the acting user id from the session. Clinician sessions fall back
 * to the demo user so the demo workspace keeps working.
 */
async function resolveUserId(): Promise<string> {
  const session = await getSession();
  return session?.role === 'user' ? session.sub : DEMO_USER_ID;
}

/**
 * GET /api/handoffs
 *
 * Returns all handoffs for the signed-in user, newest first.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();
    const userId = await resolveUserId();
    const allHandoffs = await services.handoffRepo.findAll({ userId } as Partial<Handoff>);
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
        createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : null,
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

    // Attribute the handoff to the signed-in user so the downstream care
    // plan belongs to them (row-level scoping, not a shared demo bucket).
    const userId = await resolveUserId();
    const handoff = await orchestrator.createDraft(
      userId,
      parsed.data.providerId,
      parsed.data.structuredSummary as never,
      parsed.data.excludedEntries,
    );

    return NextResponse.json(
      {
        id: handoff.id,
        status: handoff.status,
        version: handoff.version,
        createdAt: handoff.createdAt ? handoff.createdAt.toISOString() : new Date().toISOString(),
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
