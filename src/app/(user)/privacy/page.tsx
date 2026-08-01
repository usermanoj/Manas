'use client';

import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';

interface AuditEventData {
  id: string;
  timestamp: string;
  requestId: string;
  userId: string;
  actor: string;
  eventType: string;
  details: Record<string, unknown>;
  policyVersion: string | null;
  modelVersion: string | null;
  promptVersion: string | null;
}

/**
 * Human-readable label for each audit event type.
 */
const EVENT_LABELS: Record<string, string> = {
  CHECK_IN_STARTED: 'Check-in started',
  SAFEGUARD_TRIGGERED: 'Safety safeguard triggered',
  MODEL_FALLBACK_USED: 'AI fallback used',
  SUMMARY_GENERATED: 'Summary generated',
  SUMMARY_EDITED: 'Summary edited',
  SUMMARY_CONFIRMED: 'Summary confirmed',
  ROUTING_DECIDED: 'Routing decision made',
  HANDOFF_DRAFT_CREATED: 'Handoff draft created',
  HANDOFF_SUBMITTED_FOR_REVIEW: 'Handoff submitted for review',
  HANDOFF_CONSENT_GRANTED: 'Consent granted for handoff',
  HANDOFF_SENT: 'Handoff sent',
  CLINICIAN_HANDOFF_OPENED: 'Clinician opened handoff',
  CARE_PLAN_CREATED: 'Care plan created',
  CARE_PLAN_PROPOSED: 'Care plan proposed',
  CARE_PLAN_CLINICIAN_APPROVED: 'Care plan approved by clinician',
  CARE_PLAN_USER_ACCEPTED: 'Care plan accepted',
  CARE_PLAN_ACTIVATED: 'Care plan activated',
  CARE_PLAN_REVISION_CREATED: 'Care plan revision created',
  CARE_PLAN_VERSION_SUPERSEDED: 'Previous care plan version superseded',
  CARE_PLAN_PAUSED: 'Care plan paused',
  CARE_PLAN_RETIRED: 'Care plan retired',
};

/**
 * Colour class for the timeline dot based on event category.
 */
function dotColor(eventType: string): string {
  if (eventType.startsWith('CHECK_IN') || eventType.startsWith('SUMMARY')) return 'bg-blue-400';
  if (eventType.startsWith('SAFEGUARD') || eventType.startsWith('MODEL_FALLBACK')) return 'bg-red-400';
  if (eventType.startsWith('ROUTING')) return 'bg-yellow-400';
  if (eventType.startsWith('HANDOFF')) return 'bg-purple-400';
  if (eventType.startsWith('CARE_PLAN')) return 'bg-green-400';
  return 'bg-gray-400';
}

/**
 * Map actor string to a friendly label.
 */
function actorLabel(actor: string): string {
  if (actor === 'user') return 'You';
  if (actor === 'clinician') return 'Clinician';
  if (actor === 'system') return 'System';
  if (actor.startsWith('profile-')) return actor.replace('profile-', '').replace(/-/g, ' ');
  return actor;
}

export default function PrivacyPage(): React.ReactNode {
  const [events, setEvents] = useState<AuditEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents(): Promise<void> {
      try {
        const res = await fetch('/api/audit/me');
        if (!res.ok) throw new Error('Failed to fetch audit events');
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
            Privacy &amp; Memory
          </h1>
        </div>

        <p className="text-text-muted text-sm mb-8">
          This page shows a chronological log of every recorded action in your demo workspace.
          No raw conversation or reflection content is displayed here — only metadata.
        </p>

        {/* Audit Timeline Section */}
        <section>
          <h2 className="text-lg font-medium text-text mb-4">Audit Timeline</h2>

          {loading && <p className="text-text-muted text-sm">Loading audit events&hellip;</p>}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              Error: {error}
            </div>
          )}

          {!loading && events.length === 0 && (
            <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
              <p className="text-text-muted text-sm">No audit events recorded yet.</p>
              <p className="text-xs text-text-muted mt-1">
                Events will appear here once you complete a check-in, send a handoff, or activate a care plan.
              </p>
            </div>
          )}

          {events.length > 0 && (
            <div className="relative">
              {/* Vertical timeline line */}
              <div
                className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"
                aria-hidden="true"
              />

              <ul className="space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="relative pl-9">
                    {/* Timeline dot */}
                    <span
                      className={`absolute left-0 top-1.5 h-6 w-6 rounded-full border-2 border-white shadow-sm ${dotColor(event.eventType)}`}
                      aria-hidden="true"
                    />

                    <div className="bg-surface border border-text/10 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-sm font-medium text-text">
                          {EVENT_LABELS[event.eventType] ?? event.eventType.replace(/_/g, ' ')}
                        </p>
                        <span className="text-xs text-text-muted whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                          Actor: {actorLabel(event.actor)}
                        </span>
                        {event.details && Object.keys(event.details).length > 0 && (
                          <span className="text-[10px] text-text-muted">
                            {Object.entries(event.details)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
