'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import { ContactGate } from '@/components/providers/ContactGate';

const DEFAULT_PROVIDER_ID = 'provider-dr-maya-rao';

interface StructuredSummary {
  primary_concern: string;
  concern_duration: string;
  sleep_impact: string;
  daily_functioning_impact: string;
  support_preference: string;
  feels_safe: string;
  key_points: string[];
}

interface ProviderData {
  id: string;
  name: string;
  title: string;
  languages: string[];
  focusAreas: string[];
  isFictionalDemo: boolean;
}

interface HandoffState {
  id: string;
  status: string;
  version: number;
  structuredSummary: StructuredSummary;
  excludedEntries: string[];
  providerId: string;
  sentAt: string | null;
}

/**
 * Demo summary used when creating a new handoff.
 * Mirrors what a real check-in would produce.
 */
const DEMO_SUMMARY: StructuredSummary = {
  primary_concern: 'Work-related stress and burnout',
  concern_duration: 'months',
  sleep_impact: 'mild',
  daily_functioning_impact: 'mild',
  support_preference: 'professional_support',
  feels_safe: 'yes',
  key_points: [
    'Feeling overwhelmed with workload',
    'Difficulty switching off in the evenings',
    'Mild sleep disruption 2–3 nights per week',
  ],
};

const DEMO_EXCLUDED: string[] = [
  'Personal relationship details shared on 2026-07-10',
  'Financial stress mention on 2026-07-15',
];

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

  // Compute hash whenever summary or excluded entries change
  useEffect(() => {
    const summary = handoff?.structuredSummary ?? DEMO_SUMMARY;
    const excluded = handoff?.excludedEntries ?? DEMO_EXCLUDED;
    computePreviewHash(summary, excluded).then(setPreviewHash);
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
        if (listRes.ok) {
          const listData = await listRes.json();
          const existing = (listData.handoffs ?? []).find(
            (h: HandoffState & { providerId: string }) =>
              h.providerId === providerId,
          );
          if (existing) {
            if (!cancelled) {
              setHandoff({
                id: existing.id,
                status: existing.status,
                version: existing.version,
                structuredSummary: existing.structuredSummary as StructuredSummary,
                excludedEntries: existing.excludedEntries as string[],
                providerId: existing.providerId,
                sentAt: existing.sentAt,
              });
              if (existing.status === 'SENT') setSentConfirmation(true);
              setLoading(false);
            }
            return;
          }
        }

        // No existing handoff — create a new DRAFT
        const createRes = await fetch('/api/handoffs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            structuredSummary: DEMO_SUMMARY,
            excludedEntries: DEMO_EXCLUDED,
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
            structuredSummary: DEMO_SUMMARY,
            excludedEntries: DEMO_EXCLUDED,
            providerId,
            sentAt: null,
          });
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
            Error: {error}
          </div>
        )}

        {!loading && handoff && (
          <div className="space-y-6">

            {/* Structured Summary */}
            <section>
              <h2 className="text-lg font-medium text-text mb-3">Your Check-in Summary</h2>
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

            {/* Destination Provider */}
            <section>
              <h2 className="text-lg font-medium text-text mb-3">Destination Provider</h2>
              <div className="bg-surface border border-text/10 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-sm font-medium text-text">{providerName}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                    Fictional Provider
                  </span>
                </div>
                {provider && (
                  <div className="text-sm text-text-muted space-y-1">
                    <p>{provider.title}</p>
                    <p>Languages: {provider.languages.join(', ')}</p>
                    <p>Focus: {provider.focusAreas.join(', ')}</p>
                  </div>
                )}
                <p className="mt-3 text-xs text-text-muted italic">
                  This is a fictional demonstration provider. No real clinician is linked to this record.
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
                      <span className="font-semibold">{providerName}</span> within this fictional
                      demonstration workspace.
                    </label>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800">
                      <strong>Consent notice:</strong> Your consent applies to this exact handoff
                      version and fictional destination. No real clinician has received or reviewed it.
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
                      <span className="text-xs text-text-muted">
                        at {new Date(handoff.sentAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-green-800 font-medium">
                    Your approved handoff has been sent within this fictional demonstration workspace.
                    No real clinician has received or reviewed it.
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
