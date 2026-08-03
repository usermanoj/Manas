import { NextRequest, NextResponse } from 'next/server';
import { createServices } from '@/lib/services';
import { AuditEventType } from '@/domain/audit/event-types';

const DEMO_USER_ID = 'profile-ananya-sharma';

/**
 * DELETE /api/privacy/check-ins/[id]
 *
 * Deletes a check-in session and its associated safety assessments.
 * Logs a SESSION_DELETED audit event for the audit timeline.
 */
export async function DELETE(
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

    // Delete associated safety assessments (find by sessionId)
    const assessments = await services.safetyAssessmentRepo.findAll({ sessionId: id } as never);
    for (const assessment of assessments) {
      await services.safetyAssessmentRepo.delete(assessment.id);
    }

    // Delete the session itself
    await services.sessionRepo.delete(id);

    // Log audit event
    await services.auditLogger.log({
      requestId: `privacy-delete-${Date.now()}`,
      userId: DEMO_USER_ID,
      actor: 'user',
      eventType: AuditEventType.SESSION_DELETED,
      details: {
        deletedSessionId: id,
        deletedAssessmentCount: assessments.length,
      },
    });

    return NextResponse.json({
      deleted: true,
      deletedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
