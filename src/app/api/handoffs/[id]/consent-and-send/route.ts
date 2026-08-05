import { NextRequest, NextResponse } from 'next/server';
import { ConsentAndSendRequestSchema } from '@/domain/handoff';
import { createServices, createHandoffOrchestrator } from '@/lib/services';
import { getSession } from '@/domain/auth';

const DEMO_USER_ID = 'profile-ananya-sharma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const body = await request.json();
    const parsed = ConsentAndSendRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();
    const orchestrator = createHandoffOrchestrator(services);

    // Consent must come from the handoff's owner (row-level scoping).
    const authSession = await getSession();
    const userId = authSession?.role === 'user' ? authSession.sub : DEMO_USER_ID;
    const result = await orchestrator.consentAndSend(id, userId, parsed.data);

    return NextResponse.json({
      handoff: {
        id: result.handoff.id,
        status: result.handoff.status,
        version: result.handoff.version,
        sentAt: result.handoff.sentAt
          ? new Date(result.handoff.sentAt).toISOString()
          : null,
      },
      consentRecord: {
        id: result.consentRecord.id,
        userId: result.consentRecord.userId,
        status: result.consentRecord.status,
        grantedAt: new Date(result.consentRecord.grantedAt).toISOString(),
        scope: result.consentRecord.scope,
      },
      sentAt: result.handoff.sentAt
        ? new Date(result.handoff.sentAt).toISOString()
        : new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message.includes('does not belong to user') ||
      message.includes('not in USER_REVIEW status')
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
