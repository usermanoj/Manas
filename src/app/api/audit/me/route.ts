import { NextResponse } from 'next/server';
import { createServices } from '@/lib/services';
import type { AuditEvent } from '@/domain/repositories/types';

const DEMO_USER_ID = 'profile-ananya-sharma';

/**
 * Keys in audit event details that may contain raw user-generated content.
 * These are stripped from the public timeline to protect privacy.
 */
const SENSITIVE_DETAIL_KEYS = new Set([
  'rawConversation',
  'reflectionText',
  'fullSummary',
  'excludedFields',
  'userMessage',
  'assistantMessage',
  'confirmedSummary',
  'draftSummary',
  'structuredSummary',
]);

/**
 * Strip sensitive content from an audit event's details object.
 * Returns a new object with only safe metadata keys.
 */
function stripSensitiveDetails(details: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_DETAIL_KEYS.has(key)) continue;
    safe[key] = value;
  }
  return safe;
}

/**
 * Serialize an AuditEvent for the JSON response.
 */
function serializeEvent(e: AuditEvent): Record<string, unknown> {
  return {
    id: e.id,
    timestamp: new Date(e.timestamp).toISOString(),
    requestId: e.requestId,
    userId: e.userId,
    actor: e.actor,
    eventType: e.eventType,
    details: stripSensitiveDetails(e.details),
    policyVersion: e.policyVersion ?? null,
    modelVersion: e.modelVersion ?? null,
    promptVersion: e.promptVersion ?? null,
  };
}

/**
 * GET /api/audit/me
 *
 * Returns audit events for the current demo user, sorted most-recent-first.
 * Sensitive detail fields (raw conversation, summaries, reflection text) are
 * stripped to metadata-only.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const services = createServices();

    const allEvents = await services.auditLogger.findAll({ userId: DEMO_USER_ID });

    // Sort most recent first
    const sorted = allEvents.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return NextResponse.json({
      events: sorted.map(serializeEvent),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
