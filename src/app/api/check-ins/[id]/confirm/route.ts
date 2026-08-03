import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StructuredCheckInSchema } from '@/domain/ai';
import { createServices, createCheckInOrchestrator } from '@/lib/services';

const ConfirmRouteRequestSchema = z.object({
  confirmedSummary: StructuredCheckInSchema,
  draftSummary: StructuredCheckInSchema.optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const body = await request.json();
    const parsed = ConfirmRouteRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();
    const orchestrator = createCheckInOrchestrator(services);

    const result = await orchestrator.confirmSummary(
      id,
      parsed.data.confirmedSummary,
      parsed.data.draftSummary,
    );

    return NextResponse.json({
      confirmedSummary: result.confirmedSummary,
      routingDecision: result.routingDecision,
      routingState: result.routingState,
      policyVersion: result.policyVersion,
      edited: result.edited,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
