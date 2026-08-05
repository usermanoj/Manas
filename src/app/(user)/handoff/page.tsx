'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import { ContactGate } from '@/components/providers/ContactGate';
import { WELLBEING_TECHNIQUES } from '@/domain/wellbeing/technique-library';
import { TechniqueCard, CollapsibleSources } from '@/components/check-in/ProposedTechniques';

const DEFAULT_PROVIDER_ID = 'provider-dr-maya-rao';

interface StructuredSummary {
  primary_concern: string;
  concern_duration: string;
  sleep_impact: string;
  daily_functioning_impact: string;
  support_preference: string;
  feels_safe: string;
  key_points: string[];
  /** Technique ids Manas suggested during the check-in — shared as context. */
  techniquesUsed?: string[];
}

interface ProviderData {
  id: string;
  name: string;
  title: string;
  languages: string[];
  focusAreas: string[];
  isFictionalDemo: boolean;
  /** Marks a genuine provider — displayed as "Actual Profile", like the professionals page. */
  isActualProfile?: boolean;
}

interface HandoffState {
  id: string;
  status: string;
  version: number;
  structuredSummary: StructuredSummary;
  excludedEntries: string[];
  providerId: string;
  createdAt: string | null;
  sentAt: string | null;
}

/**
 * Handoffs may only be refreshed from newer check-ins while unsent — once
 * sent, consent is bound to that exact immutable version.
 */
const REFRESHABLE_STATUSES = new Set(['DRAFT', 'USER_REVIEW']);

function summariesEqual(a: StructuredSummary | null | undefined, b: StructuredSummary): boolean {
  if (!a) return false;
  return (
    a.primary_concern === b.primary_concern &&
    a.concern_duration === b.concern_duration &&
    a.sleep_impact === b.sleep_impact &&
    a.daily_functioning_impact === b.daily_functioning_impact &&
    a.support_preference === b.support_preference &&
    a.feels_safe === b.feels_safe &&
    JSON.stringify(a.key_points ?? []) === JSON.stringify(b.key_points ?? [])
  );
}

/**
 * Compute a SHA-256 preview hash for the given summary + excluded entries.
 */
