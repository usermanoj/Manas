import { NextRequest, NextResponse } from 'next/server';
import { createServices, createHandoffOrchestrator } from '@/lib/services';
import { getSession } from '@/domain/auth';

const DEMO_USER_ID = 'profile-ananya-sharma';

/**
 * POST /api/handoffs/[id]/submit-for-review
 *
 * Transitions a DRAFT handoff to USER_REVIEW so that consent-and-send can proceed.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const services = createServices();
    const orchestrator = createHandoffOrchestrator(services);

    // The acting user must own the handoff (row-level scoping).
    const authSession = await getSession();
    const userId = authSession?.role === 'user' ? authSession.sub : DEMO_USER_ID;
    const handoff = await orchestrator.submitForReview(id, userId);

    return NextResponse.json({
      id: handoff.id,
      status: handoff.status,
      version: handoff.version,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('does not belong to user')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('not in DRAFT status')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
