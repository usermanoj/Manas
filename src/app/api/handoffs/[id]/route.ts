import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/lib/services';
import {
  UpdateHandoffRequestSchema,
  HandoffResponseSchema,
  updateHandoff,
  excludeField,
  submitForReview,
} from '@/domain/handoff';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateHandoffRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();
    const deps = { handoffRepo: services.handoffRepo, auditLogger: services.auditLogger };

    let updated;

    switch (parsed.data.action) {
      case 'edit_fields':
        updated = await updateHandoff(deps, id, {
          structuredSummary: parsed.data.structuredSummary,
          userNote: parsed.data.userNote,
        });
        break;
      case 'exclude_entry':
        updated = await excludeField(deps, id, parsed.data.fieldKey);
        break;
      case 'add_note':
        updated = await updateHandoff(deps, id, { userNote: parsed.data.userNote });
        break;
      case 'submit_for_review':
        updated = await submitForReview(deps, id);
        break;
    }

    return NextResponse.json({ handoff: HandoffResponseSchema.parse(updated) });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return NextResponse.json(
        { error: err.message },
        { status: 404 },
      );
    }
    if (err instanceof Error && err.message.includes('Invalid handoff transition')) {
      return NextResponse.json(
        { error: err.message },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
