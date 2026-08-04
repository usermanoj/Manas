import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StructuredCheckInSchema } from '@/domain/ai';
import { createServices, createCheckInOrchestrator } from '@/lib/services';

const CompleteCheckInRequestSchema = z.object({
  structuredAnswers: StructuredCheckInSchema,
  variant: z.number().int().min(0).max(10).default(0),
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
    const orchestrator = createCheckInOrchestrator(services);

    const result = await orchestrator.completeSession(
      id,
      parsed.data.structuredAnswers,
      parsed.data.variant,
    );

    return NextResponse.json({
      draftSummary: result.draftSummary,
      aiNarrative: result.aiNarrative,
      suggestedKeyPoints: result.suggestedKeyPoints,
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
