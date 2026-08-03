'use client';

import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface SessionSummary {
  id: string;
  userId: string;
  mode: string;
  language: string;
  status: string;
  modelVersion: string;
  promptVersion: string;
  startedAt: string;
  completedAt: string | null;
  structuredSummary: {
    primary_concern: string;
    concern_duration: string;
    sleep_impact: string;
    daily_functioning_impact: string;
    support_preference: string;
    feels_safe: string;
    key_points: string[];
  } | null;
}

interface SymptomEntry {
  id: string;
  text: string;
  category: string;
  severity: string;
  frequency: string;
  impact: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

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
  SESSION_DELETED: 'Session deleted',
  USER_REGISTERED: 'Account created',
  USER_LOGGED_IN: 'You logged in',
  PROFESSIONAL_LOGGED_IN: 'Clinician logged in',
  LOGIN_FAILED: 'Login attempt failed',
  SYMPTOM_RECORDED: 'Symptom recorded',
  SYMPTOM_DELETED: 'Symptom deleted',
  CHATBOT_MESSAGE_EXCHANGED: 'Chatbot conversation',
};

const DURATION_LABELS: Record<string, string> = {
  days: 'A few days',
  weeks: 'A few weeks',
  months: 'Several months',
  over_year: 'Over a year',
};

const SLEEP_LABELS: Record<string, string> = {
  none: 'No impact',
  mild: 'Mild impact',
  significant: 'Significant impact',
  severe: 'Severe impact',
};

const FUNCTIONING_LABELS: Record<string, string> = {
  none: 'No impact',
  mild: 'Mild impact',
  moderate: 'Moderate impact',
  significant: 'Significant impact',
};

const SUPPORT_LABELS: Record<string, string> = {
  general_reflection: 'General reflection',
  professional_support: 'Professional support',
  immediate_resources: 'Immediate resources',
};

const SAFETY_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  prefer_not_to_answer: 'Prefer not to answer',
};

const SYMPTOM_CATEGORY_LABELS: Record<string, string> = {
  sleep: 'Sleep',
  mood: 'Mood',
  energy: 'Energy',
  focus: 'Focus',
  physical_tension: 'Physical tension',
  social: 'Social',
  work_stress: 'Work stress',
  other: 'Other',
};

function dotColor(eventType: string): string {
  if (eventType.startsWith('CHECK_IN') || eventType.startsWith('SUMMARY')) return 'bg-blue-400';
  if (eventType.startsWith('SAFEGUARD') || eventType.startsWith('MODEL_FALLBACK')) return 'bg-red-400';
  if (eventType.startsWith('ROUTING')) return 'bg-yellow-400';
  if (eventType.startsWith('HANDOFF')) return 'bg-purple-400';
  if (eventType.startsWith('CARE_PLAN')) return 'bg-green-400';
  if (eventType === 'SESSION_DELETED') return 'bg-orange-400';
  if (eventType.startsWith('USER_') || eventType.startsWith('PROFESSIONAL_') || eventType === 'LOGIN_FAILED') return 'bg-indigo-400';
  if (eventType.startsWith('SYMPTOM')) return 'bg-teal-400';
  if (eventType.startsWith('CHATBOT')) return 'bg-pink-400';
  return 'bg-gray-400';
}

function actorLabel(actor: string): string {
  if (actor === 'user') return 'You';
  if (actor === 'clinician') return 'Clinician';
  if (actor === 'system') return 'System';
  if (actor.startsWith('profile-')) return actor.replace('profile-', '').replace(/-/g, ' ');
  return actor;
}

