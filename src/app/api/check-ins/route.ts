import { NextRequest, NextResponse } from 'next/server';
import { CreateCheckInRequestSchema } from '@/domain/ai';
import { CheckInOrchestrator } from '@/domain/check-in';
import { createServices } from '@/lib/services';

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
    const orchestrator = new CheckInOrchestrator({
      modelGateway: services.modelGateway,
      fallbackGateway: services.fallbackGateway,
      sessionRepo: services.sessionRepo,
      safetyAssessmentRepo: services.safetyAssessmentRepo,
      auditLogger: services.auditLogger,
    });

    const session = await orchestrator.createSession(
      parsed.data.mode,
      parsed.data.language,
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
