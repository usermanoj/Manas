'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import type {
  StructuredCheckIn,
  CompleteCheckInResponse,
  ConfirmCheckInResponse,
} from '@/domain/ai/schemas';
import type { RoutingState } from '@/domain/safety/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [
  { value: 'days', label: 'A few days' },
  { value: 'weeks', label: 'A few weeks' },
  { value: 'months', label: 'Several months' },
  { value: 'over_year', label: 'Over a year' },
] as const;

const SLEEP_IMPACT_OPTIONS = [
  { value: 'none', label: 'No impact' },
  { value: 'mild', label: 'Mild impact' },
  { value: 'significant', label: 'Significant impact' },
  { value: 'severe', label: 'Severe impact' },
] as const;

const FUNCTIONING_OPTIONS = [
  { value: 'none', label: 'No impact' },
  { value: 'mild', label: 'Mild impact' },
  { value: 'moderate', label: 'Moderate impact' },
  { value: 'significant', label: 'Significant impact' },
] as const;

const SUPPORT_OPTIONS = [
  { value: 'general_reflection', label: 'General reflection' },
  { value: 'professional_support', label: 'Professional support' },
  { value: 'immediate_resources', label: 'Immediate resources' },
] as const;

const SAFETY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' },
] as const;

const ROUTING_DISPLAY: Record<RoutingState, { title: string; description: string }> = {
  GENERAL_WELLBEING: {
    title: 'General wellbeing resources suggested',
    description: 'Your responses suggest general wellbeing resources may be helpful for everyday stress management.',
  },
  PROFESSIONAL_SUPPORT_SUGGESTED: {
    title: 'Professional support may be helpful',
    description: 'Based on your responses, speaking with a qualified professional could provide additional support.',
  },
  URGENT_SUPPORT_INFORMATION: {
    title: 'Support information provided',
    description: 'This is a synthetic demonstration. If you are in distress, please reach out to a qualified professional or emergency service.',
  },
  HUMAN_REVIEW_REQUIRED: {
    title: 'This type of situation may need human support. This demonstration does not provide live monitoring.',
    description: '',
  },
};