function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function PrivacyPage(): React.ReactNode {
  // Audit timeline state
  const [events, setEvents] = useState<AuditEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summaries state
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Symptoms state
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [symptomsLoading, setSymptomsLoading] = useState(true);
  const [symptomsError, setSymptomsError] = useState<string | null>(null);
  const [deletingSymptomId, setDeletingSymptomId] = useState<string | null>(null);

  // Fetch audit events
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

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      if (!cancelled) setSessionsLoading(true);
      if (!cancelled) setSessionsError(null);
      try {
        const res = await fetch('/api/check-ins');
        if (!res.ok) throw new Error('Failed to fetch check-in sessions');
        const data = await res.json();
        if (!cancelled) setSessions(data.sessions ?? []);
      } catch (err) {
        if (!cancelled) setSessionsError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSymptoms(): Promise<void> {
      if (!cancelled) setSymptomsLoading(true);
      if (!cancelled) setSymptomsError(null);
      try {
        const res = await fetch('/api/symptoms');
        if (!res.ok) {
          if (res.status === 401) {
            // Anonymous users have no symptoms to show.
            if (!cancelled) setSymptoms([]);
            return;
          }
          throw new Error('Failed to fetch symptom entries');
        }
        const data = await res.json();
        if (!cancelled) {
          setSymptoms((data.symptoms ?? []).map((s: SymptomEntry) => ({
            ...s,
            createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString(),
          })));
        }
      } catch (err) {
        if (!cancelled) setSymptomsError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setSymptomsLoading(false);
      }
    }
    loadSymptoms();
    return () => { cancelled = true; };
  }, []);

  // Delete handler
  const handleDelete = async (sessionId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this check-in summary? This action cannot be undone.')) {
      return;
    }
    setDeletingId(sessionId);
    setDeleteSuccess(null);
    try {
      const res = await fetch(`/api/privacy/check-ins/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to delete session');
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setDeleteSuccess('Summary deleted successfully.');
      // Refresh audit events to show the SESSION_DELETED event
      const auditRes = await fetch('/api/audit/me');
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setEvents(auditData.events ?? []);
      }
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSymptom = async (symptomId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this symptom entry? This action cannot be undone.')) {
      return;
    }
    setDeletingSymptomId(symptomId);
    try {
      const res = await fetch(`/api/symptoms/${symptomId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to delete symptom');
      }
      setSymptoms((prev) => prev.filter((s) => s.id !== symptomId));
      setDeleteSuccess('Symptom entry deleted successfully.');
      // Refresh audit events to show the SYMPTOM_DELETED event
      const auditRes = await fetch('/api/audit/me');
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setEvents(auditData.events ?? []);
      }
    } catch (err) {
      setSymptomsError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingSymptomId(null);
    }
  };

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

        {/* ── Audit Timeline Section ─────────────────────────────────────── */}
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
              <div
                className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"
                aria-hidden="true"
              />

              <ul className="space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="relative pl-9">
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

        {/* ── Consent Status Section ─────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-text mb-4">Consent Status</h2>

          <div className="bg-surface border border-text/10 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm text-text font-medium">Professional Handoff Consent</p>
                <p className="text-sm text-text-muted mt-1">
                  Consent records are displayed when handoffs are created. Consent is required
                  before any professional handoff is sent.
                </p>
              </div>
            </div>

            {/* Show consent-granted events from the audit timeline */}
            {events.filter((e) => e.eventType === 'HANDOFF_CONSENT_GRANTED').length > 0 && (
              <div className="mt-4 pt-4 border-t border-text/10">
                <p className="text-xs font-medium text-text mb-2">Granted consent events:</p>
                <ul className="space-y-2">
                  {events
                    .filter((e) => e.eventType === 'HANDOFF_CONSENT_GRANTED')
                    .map((e) => (
                      <li key={e.id} className="text-xs text-text-muted flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
                        <span>{new Date(e.timestamp).toLocaleString()}</span>
                        {typeof e.details.handoffId === 'string' && e.details.handoffId.length > 0 && (
                          <span className="text-text-muted/60">
                            — handoff: {e.details.handoffId.slice(0, 12)}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ── Structured Summaries Section ───────────────────────────────── */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-text mb-4">Structured Summaries</h2>

          {deleteSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm mb-4">
              {deleteSuccess}
            </div>
          )}

          {sessionsLoading && (
            <p className="text-text-muted text-sm">Loading summaries&hellip;</p>
          )}

          {sessionsError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
              Error: {sessionsError}
            </div>
          )}

          {!sessionsLoading && sessions.length === 0 && (
            <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
              <p className="text-text-muted text-sm">No check-in summaries yet.</p>
              <p className="text-xs text-text-muted mt-1">
                Complete a check-in to see your structured summaries here.
              </p>
            </div>
          )}

          {!sessionsLoading && sessions.length > 0 && (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-surface border border-text/10 rounded-lg p-4"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-medium text-text font-mono">
                        {truncateId(session.id)}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(session.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 whitespace-nowrap">
                      {session.status}
                    </span>
                  </div>

                  {/* Structured summary fields */}
                  {session.structuredSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs">
                      <div className="bg-gray-50 rounded p-2">
                        <span className="font-medium text-text">Primary concern:</span>{' '}
                        <span className="text-text-muted">{session.structuredSummary.primary_concern}</span>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <span className="font-medium text-text">Duration:</span>{' '}
                        <span className="text-text-muted">
                          {DURATION_LABELS[session.structuredSummary.concern_duration] ?? session.structuredSummary.concern_duration}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <span className="font-medium text-text">Sleep impact:</span>{' '}
                        <span className="text-text-muted">
                          {SLEEP_LABELS[session.structuredSummary.sleep_impact] ?? session.structuredSummary.sleep_impact}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <span className="font-medium text-text">Daily functioning:</span>{' '}
                        <span className="text-text-muted">
                          {FUNCTIONING_LABELS[session.structuredSummary.daily_functioning_impact] ?? session.structuredSummary.daily_functioning_impact}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <span className="font-medium text-text">Support preference:</span>{' '}
                        <span className="text-text-muted">
                          {SUPPORT_LABELS[session.structuredSummary.support_preference] ?? session.structuredSummary.support_preference}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <span className="font-medium text-text">Feels safe:</span>{' '}
                        <span className="text-text-muted">
                          {SAFETY_LABELS[session.structuredSummary.feels_safe] ?? session.structuredSummary.feels_safe}
                        </span>
                      </div>
                    </div>
                  )}

                  {!session.structuredSummary && (
                    <p className="text-xs text-text-muted italic mb-3">No structured summary available.</p>
                  )}

                  {/* Delete button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDelete(session.id)}
                      disabled={deletingId === session.id}
                      className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded border border-red-200 hover:border-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === session.id ? 'Deleting…' : 'Delete Summary'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Symptom Entries Section ──────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-text mb-4">Symptom Entries</h2>

          {symptomsLoading && (
            <p className="text-text-muted text-sm">Loading symptom entries&hellip;</p>
          )}

          {symptomsError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
              Error: {symptomsError}
            </div>
          )}

          {!symptomsLoading && symptoms.length === 0 && (
            <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
              <p className="text-text-muted text-sm">No symptom entries yet.</p>
              <p className="text-xs text-text-muted mt-1">
                Record what you are experiencing from the summary page after a check-in.
              </p>
            </div>
          )}

          {!symptomsLoading && symptoms.length > 0 && (
            <div className="space-y-3">
              {symptoms.map((symptom) => (
                <div
                  key={symptom.id}
                  className="bg-surface border border-text/10 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium text-text">{symptom.text}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {SYMPTOM_CATEGORY_LABELS[symptom.category] ?? symptom.category} &bull; {' '}
                        {symptom.severity} &bull; {symptom.frequency.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteSymptom(symptom.id)}
                      disabled={deletingSymptomId === symptom.id}
                      className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded border border-red-200 hover:border-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {deletingSymptomId === symptom.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">Impact: {symptom.impact}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
