import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServices } from '@/lib/services';

const IMMUTABLE_STATUSES = new Set([
  'SENT',
  'CLINICIAN_ACCEPTED',
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
]);

const UpdateHandoffSchema = z.object({
  structuredSummary: z.record(z.string(), z.unknown()).optional(),
  excludedEntries: z.array(z.string()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const body = await request.json();
    const parsed = UpdateHandoffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.message },
        { status: 400 },
      );
    }

    const services = createServices();
    const handoff = await services.handoffRepo.findById(id);

    if (!handoff) {
      return NextResponse.json(
        { error: `Handoff "${id}" not found.` },
        { status: 404 },
      );
    }

    if (IMMUTABLE_STATUSES.has(handoff.status)) {
      return NextResponse.json(
        { error: 'Handoff is immutable after sending' },
        { status: 409 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.structuredSummary !== undefined) {
      updates.structuredSummary = parsed.data.structuredSummary;
    }
    if (parsed.data.excludedEntries !== undefined) {
      updates.excludedEntries = parsed.data.excludedEntries;
    }

    const updated = await services.handoffRepo.update(id, updates as never);

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      version: updated.version,
      structuredSummary: updated.structuredSummary,
      excludedEntries: updated.excludedEntries,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