async function computePreviewHash(summary: StructuredSummary, excluded: string[]): Promise<string> {
  const payload = JSON.stringify({ summary, excluded });
  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format an ISO timestamp for audit display with an explicit GMT offset label
 * (e.g. "5 Aug 2026, 14:32 GMT+8") so interactions are unambiguous.
 */
function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '−';
  const h = Math.floor(Math.abs(offsetMin) / 60);
  const m = Math.abs(offsetMin) % 60;
  const gmt = `GMT${sign}${h}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}`;
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time} ${gmt}`;
}

function HandoffPageContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId') ?? DEFAULT_PROVIDER_ID;

  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const [previewHash, setPreviewHash] = useState<string>('');
  // True when the user has no confirmed check-in to seed a handoff from.
  const [needsCheckIn, setNeedsCheckIn] = useState(false);
  // When the draft summary came from — shown as a provenance note.
  const [summarySource, setSummarySource] = useState<string | null>(null);

  // Compute hash whenever summary or excluded entries change
  useEffect(() => {
    if (!handoff) return;
    computePreviewHash(handoff.structuredSummary, handoff.excludedEntries).then(setPreviewHash);
  }, [handoff]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch provider details
        const provRes = await fetch('/api/providers');
        if (provRes.ok) {
          const provData = await provRes.json();
          const found = (provData.providers ?? []).find(
            (p: ProviderData) => p.id === providerId,
          );
          if (found && !cancelled) setProvider(found);
        }

        // Look for existing handoff
        const listRes = await fetch('/api/handoffs');
        let existing: (HandoffState & { createdAt?: string }) | null = null;
        if (listRes.ok) {
          const listData = await listRes.json();
          existing = (listData.handoffs ?? []).find(
            (h: HandoffState & { providerId: string }) =>
              h.providerId === providerId,
          ) ?? null;
        }

        // Latest confirmed check-in — the source of truth for the handoff
        // content whenever the handoff has not been sent yet.
        const checkInsRes = await fetch('/api/check-ins');
        let latestSummary: StructuredSummary | null = null;
        let latestSource: string | null = null;
        if (checkInsRes.ok) {
          const checkInData = await checkInsRes.json() as {
            sessions: Array<{
              structuredSummary: StructuredSummary | null;
              completedAt: string | null;
              startedAt: string;
            }>;
          };
          const confirmedSessions = (checkInData.sessions ?? [])
            .filter((s) => s.structuredSummary !== null)
            .sort(
              (a, b) =>
                new Date(b.completedAt ?? b.startedAt).getTime() -
                new Date(a.completedAt ?? a.startedAt).getTime(),
            );
          if (confirmedSessions.length > 0) {
            latestSummary = confirmedSessions[0].structuredSummary;
            latestSource = confirmedSessions[0].completedAt ?? confirmedSessions[0].startedAt;
          }
        }

        if (existing) {
          const unsentAndRefreshable =
            REFRESHABLE_STATUSES.has(existing.status) &&
            latestSummary !== null &&
            !summariesEqual(existing.structuredSummary, latestSummary);

          if (unsentAndRefreshable) {
            // A newer confirmed check-in exists — refresh the unsent draft so
            // the handoff always reflects the user's exact confirmed entries.
            const patchRes = await fetch(`/api/handoffs/${existing.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ structuredSummary: latestSummary }),
            });
            if (patchRes.ok) {
              const patched = await patchRes.json();
              if (!cancelled) {
                setHandoff({
                  id: existing.id,
                  status: patched.status,
                  version: patched.version,
                  structuredSummary: latestSummary as StructuredSummary,
                  excludedEntries: existing.excludedEntries,
                  providerId: existing.providerId,
                  createdAt: existing.createdAt ?? null,
                  sentAt: existing.sentAt,
                });
                setSummarySource(latestSource);
                setLoading(false);
              }
              return;
            }
            // PATCH failed (e.g. became immutable) — fall through and show as-is.
          }

          if (!cancelled) {
            setHandoff({
              id: existing.id,
              status: existing.status,
              version: existing.version,
              structuredSummary: existing.structuredSummary as StructuredSummary,
              excludedEntries: existing.excludedEntries as string[],
              providerId: existing.providerId,
              createdAt: existing.createdAt ?? null,
              sentAt: existing.sentAt,
            });
            if (existing.status === 'SENT') {
              setSentConfirmation(true);
            } else if (latestSummary && summariesEqual(existing.structuredSummary, latestSummary)) {
              // Unsent and already in sync — show where the content came from.
              setSummarySource(latestSource);
            }
            setLoading(false);
          }
          return;
        }

        // No existing handoff — seed a new DRAFT from the user's latest
        // confirmed check-in so the handoff always contains their own words.

        if (!latestSummary) {
          // Nothing confirmed yet — guide the user to complete a check-in.
          if (!cancelled) setNeedsCheckIn(true);
          return;
        }

        const createRes = await fetch('/api/handoffs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            structuredSummary: latestSummary,
            excludedEntries: [],
          }),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error ?? 'Failed to create handoff');
        }
        const created = await createRes.json();
        if (!cancelled) {
          setHandoff({
            id: created.id,
            status: created.status,
            version: created.version,
            structuredSummary: latestSummary,
            excludedEntries: [],
            providerId,
            createdAt: created.createdAt ?? new Date().toISOString(),
            sentAt: null,
          });
          setSummarySource(latestSource);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  const handleSend = async (): Promise<void> => {
    if (!handoff || !consentGiven) return;
    setSending(true);
    setError(null);
    try {
      // Step 1: Ensure handoff is in USER_REVIEW (submit if still DRAFT)
      if (handoff.status === 'DRAFT') {
        const submitRes = await fetch(`/api/handoffs/${handoff.id}/submit-for-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!submitRes.ok) {
          const err = await submitRes.json();
          throw new Error(err.error ?? 'Failed to submit handoff for review');
        }
      }

      // Step 2: Consent and send
      const sendRes = await fetch(`/api/handoffs/${handoff.id}/consent-and-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          explicitConsent: true,
          consentVersion: 'consent-v1',
          previewHash,
        }),
      });
      if (!sendRes.ok) {
        const err = await sendRes.json();
        throw new Error(err.error ?? 'Failed to send handoff');
      }

      setSentConfirmation(true);
      setHandoff((prev) => prev ? { ...prev, status: 'SENT', sentAt: new Date().toISOString() } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  const isSent = sentConfirmation || handoff?.status === 'SENT';
  const providerName = provider?.name ?? 'Dr. Maya Rao';
  const isActualProvider = Boolean(provider?.isActualProfile);

  // Resolve the technique ids Manas suggested during the check-in so the
  // professional sees the same practices the user was offered.
  const proposedPractices = WELLBEING_TECHNIQUES.filter(
    (t) => handoff?.structuredSummary.techniquesUsed?.includes(t.id),
  );
  // Aggregate + dedupe the practices' citations for the Sources panel,
  // mirroring the linked sources shown to the user on the summary page.
  const practiceCitations = (() => {
    const seen = new Set<string>();
    const list: Array<{ source: string; title?: string; url?: string; year?: string; description?: string }> = [];
    for (const t of proposedPractices) {
      for (const c of t.citations) {
        if (seen.has(c.source)) continue;
        seen.add(c.source);
        list.push(c);
      }
    }
    return list;
  })();

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <ContactGate
          title="Save your contact details before sending a handoff"
          description="Please sign in or create a free account so the professional can respond to your request in this demonstration workspace."
        >
        <div className="flex items-center justify-between mb-6">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
            Handoff to a Professional
          </h1>
        </div>

        {loading && <p className="text-text-muted">Loading handoff&hellip;</p>}

        {!loading && needsCheckIn && !error && (
          <div className="bg-surface border border-text/10 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">Start with a check-in</h2>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-5">
              A handoff shares <span className="font-medium text-text">your own confirmed summary</span> with
              a professional &mdash; never placeholder text. Complete a check-in first and Manas will
              prepare your handoff from it automatically.
            </p>
            <Link
              href="/check-in"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors"
            >
              Begin a check-in
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
            Error: {error}
          </div>
        )}

        {!loading && handoff && (
          <div className="space-y-6">

            {/* Tracking strip — timestamps for audit & tracing across interactions */}
            <div data-testid="handoff-tracking" className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-surface border border-text/10 rounded-xl px-4 py-2.5 text-xs text-text-muted">
              {handoff.createdAt && (
                <span>
                  <span className="font-semibold text-text">Prepared:</span> {formatAuditTimestamp(handoff.createdAt)}
                </span>
              )}
              {handoff.sentAt && (
                <span>
                  <span className="font-semibold text-text">Submitted:</span> {formatAuditTimestamp(handoff.sentAt)}
                </span>
              )}
              <span>
                <span className="font-semibold text-text">Version:</span> v{handoff.version}
              </span>
              <span>
                <span className="font-semibold text-text">Status:</span> {handoff.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Structured Summary */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-medium text-text">Your Check-in Summary</h2>
                {summarySource && (
                  <span className="text-xs text-text-muted">
                    From your confirmed check-in &middot; {new Date(summarySource).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className={`bg-surface border border-text/10 rounded-lg p-5 ${isSent ? 'opacity-75' : ''}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-text">Primary concern</span>
                    <p className="text-text-muted">{handoff.structuredSummary.primary_concern}</p>
                  </div>
                  <div>
                    <span className="font-medium text-text">Duration</span>
                    <p className="text-text-muted capitalize">{handoff.structuredSummary.concern_duration}</p>
                  </div>
                  <div>
                    <span className="font-medium text-text">Sleep impact</span>
                    <p className="text-text-muted capitalize">{handoff.structuredSummary.sleep_impact}</p>
                  </div>
                  <div>
                    <span className="font-medium text-text">Daily functioning</span>
                    <p className="text-text-muted capitalize">{handoff.structuredSummary.daily_functioning_impact}</p>
                  </div>
                  <div>
                    <span className="font-medium text-text">Support preference</span>
                    <p className="text-text-muted capitalize">{handoff.structuredSummary.support_preference.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <span className="font-medium text-text">Feels safe</span>
                    <p className="text-text-muted capitalize">{handoff.structuredSummary.feels_safe}</p>
                  </div>
                </div>

                {handoff.structuredSummary.key_points.length > 0 && (
                  <div className="mt-4">
                    <span className="text-sm font-medium text-text">Key points</span>
                    <ul className="mt-1 space-y-1">
                      {handoff.structuredSummary.key_points.map((pt, i) => (
                        <li key={i} className="text-sm text-text-muted pl-4">&bull; {pt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {/* Proposed Practices — techniques Manas suggested during the check-in */}
            {proposedPractices.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-medium text-text">Proposed Practices</h2>
                  <span className="text-xs text-text-muted">Suggested by Manas during the check-in</span>
                </div>
                <div className={`bg-surface border border-text/10 rounded-lg p-5 ${isSent ? 'opacity-75' : ''}`}>
                  <p className="text-xs text-text-muted mb-4">
                    Tap a practice to expand its steps. These were suggested to the user by the Manas
                    companion during the check-in and are shown here exactly as presented to them &mdash;
                    educational, evidence-informed self-help material, not a prescription or clinically
                    reviewed guidance.
                  </p>
                  <div className="space-y-3">
                    {proposedPractices.map((t) => (
                      <TechniqueCard key={t.id} technique={t} />
                    ))}
                  </div>
                  <CollapsibleSources citations={practiceCitations} />
                </div>
              </section>
            )}

            {/* Destination Provider */}
            <section>
              <h2 className="text-lg font-medium text-text mb-3">Destination Provider</h2>
              <div className={`bg-surface border rounded-lg p-5 ${isActualProvider ? 'border-primary/30 ring-1 ring-primary/20' : 'border-text/10'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-sm font-medium text-text">{providerName}</p>
                  {isActualProvider ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white bg-gradient-to-r from-primary to-primary-light shadow-sm shadow-primary/25">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Actual Profile
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                      Fictional Provider
                    </span>
                  )}
                </div>
                {provider && (
                  <div className="text-sm text-text-muted space-y-1">
                    <p>{provider.title}</p>
                    <p>Languages: {provider.languages.join(', ')}</p>
                    <p>Focus: {provider.focusAreas.join(', ')}</p>
                  </div>
                )}
                <p className="mt-3 text-xs text-text-muted italic">
                  {isActualProvider
                    ? 'This is an actual professional profile on the Manas network. With your consent, this handoff shares your approved summary with this professional.'
                    : 'This is a fictional demonstration provider. No real clinician is linked to this record.'}
                </p>
              </div>
            </section>

            {/* Excluded Entries */}
            <section>
              <h2 className="text-lg font-medium text-text mb-3">Excluded Entries</h2>
              <p className="text-sm text-text-muted mb-2">
                The following entries will <strong>not</strong> be shared with the provider:
              </p>
              <div className="bg-surface border border-text/10 rounded-lg p-5">
                {handoff.excludedEntries.length === 0 ? (
                  <p className="text-sm text-text-muted italic">No entries excluded.</p>
                ) : (
                  <ul className="space-y-1">
                    {handoff.excludedEntries.map((entry, i) => (
                      <li key={i} className="text-sm text-text-muted pl-4 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">&#x2716;</span>
                        <span>{entry}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Preview Hash */}
            <section>
              <h2 className="text-lg font-medium text-text mb-2">Version Integrity</h2>
              <p className="text-xs text-text-muted mb-1">
                A SHA-256 fingerprint is computed from the current summary and excluded entries.
                Your consent is bound to this exact version.
              </p>
              <code className="block bg-gray-50 border border-text/10 rounded-lg px-3 py-2 text-xs text-gray-600 break-all">
                {previewHash || 'Computing…'}
              </code>
            </section>

            {/* Consent & Send */}
            {!isSent && (
              <section>
                <div className="bg-surface border border-indigo-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <input
                      id="consent-checkbox"
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 flex-shrink-0"
                    />
                    <label htmlFor="consent-checkbox" className="text-sm text-text cursor-pointer">
                      I understand and agree to share this exact handoff version with{' '}
                      <span className="font-semibold">{providerName}</span>
                      {isActualProvider
                        ? ', an actual professional on the Manas network.'
                        : ' within this fictional demonstration workspace.'}
                    </label>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800">
                      <strong>Consent notice:</strong> Your consent applies to this exact handoff
                      version{isActualProvider
                        ? ' only. You can exclude entries above before sending.'
                        : ' and fictional destination. No real clinician has received or reviewed it.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!consentGiven || sending}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? 'Sending…' : 'Send Handoff'}
                  </button>
                </div>
              </section>
            )}

            {/* Sent confirmation */}
            {isSent && (
              <section>
                <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-600 text-white">
                      SENT
                    </span>
                    {handoff.sentAt && (
                      <span className="text-sm text-green-800 font-medium">
                        {formatAuditTimestamp(handoff.sentAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-green-800 font-medium">
                    {isActualProvider
                      ? `Your approved handoff has been sent to ${providerName}. They will see only the information in this exact version.`
                      : 'Your approved handoff has been sent within this fictional demonstration workspace. No real clinician has received or reviewed it.'}
                  </p>
                  <p className="text-xs text-green-700 mt-2">
                    This handoff is now read-only and immutable. Version {handoff.version}.
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
        </ContactGate>
      </div>
    </Layout>
  );
}

export default function HandoffPage(): React.ReactNode {
  return (
    <Suspense fallback={
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    }>
      <HandoffPageContent />
    </Suspense>
  );
}
