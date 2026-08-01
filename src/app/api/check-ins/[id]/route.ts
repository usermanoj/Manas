import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/lib/services';

/**
 * GET /api/check-ins/[id]
 * Returns a check-in session by ID, including structuredSummary if confirmed.
 * Used by the summary page as a server-side fallback when sessionStorage is empty.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const services = createServices();
    const session = await services.sessionRepo.findById(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: session.id,
      userId: session.userId,
      mode: session.mode,
      language: session.language,
      status: session.status,
      modelVersion: session.modelVersion,
      promptVersion: session.promptVersion,
      startedAt: session.startedAt instanceof Date
        ? session.startedAt.toISOString()
        : session.startedAt,
      completedAt: session.completedAt instanceof Date
        ? session.completedAt.toISOString()
        : session.completedAt ?? null,
      structuredSummary: session.structuredSummary ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
