import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StructuredCheckInSchema } from '@/domain/ai';
import { CheckInOrchestrator } from '@/domain/check-in';
import { createServices } from '@/lib/services';

const CompleteCheckInRequestSchema = z.object({
  structuredAnswers: StructuredCheckInSchema,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const body = await request.json();
    const parsed = CompleteCheckInRequestSchema.safeParse(body);

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

    const result = await orchestrator.completeSession(
      id,
      parsed.data.structuredAnswers,
    );

    return NextResponse.json({
      draftSummary: result.draftSummary,
      provisionalRouting: result.provisionalRouting,
      modelVersion: result.modelVersion,
      promptVersion: result.promptVersion,
      policyVersion: result.policyVersion,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
