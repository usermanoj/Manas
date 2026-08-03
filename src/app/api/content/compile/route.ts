import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServices, createContentModuleOrchestrator } from '@/lib/services';

/**
 * POST /api/content/compile
 *
 * Accepts pasted wellbeing content text and extracts a structured draft
 * module using deterministic text parsing (NOT AI/ModelGateway).
 *
 * P0 scope: creates DRAFT only — never represents as clinically approved.
 *
 * Request body: { pastedText: string, language: 'en' }
 * Response: { draftModule, draftVersion, validationWarnings }
 */

const CompileRequestSchema = z.object({
  pastedText: z.string().min(1, 'pastedText must not be empty'),
  language: z.literal('en'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = CompileRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();
    const orchestrator = createContentModuleOrchestrator(services);

    // Extract structured draft from pasted text (deterministic, no AI)
    const { draftModule, draftVersion, validationWarnings } =
      orchestrator.extractDraftFromText(parsed.data.pastedText, parsed.data.language);

    // Persist the draft module and version
    const { module, version } = await orchestrator.createDraft(draftModule, draftVersion);

    return NextResponse.json(
      {
        draftModule: {
          id: module.id,
          title: module.title,
          purpose: module.purpose,
          status: module.status,
          currentVersionId: module.currentVersionId ?? null,
          primaryLanguage: module.primaryLanguage,
        },
        draftVersion: {
          id: version.id,
          moduleId: version.moduleId,
          versionNumber: version.versionNumber,
          steps: version.steps,
          warnings: version.warnings,
          contraindications: version.contraindications,
          escalationConditions: version.escalationConditions,
          language: version.language,
          reviewStatus: version.reviewStatus,
          translationStatus: version.translationStatus,
        },
        validationWarnings,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
