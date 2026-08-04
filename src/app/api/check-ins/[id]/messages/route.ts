import { NextRequest, NextResponse } from 'next/server';
import { PostMessageRequestSchema } from '@/domain/ai';
import { createServices, createCheckInOrchestrator } from '@/lib/services';

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
    const orchestrator = createCheckInOrchestrator(services);

    const result = await orchestrator.handleStep(
      id,
      parsed.data.currentStep,
      parsed.data.content,
      parsed.data.structuredAnswers,
      parsed.data.turnNumber,
      parsed.data.sessionTechniques,
      parsed.data.sessionUserMessages,
    );

    return NextResponse.json({
      userFacingResponse: result.userFacingResponse,
      extractedUpdates: result.extractedUpdates,
      requestedFollowUp: result.requestedFollowUp,
      modelVersion: result.modelVersion,
      promptVersion: result.promptVersion,
      fallbackUsed: result.fallbackUsed,
      isComplete: result.isComplete,
      archetypes: result.archetypes,
      primaryArchetype: result.primaryArchetype,
      techniques: result.techniques,
      followUpQuestions: result.followUpQuestions,
      inferredSymptoms: result.inferredSymptoms,
      safetyFlag: result.safetyFlag,
      safetyMessage: result.safetyMessage,
      crossSessionInsight: result.crossSessionInsight,
      readiness: result.readiness,
      citations: result.citations,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
