import { NextRequest, NextResponse } from 'next/server';
import { PostMessageRequestSchema } from '@/domain/ai';
import { CheckInOrchestrator } from '@/domain/check-in';
import { createServices } from '@/lib/services';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const body = await request.json();
    const parsed = PostMessageRequestSchema.safeParse(body);

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

    const result = await orchestrator.handleStep(
      id,
      parsed.data.currentStep,
      parsed.data.content,
      parsed.data.structuredAnswers,
    );

    return NextResponse.json({
      userFacingResponse: result.userFacingResponse,
      extractedUpdates: result.extractedUpdates,
      requestedFollowUp: result.requestedFollowUp,
      modelVersion: result.modelVersion,
      promptVersion: result.promptVersion,
      fallbackUsed: result.fallbackUsed,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
