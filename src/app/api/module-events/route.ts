import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServices } from '@/lib/services';

const ModuleEventSchema = z.object({
  eventType: z.enum(['MODULE_OPENED', 'MODULE_COMPLETED', 'MODULE_SKIPPED']),
  moduleId: z.string(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = ModuleEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const { eventType, moduleId } = parsed.data;

    // Server derives all contextual fields — clients send ONLY eventType and moduleId.
    const requestId = request.headers.get('x-request-id') ?? `req-${Date.now()}`;
    const userId = request.headers.get('x-user-id') ?? 'anonymous';
    const actor = request.headers.get('x-actor') ?? userId;
    const sessionId = request.headers.get('x-session-id') ?? '';

    const services = createServices();
    await services.auditLogger.log({
      requestId,
      userId,
      actor,
      eventType,
      details: { moduleId, sessionId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
