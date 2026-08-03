'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import { useAuth } from '@/components/auth/AuthProvider';
import { SymptomRecorder, type SymptomFormData } from '@/components/symptoms/SymptomRecorder';
import { SymptomBuckets } from '@/components/symptoms/SymptomBuckets';
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
  const { user } = useAuth();

  // Phase state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'draft' | 'confirmed'>('draft');

  // Draft data from /complete
  const [draftSummary, setDraftSummary] = useState<StructuredCheckIn | null>(null);
  const [provisionalRouting, setProvisionalRouting] = useState<CompleteCheckInResponse['provisionalRouting'] | null>(null);

  // AI narrative
  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [suggestedKeyPoints, setSuggestedKeyPoints] = useState<string[]>([]);
  const [regenerating, setRegenerating] = useState(false);

  // Editable form state
  const [formData, setFormData] = useState<StructuredCheckIn | null>(null);

  // Confirm data
  const [confirmResponse, setConfirmResponse] = useState<ConfirmCheckInResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Symptoms
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [symptomsLoading, setSymptomsLoading] = useState(false);
  const [symptomSaving, setSymptomSaving] = useState(false);
  const [symptomDeletingId, setSymptomDeletingId] = useState<string | null>(null);
  const [showSymptomRecorder, setShowSymptomRecorder] = useState(false);

  // Developer info
  const [devInfo, setDevInfo] = useState<{ modelVersion: string; promptVersion: string; policyVersion: string }>({
    modelVersion: '',
    promptVersion: '',
    policyVersion: '',
  });
  const [devInfoExpanded, setDevInfoExpanded] = useState(false);

  // Proactive companion context (citations, cross-session insight, techniques)
  interface CompanionContext {
    primaryArchetype: string;
    techniques: { id: string; name: string }[];
    citations: Array<{ source: string; title?: string; url?: string; year?: string; description?: string }>;
    crossSessionInsight: string | null;
  }
  const [companionContext, setCompanionContext] = useState<CompanionContext | null>(null);

  // Load symptoms for logged-in users
  const loadSymptoms = useCallback(async () => {
    if (!user) return;
    setSymptomsLoading(true);
    try {
      const res = await fetch('/api/symptoms');
      if (res.ok) {
        const data = await res.json();
        setSymptoms((data.symptoms ?? []).map((s: SymptomEntry) => ({
          ...s,
          createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString(),
        })));
      }
    } catch {
      // Silent fail — symptoms are supplementary.
    } finally {
      setSymptomsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- symptom list is loaded from external API on mount
    void loadSymptoms();
  }, [loadSymptoms]);

  const applyCompleteResponse = useCallback((data: CompleteCheckInResponse) => {
    setDraftSummary(data.draftSummary);
    setFormData((prev) => {
      if (prev) return prev;
      // Pre-fill key points from AI suggestions if the draft has none.
      if (!data.draftSummary.key_points || data.draftSummary.key_points.length === 0) {
        return { ...data.draftSummary, key_points: data.suggestedKeyPoints.slice(0, 10) };
      }
      return data.draftSummary;
    });
    setProvisionalRouting(data.provisionalRouting);
    setAiNarrative(data.aiNarrative);
    setSuggestedKeyPoints(data.suggestedKeyPoints);
    setDevInfo((prev) => ({
      ...prev,
      modelVersion: data.modelVersion,
      promptVersion: data.promptVersion,
      policyVersion: data.policyVersion,
    }));
  }, []);

  // Load draft summary — prefer cached sessionStorage data from check-in page,
  // fall back to the GET /api/check-ins/[id] endpoint, then /complete if needed.
  const loadDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ── Path 1: sessionStorage cache (fast path) ──────────────────────────
      // Works for both online and offline completions; no server required.
      const stored = sessionStorage.getItem('manas-check-in');
      if (stored) {
        const checkInState = JSON.parse(stored) as {
          sessionId?: string;
          structuredAnswers?: Record<string, unknown>;
          completeResponse?: CompleteCheckInResponse;
          companionContext?: CompanionContext;
        };

        if (checkInState.companionContext) {
          setCompanionContext(checkInState.companionContext);
        }

        // If the check-in page already stored the /complete response, use it.
        if (checkInState.completeResponse) {
          applyCompleteResponse(checkInState.completeResponse);
          setLoading(false);
          return;
        }

        // sessionStorage has structuredAnswers but no completeResponse.
        // If we have a server session id, call /complete to produce the draft
        // summary + provisional routing. Otherwise stay offline and derive a
        // minimal provisional routing from the stored answers.
        const structuredAnswers = checkInState.structuredAnswers ?? checkInState;
        const storedSessionId = checkInState.sessionId ?? sessionId;
        if (storedSessionId && !storedSessionId.startsWith('offline-')) {
          const completeRes = await fetch(`/api/check-ins/${storedSessionId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ structuredAnswers }),
          });
          if (completeRes.ok) {
            const data: CompleteCheckInResponse = await completeRes.json();
            applyCompleteResponse(data);
            setLoading(false);
            return;
          }
        }

        // Offline mode: render the stored answers directly.
        const offlineSummary = structuredAnswers as StructuredCheckIn;
        setDraftSummary(offlineSummary);
        setFormData(offlineSummary);
        setProvisionalRouting(null);
        setAiNarrative(generateOfflineNarrative(offlineSummary));
        setSuggestedKeyPoints(generateOfflineKeyPoints(offlineSummary));
        setDevInfo((prev) => ({ ...prev, modelVersion: 'offline', promptVersion: 'offline', policyVersion: 'offline' }));
        setLoading(false);
        return;
      }

      if (!sessionId) {
        setLoading(false);
        return;
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
        setAiNarrative(generateOfflineNarrative(summary));
        setSuggestedKeyPoints(generateOfflineKeyPoints(summary));
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
        applyCompleteResponse(data);
      } else {
        setError('No check-in data found. Please start a check-in first.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, applyCompleteResponse]);

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

  // Regenerate AI narrative
  const handleRegenerate = async (): Promise<void> => {
    if (!sessionId || !formData) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/check-ins/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredAnswers: formData }),
      });
      if (!res.ok) throw new Error('Failed to regenerate summary.');
      const data: CompleteCheckInResponse = await res.json();
      setAiNarrative(data.aiNarrative);
      setSuggestedKeyPoints(data.suggestedKeyPoints);
      setProvisionalRouting(data.provisionalRouting);
      setDevInfo((prev) => ({
        ...prev,
        modelVersion: data.modelVersion,
        promptVersion: data.promptVersion,
        policyVersion: data.policyVersion,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate summary.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSoundsRight = (): void => {
    if (!formData) return;
    const newKeyPoints = suggestedKeyPoints.length > 0
      ? suggestedKeyPoints.slice(0, 10)
      : formData.key_points;
    setFormData({ ...formData, key_points: newKeyPoints });
  };

  // Symptom handlers
  const handleRecordSymptom = async (data: SymptomFormData): Promise<void> => {
    if (!user) return;
    setSymptomSaving(true);
    try {
      const res = await fetch('/api/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          sessionId: sessionId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save symptom.');
      const result = await res.json();
      setSymptoms((prev) => [
        ...prev,
        {
          ...result.symptom,
          createdAt: typeof result.symptom.createdAt === 'string'
            ? result.symptom.createdAt
            : new Date(result.symptom.createdAt).toISOString(),
        },
      ]);
      setShowSymptomRecorder(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save symptom.');
    } finally {
      setSymptomSaving(false);
    }
  };

  const handleDeleteSymptom = async (id: string): Promise<void> => {
    if (!user) return;
    setSymptomDeletingId(id);
    try {
      const res = await fetch(`/api/symptoms/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete symptom.');
      setSymptoms((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete symptom.');
    } finally {
      setSymptomDeletingId(null);
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

  // --- No session ID and no cached data ---
  if (!sessionId && !loading && !formData && !error) {
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

  const isOfflineSession = !sessionId || sessionId.startsWith('offline-');

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

            {/* AI Narrative */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3 mb-3">
                <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-base font-semibold text-text">Manus reflected summary</h2>
              </div>
              <p className="text-text leading-relaxed mb-4">{aiNarrative || generateOfflineNarrative(formData)}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void handleRegenerate()}
                  disabled={regenerating || isOfflineSession}
                  className="text-sm px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating ? 'Regenerating…' : 'Regenerate summary'}
                </button>
                <button
                  onClick={handleSoundsRight}
                  className="text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors"
                >
                  Sounds right
                </button>
              </div>
              {isOfflineSession && (
                <p className="text-xs text-text-muted mt-3">
                  Offline mode: AI regeneration requires a connection.
                </p>
              )}
            </div>

            {/* Cross-session insight */}
            {companionContext?.crossSessionInsight && (
              <div data-testid="cross-session-insight" className="bg-secondary/10 border border-secondary/30 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-3 mb-2">
                  <svg className="w-5 h-5 text-secondary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-base font-semibold text-text">Pattern across sessions</h2>
                </div>
                <p className="text-text leading-relaxed">{companionContext.crossSessionInsight}</p>
              </div>
            )}

            {/* Sources / citations */}
            {companionContext && companionContext.citations.length > 0 && (
              <div data-testid="sources-panel" className="bg-surface border border-text/10 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h2 className="text-base font-semibold text-text">Sources and techniques</h2>
                </div>
                {companionContext.techniques.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-text-muted mb-2">Techniques mentioned:</p>
                    <div className="flex flex-wrap gap-2">
                      {companionContext.techniques.map((t) => (
                        <span key={t.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <ul className="space-y-3">
                  {companionContext.citations.map((citation, idx) => (
                    <li key={idx} className="text-sm">
                      <p className="font-medium text-text">{citation.title ?? citation.source}</p>
                      {citation.description && <p className="text-text-muted">{citation.description}</p>}
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          {citation.source}{citation.year ? ` (${citation.year})` : ''}
                        </a>
                      ) : (
                        <p className="text-text-muted text-xs">{citation.source}{citation.year ? ` (${citation.year})` : ''}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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

              {/* Symptom buckets */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text">What you are experiencing</h2>
                  {user && (
                    <button
                      onClick={() => setShowSymptomRecorder((v) => !v)}
                      className="text-sm px-4 py-2 bg-secondary/10 text-text rounded-lg hover:bg-secondary/20 transition-colors"
                    >
                      {showSymptomRecorder ? 'Close recorder' : 'Record symptom'}
                    </button>
                  )}
                </div>
                {!user && (
                  <div className="bg-surface border border-text/10 rounded-xl p-4 text-center mb-4">
                    <p className="text-sm text-text-muted mb-2">
                      Sign in to record and organize what you are experiencing.
                    </p>
                    <Link href="/login" className="text-sm text-primary hover:underline font-medium">
                      Sign in or create an account
                    </Link>
                  </div>
                )}
                {user && showSymptomRecorder && (
                  <div className="mb-4">
                    <SymptomRecorder
                      onSubmit={(data) => void handleRecordSymptom(data)}
                      onCancel={() => setShowSymptomRecorder(false)}
                      loading={symptomSaving}
                    />
                  </div>
                )}
                {user && symptomsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <SymptomBuckets
                    symptoms={symptoms}
                    onDelete={handleDeleteSymptom}
                    deletingId={symptomDeletingId}
                  />
                )}
              </section>

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
              <div className="pt-4 space-y-3">
                {isOfflineSession && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-text-muted">
                    You are offline. You can review and edit your summary above, but confirming it requires a connection.
                  </div>
                )}
                <button
                  data-testid="confirm-summary"
                  onClick={handleConfirm}
                  disabled={confirming || isOfflineSession}
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

            {/* AI Narrative (confirmed) */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-6">
              <h2 className="text-base font-semibold text-text mb-2">Manus reflected summary</h2>
              <p className="text-text leading-relaxed">{aiNarrative || generateOfflineNarrative(formData)}</p>
            </div>

            {/* Cross-session insight (confirmed) */}
            {companionContext?.crossSessionInsight && (
              <div data-testid="cross-session-insight" className="bg-secondary/10 border border-secondary/30 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-3 mb-2">
                  <svg className="w-5 h-5 text-secondary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-base font-semibold text-text">Pattern across sessions</h2>
                </div>
                <p className="text-text leading-relaxed">{companionContext.crossSessionInsight}</p>
              </div>
            )}

            {/* Sources / citations (confirmed) */}
            {companionContext && companionContext.citations.length > 0 && (
              <div data-testid="sources-panel" className="bg-surface border border-text/10 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h2 className="text-base font-semibold text-text">Sources and techniques</h2>
                </div>
                {companionContext.techniques.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-text-muted mb-2">Techniques mentioned:</p>
                    <div className="flex flex-wrap gap-2">
                      {companionContext.techniques.map((t) => (
                        <span key={t.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <ul className="space-y-3">
                  {companionContext.citations.map((citation, idx) => (
                    <li key={idx} className="text-sm">
                      <p className="font-medium text-text">{citation.title ?? citation.source}</p>
                      {citation.description && <p className="text-text-muted">{citation.description}</p>}
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          {citation.source}{citation.year ? ` (${citation.year})` : ''}
                        </a>
                      ) : (
                        <p className="text-text-muted text-xs">{citation.source}{citation.year ? ` (${citation.year})` : ''}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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

            {/* Symptom buckets (confirmed) */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text">What you are experiencing</h2>
                {user && (
                  <button
                    onClick={() => setShowSymptomRecorder((v) => !v)}
                    className="text-sm px-4 py-2 bg-secondary/10 text-text rounded-lg hover:bg-secondary/20 transition-colors"
                  >
                    {showSymptomRecorder ? 'Close recorder' : 'Record symptom'}
                  </button>
                )}
              </div>
              {user && showSymptomRecorder && (
                <div className="mb-4">
                  <SymptomRecorder
                    onSubmit={(data) => void handleRecordSymptom(data)}
                    onCancel={() => setShowSymptomRecorder(false)}
                    loading={symptomSaving}
                  />
                </div>
              )}
              {user && symptomsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <SymptomBuckets
                  symptoms={symptoms}
                  onDelete={handleDeleteSymptom}
                  deletingId={symptomDeletingId}
                />
              )}
            </section>

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

function generateOfflineNarrative(summary: StructuredCheckIn): string {
  const durationLabels: Record<string, string> = {
    days: 'a few days',
    weeks: 'a few weeks',
    months: 'several months',
    over_year: 'over a year',
  };
  const primaryConcern = summary.primary_concern?.trim() || 'something difficult';
  const duration = durationLabels[summary.concern_duration] ?? 'a short time';
  const support = summary.support_preference?.replace(/_/g, ' ') ?? 'general reflection';
  return `You've shared that "${primaryConcern}" has been difficult for ${duration}. ` +
    `You're looking for ${support}. ` +
    "This is a reflection of what you told me — not a diagnosis or clinical assessment.";
}

function generateOfflineKeyPoints(summary: StructuredCheckIn): string[] {
  if (summary.key_points && summary.key_points.length > 0) return summary.key_points;
  return [summary.primary_concern ?? 'Primary concern'];
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