const PROVISIONAL_ROUTING_DISPLAY: Record<RoutingState, string> = {
  GENERAL_WELLBEING: 'General wellbeing',
  PROFESSIONAL_SUPPORT_SUGGESTED: 'Professional support may be helpful',
  URGENT_SUPPORT_INFORMATION: 'Support information',
  HUMAN_REVIEW_REQUIRED: 'Additional review may be needed',
};

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Spinner(): React.ReactNode {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

interface ErrorMessageProps {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

function ErrorMessage({ message, onRetry, retrying }: ErrorMessageProps): React.ReactNode {
  return (
    <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
      <p className="text-error font-medium mb-3">{message}</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={onRetry}
          disabled={retrying}
          className="bg-primary text-white hover:bg-primary-light rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retrying ? 'Retrying…' : 'Try Again'}
        </button>
        <Link
          href="/check-in"
          className="border border-primary text-primary hover:bg-primary hover:text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Start New Check-In
        </Link>
      </div>
    </div>
  );
}

interface RadioGroupProps {
  name: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function RadioGroup({ name, value, options, onChange, disabled }: RadioGroupProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            disabled={disabled}
            className="w-4 h-4 text-primary"
          />
          <span className="text-text">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

interface FieldCardProps {
  label: string;
  testId: string;
  children: React.ReactNode;
  note?: string;
}

function FieldCard({ label, testId, children, note }: FieldCardProps): React.ReactNode {
  return (
    <div data-testid={testId} className="bg-surface rounded-xl shadow-sm p-6">
      <label className="block text-sm font-semibold text-text mb-3">{label}</label>
      {children}
      {note && <p className="mt-2 text-xs text-text-muted italic">{note}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function SummaryPageContent(): React.ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  // Phase state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'draft' | 'confirmed'>('draft');

  // Draft data from /complete
  const [draftSummary, setDraftSummary] = useState<StructuredCheckIn | null>(null);
  const [provisionalRouting, setProvisionalRouting] = useState<CompleteCheckInResponse['provisionalRouting'] | null>(null);

  // Editable form state
  const [formData, setFormData] = useState<StructuredCheckIn | null>(null);

  // Confirm data
  const [confirmResponse, setConfirmResponse] = useState<ConfirmCheckInResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Developer info
  const [devInfo, setDevInfo] = useState<{ modelVersion: string; promptVersion: string; policyVersion: string }>({
    modelVersion: '',
    promptVersion: '',
    policyVersion: '',
  });
  const [devInfoExpanded, setDevInfoExpanded] = useState(false);

  // Load draft summary — prefer cached sessionStorage data from check-in page,
  // fall back to the GET /api/check-ins/[id] endpoint, then /complete if needed.
  const loadDraft = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ── Path 1: sessionStorage cache (fast path) ──────────────────────────
      const stored = sessionStorage.getItem('manas-check-in');
      if (stored) {
        const checkInState = JSON.parse(stored) as {
          structuredAnswers?: Record<string, unknown>;
          completeResponse?: CompleteCheckInResponse;
        };

        // If the check-in page already stored the /complete response, use it.
        if (checkInState.completeResponse) {
          const data = checkInState.completeResponse;
          setDraftSummary(data.draftSummary);
          setFormData(data.draftSummary);
          setProvisionalRouting(data.provisionalRouting);
          setDevInfo((prev) => ({
            ...prev,
            modelVersion: data.modelVersion,
            promptVersion: data.promptVersion,
            policyVersion: data.policyVersion,
          }));
          setLoading(false);
          return;
        }

        // sessionStorage has structuredAnswers but no completeResponse —
        // call /complete to produce the draft summary + provisional routing.
        const structuredAnswers = checkInState.structuredAnswers ?? checkInState;
        const completeRes = await fetch(`/api/check-ins/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredAnswers }),
        });
        if (completeRes.ok) {
          const data: CompleteCheckInResponse = await completeRes.json();
          setDraftSummary(data.draftSummary);
          setFormData(data.draftSummary);
          setProvisionalRouting(data.provisionalRouting);
          setDevInfo((prev) => ({
            ...prev,
            modelVersion: data.modelVersion,
            promptVersion: data.promptVersion,
            policyVersion: data.policyVersion,
          }));
          setLoading(false);
          return;
        }
      }

      // ── Path 2: Server-side fallback via GET /api/check-ins/[id] ───────────
      const sessionRes = await fetch(`/api/check-ins/${sessionId}`);
      if (!sessionRes.ok) {
        setError('No check-in data found. Please start a check-in first.');
        setLoading(false);
        return;
      }

      const session = await sessionRes.json() as {
        status: string;
        modelVersion: string;
        promptVersion: string;
        structuredSummary: StructuredCheckIn | null;
      };

      // If the session already has a confirmed structuredSummary, show it
      // directly in the confirmed phase (the user already confirmed it).
      if (session.structuredSummary && (session.status === 'SUMMARIZED' || session.status === 'COMPLETED')) {
        const summary = session.structuredSummary;
        setDraftSummary(summary);
        setFormData(summary);
        setDevInfo((prev) => ({
          ...prev,
          modelVersion: session.modelVersion,
          promptVersion: session.promptVersion,
          policyVersion: '',
        }));

        // If already confirmed (SUMMARIZED), try to reconstruct the confirm
        // response by calling /confirm. If that fails (already confirmed),
        // just show the draft phase — the user can still proceed.
        if (session.status === 'SUMMARIZED') {
          // Session was already confirmed — show the draft for re-review.
          // The confirm endpoint would reject a terminal session, so stay in draft.
          setProvisionalRouting(null);
        }
        // else: COMPLETED but not yet confirmed — show as editable draft.
        setLoading(false);
        return;
      }

      // ── Path 3: Session exists but not yet completed — call /complete ──────
      // Use the structuredSummary if available, otherwise use minimal defaults.
      const answersForComplete: StructuredCheckIn = session.structuredSummary ?? {
        primary_concern: 'Not recorded',
        concern_duration: 'days',
        sleep_impact: 'none',
        daily_functioning_impact: 'none',
        support_preference: 'general_reflection',
        feels_safe: 'prefer_not_to_answer',
        key_points: [],
      };

      const completeRes2 = await fetch(`/api/check-ins/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredAnswers: answersForComplete }),
      });

      if (completeRes2.ok) {
        const data: CompleteCheckInResponse = await completeRes2.json();
        setDraftSummary(data.draftSummary);
        setFormData(data.draftSummary);
        setProvisionalRouting(data.provisionalRouting);
        setDevInfo((prev) => ({
          ...prev,
          modelVersion: data.modelVersion,
          promptVersion: data.promptVersion,
          policyVersion: data.policyVersion,
        }));
      } else {
        setError('No check-in data found. Please start a check-in first.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data loading on mount requires setState in effect
    loadDraft();
  }, [loadDraft]);

  // Retry handler: redirect to check-in if no data is recoverable.
  const handleRetry = useCallback(async () => {
    if (!sessionId) {
      router.push('/check-in');
      return;
    }
    setRetrying(true);
    try {
      await loadDraft();
    } finally {
      setRetrying(false);
    }
  }, [sessionId, router, loadDraft]);

  // Confirm handler
  const handleConfirm = async (): Promise<void> => {
    if (!sessionId || !formData) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/check-ins/${sessionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedSummary: formData,
          originalDraft: draftSummary,
        }),
      });
      if (!res.ok) throw new Error('Failed to confirm summary.');
      const data: ConfirmCheckInResponse = await res.json();
      setConfirmResponse(data);
      setDevInfo((prev) => ({
        ...prev,
        policyVersion: data.policyVersion,
      }));
      setPhase('confirmed');

      // Clear check-in sessionStorage after successful confirm.
      try {
        sessionStorage.removeItem('manas-check-in');
      } catch {
        // Ignore.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setConfirming(false);
    }
  };

  // Form update helpers
  const updateField = <K extends keyof StructuredCheckIn>(key: K, value: StructuredCheckIn[K]): void => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateKeyPoint = (index: number, value: string): void => {
    setFormData((prev) => {
      if (!prev) return prev;
      const updated = [...prev.key_points];
      updated[index] = value;
      return { ...prev, key_points: updated };
    });
  };

  const addKeyPoint = (): void => {
    setFormData((prev) => {
      if (!prev || prev.key_points.length >= 10) return prev;
      return { ...prev, key_points: [...prev.key_points, ''] };
    });
  };

  const removeKeyPoint = (index: number): void => {
    setFormData((prev) => {
      if (!prev) return prev;
      const updated = prev.key_points.filter((_, i) => i !== index);
      return { ...prev, key_points: updated };
    });
  };

  // --- No session ID ---
  if (!sessionId && !loading) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <div className="text-center py-12">
            <p className="text-text-muted text-lg mb-4">Start a check-in to see your summary.</p>
            <Link
              href="/check-in"
              className="inline-block bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 text-lg font-medium transition-colors"
            >
              Start a Check-In
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        {loading && <Spinner />}

        {!loading && error && <ErrorMessage message={error} onRetry={handleRetry} retrying={retrying} />}

        {!loading && !error && phase === 'draft' && formData && (
          <div data-testid="draft-summary">
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>
              Review Your Summary
            </h1>
            <p className="text-text-muted mb-8">Review and edit your answers before confirming.</p>

            <div className="space-y-6">
              {/* Primary concern */}
              <FieldCard label="Primary concern" testId="field-primary_concern">
                <input
                  type="text"
                  value={formData.primary_concern}
                  onChange={(e) => updateField('primary_concern', e.target.value)}
                  className="w-full border border-text/20 rounded-lg p-2 focus:ring-2 focus:ring-primary outline-none"
                />
              </FieldCard>

              {/* Duration */}
              <FieldCard label="Duration" testId="field-concern_duration">
                <RadioGroup
                  name="concern_duration"
                  value={formData.concern_duration}
                  options={DURATION_OPTIONS}
                  onChange={(v) => updateField('concern_duration', v as StructuredCheckIn['concern_duration'])}
                />
              </FieldCard>

              {/* Sleep impact */}
              <FieldCard label="Sleep impact" testId="field-sleep_impact">
                <RadioGroup
                  name="sleep_impact"
                  value={formData.sleep_impact}
                  options={SLEEP_IMPACT_OPTIONS}
                  onChange={(v) => updateField('sleep_impact', v as StructuredCheckIn['sleep_impact'])}
                />
              </FieldCard>

              {/* Daily functioning impact */}
              <FieldCard label="Daily functioning impact" testId="field-daily_functioning_impact">
                <RadioGroup
                  name="daily_functioning_impact"
                  value={formData.daily_functioning_impact}
                  options={FUNCTIONING_OPTIONS}
                  onChange={(v) => updateField('daily_functioning_impact', v as StructuredCheckIn['daily_functioning_impact'])}
                />
              </FieldCard>

              {/* Support preference */}
              <FieldCard label="Support preference" testId="field-support_preference">
                <RadioGroup
                  name="support_preference"
                  value={formData.support_preference}
                  options={SUPPORT_OPTIONS}
                  onChange={(v) => updateField('support_preference', v as StructuredCheckIn['support_preference'])}
                />
              </FieldCard>

              {/* Safety response */}
              <FieldCard label="Safety response" testId="field-feels_safe" note="This is your direct response, not an AI assessment.">
                <RadioGroup
                  name="feels_safe"
                  value={formData.feels_safe}
                  options={SAFETY_OPTIONS}
                  onChange={(v) => updateField('feels_safe', v as StructuredCheckIn['feels_safe'])}
                />
              </FieldCard>

              {/* Key points */}
              <FieldCard label="Key points" testId="field-key_points">
                <div className="space-y-2">
                  {formData.key_points.map((point, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => updateKeyPoint(i, e.target.value)}
                        className="flex-1 border border-text/20 rounded-lg p-2 focus:ring-2 focus:ring-primary outline-none"
                      />
                      <button
                        onClick={() => removeKeyPoint(i)}
                        className="text-error hover:text-error/80 px-2 text-sm font-medium"
                        aria-label={`Remove key point ${i + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {formData.key_points.length < 10 && (
                    <button
                      onClick={addKeyPoint}
                      className="text-primary hover:text-primary-light text-sm font-medium mt-2"
                    >
                      + Add key point
                    </button>
                  )}
                </div>
              </FieldCard>

              {/* Provisional routing */}
              {provisionalRouting && (
                <div data-testid="provisional-routing" className="bg-secondary/10 border border-secondary/30 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-text mb-1">Provisional routing</h3>
                  <p className="text-xs text-text-muted italic mb-2">
                    This routing is provisional and will be recalculated from your confirmed answers.
                  </p>
                  <p data-testid="routing-state" className="text-text font-medium">
                    {PROVISIONAL_ROUTING_DISPLAY[provisionalRouting.routingState]}
                  </p>
                </div>
              )}

              {/* Confirm button */}
              <div className="pt-4">
                <button
                  data-testid="confirm-summary"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 text-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {confirming ? 'Confirming…' : 'Confirm Summary'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && phase === 'confirmed' && confirmResponse && formData && (
          <div data-testid="confirmed-summary">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
                Summary Confirmed
              </h1>
            </div>
            <p className="text-text-muted mb-8">Your summary has been confirmed and saved.</p>

            <div className="space-y-4 mb-8">
              {/* Read-only fields */}
              <FieldCard label="Primary concern" testId="field-primary_concern">
                <p className="text-text">{formData.primary_concern}</p>
              </FieldCard>
              <FieldCard label="Duration" testId="field-concern_duration">
                <p className="text-text">{DURATION_OPTIONS.find((o) => o.value === formData.concern_duration)?.label}</p>
              </FieldCard>
              <FieldCard label="Sleep impact" testId="field-sleep_impact">
                <p className="text-text">{SLEEP_IMPACT_OPTIONS.find((o) => o.value === formData.sleep_impact)?.label}</p>
              </FieldCard>
              <FieldCard label="Daily functioning impact" testId="field-daily_functioning_impact">
                <p className="text-text">{FUNCTIONING_OPTIONS.find((o) => o.value === formData.daily_functioning_impact)?.label}</p>
              </FieldCard>
              <FieldCard label="Support preference" testId="field-support_preference">
                <p className="text-text">{SUPPORT_OPTIONS.find((o) => o.value === formData.support_preference)?.label}</p>
              </FieldCard>
              <FieldCard label="Safety response" testId="field-feels_safe" note="This is your direct response, not an AI assessment.">
                <p className="text-text">{SAFETY_OPTIONS.find((o) => o.value === formData.feels_safe)?.label}</p>
              </FieldCard>
              <FieldCard label="Key points" testId="field-key_points">
                <ul className="list-disc list-inside space-y-1">
                  {formData.key_points.map((point, i) => (
                    <li key={i} className="text-text">{point}</li>
                  ))}
                </ul>
              </FieldCard>
            </div>

            {/* Final routing */}
            <div data-testid="final-routing" className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-text mb-2">Your Routing Result</h3>
              <p data-testid="routing-state" className="text-text font-medium text-lg">
                {ROUTING_DISPLAY[confirmResponse.routingState].title}
              </p>
              {ROUTING_DISPLAY[confirmResponse.routingState].description && (
                <p className="text-text-muted text-sm mt-1">
                  {ROUTING_DISPLAY[confirmResponse.routingState].description}
                </p>
              )}
            </div>

            {/* Developer info panel */}
            <div
              data-testid="developer-info"
              className="bg-text/5 border border-text/10 rounded-lg p-4 text-sm text-text-muted mb-8"
            >
              <button
                onClick={() => setDevInfoExpanded((v) => !v)}
                className="flex items-center justify-between w-full text-left font-medium"
              >
                <span>Developer Information</span>
                <span className="text-xs">{devInfoExpanded ? '▼' : '▶'}</span>
              </button>
              {devInfoExpanded && (
                <div className="mt-3 space-y-1">
                  <p>Provider: <span className="font-mono">{devInfo.modelVersion.includes('fallback') ? 'fallback' : devInfo.modelVersion.includes('qwen') ? 'qwen' : 'mock'}</span></p>
                  <p>Model version: <span className="font-mono">{devInfo.modelVersion || '—'}</span></p>
                  <p>Prompt version: <span className="font-mono">{devInfo.promptVersion || '—'}</span></p>
                  <p>Policy version: <span className="font-mono">{devInfo.policyVersion || '—'}</span></p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                data-testid="continue-module"
                href="/module/pause-reflect"
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 text-lg font-medium transition-colors text-center"
              >
                Continue to Pause & Reflect
              </Link>
              <Link
                href="/"
                className="text-primary hover:underline flex items-center justify-center px-6 py-3 text-lg font-medium"
              >
                Back to Home
              </Link>
            </div>

            {/* Browse Professionals CTA */}
            <div className="bg-surface border border-primary/40 rounded-xl shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <div>
                    <h3 className="text-base font-semibold text-text">Connect with a Professional</h3>
                    <p className="text-sm text-text-muted mt-1">
                      Browse qualified professionals who can provide personalized support.
                    </p>
                  </div>
                </div>
                <Link
                  data-testid="browse-professionals"
                  href="/professionals"
                  className="shrink-0 border border-primary text-primary hover:bg-primary hover:text-white rounded-lg px-5 py-2.5 font-medium transition-colors text-center"
                >
                  Browse Professionals
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function SummaryPage(): React.ReactNode {
  return (
    <Suspense fallback={
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    }>
      <SummaryPageContent />
    </Suspense>
  );
}
