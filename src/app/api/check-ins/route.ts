import { NextRequest, NextResponse } from 'next/server';
import { CreateCheckInRequestSchema } from '@/domain/ai';
import { createServices, createCheckInOrchestrator } from '@/lib/services';
import { getSession } from '@/domain/auth';

/**
 * GET /api/check-ins
 * Returns all check-in sessions for the demo user.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();
    const sessions = await services.sessionRepo.findAll();

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        mode: s.mode,
        language: s.language,
        status: s.status,
        modelVersion: s.modelVersion,
        promptVersion: s.promptVersion,
        startedAt: s.startedAt instanceof Date
          ? s.startedAt.toISOString()
          : s.startedAt,
        completedAt: s.completedAt instanceof Date
          ? s.completedAt.toISOString()
          : s.completedAt ?? null,
        structuredSummary: s.structuredSummary ?? null,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = CreateCheckInRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();
    const orchestrator = createCheckInOrchestrator(services);
    const authSession = await getSession();

    const session = await orchestrator.createSession(
      parsed.data.mode,
      parsed.data.language,
      authSession?.sub,
    );

    return NextResponse.json({
      id: session.id,
      status: 'INITIATED' as const,
      createdAt: session.startedAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
