'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import type {
  StructuredCheckIn,
  CompleteCheckInResponse,
  ConfirmCheckInResponse,
  TechniqueSuggestion,
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

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

function SectionHeader({ icon, title, subtitle }: SectionHeaderProps): React.ReactNode {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

interface PillRadioGroupProps {
  name: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Premium segmented pill selector. Each option is a real radio input wrapped
 * in its label so accessible-name lookups (and keyboard use) keep working. */
function PillRadioGroup({ name, value, options, onChange, disabled }: PillRadioGroupProps): React.ReactNode {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 cursor-pointer transition-colors select-none ${
              selected
                ? 'border-primary bg-primary/10'
                : 'border-text/20 bg-surface hover:border-primary/40'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="w-4 h-4 appearance-none rounded-full border-2 transition-colors cursor-pointer shrink-0 border-text/40 checked:border-primary checked:bg-primary"
            />
            <span className={`text-sm ${selected ? 'text-primary font-medium' : 'text-text'}`}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

interface TechniqueCardProps {
  technique: TechniqueSuggestion;
  defaultOpen?: boolean;
}

/** Expandable technique card — click the name to reveal steps, mechanism, and
 * sources, mirroring the in-chat technique experience. */
function TechniqueCard({ technique, defaultOpen = false }: TechniqueCardProps): React.ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-text/10 rounded-xl overflow-hidden bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-medium text-text">{technique.name}</span>
        </span>
        <svg
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {technique.whenToUse && (
            <p className="text-sm text-text-muted italic">{technique.whenToUse}</p>
          )}
          {technique.steps.length > 0 && (
            <ol className="space-y-1.5">
              {technique.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-text">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
          {technique.mechanism && (
            <p className="text-xs text-text-muted">{technique.mechanism}</p>
          )}
          {technique.duration && (
            <p className="text-xs text-text-muted">Duration: {technique.duration}</p>
          )}
          {technique.citations.length > 0 && (
            <div className="pt-2 border-t border-text/10 space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Sources</p>
              {technique.citations.map((c, idx) => (
                <p key={idx} className="text-xs text-text-muted">
                  {c.title ?? c.source}
                  {c.year ? ` — ${c.source} (${c.year})` : ` — ${c.source}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CitationEntry {
  source: string;
  title?: string;
  url?: string;
  year?: string;
  description?: string;
}

/** Collapsible "Sources" list — collapsed by default, tap to expand. */
function CollapsibleSources({ citations }: { citations: CitationEntry[] }): React.ReactNode {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="pt-4 border-t border-text/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left py-1 group"
      >
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide group-hover:text-text transition-colors">
          Sources ({citations.length})
        </span>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="space-y-3 mt-3">
          {citations.map((citation, idx) => (
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
      )}
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

  // AI narrative
  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [regenerating, setRegenerating] = useState(false);

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

  // Proactive companion context (citations, cross-session insight, techniques)
  interface CompanionContext {
    primaryArchetype: string;
    techniques: TechniqueSuggestion[];
    citations: Array<{ source: string; title?: string; url?: string; year?: string; description?: string }>;
    crossSessionInsight: string | null;
  }
  const [companionContext, setCompanionContext] = useState<CompanionContext | null>(null);

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

  // Session recovery — in-memory check-in sessions are wiped when the dev
  // server restarts, but this page still renders from the browser's cached
  // answers. Instead of forcing the user to redo the check-in, spin up a
  // fresh server session and re-run /complete against it so the summary can
  // be regenerated or confirmed. Answers are never lost.
  const recoverSession = async (answers: StructuredCheckIn): Promise<string> => {
    let mode: 'CONNECTED_CARE' | 'GUEST' = 'GUEST';
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) mode = 'CONNECTED_CARE';
    } catch {
      // Stay GUEST.
    }

    const createRes = await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!createRes.ok) throw new Error('Failed to confirm summary.');
    const created = await createRes.json() as { id: string };

    const completeRes = await fetch(`/api/check-ins/${created.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredAnswers: answers }),
    });
    if (completeRes.ok) {
      applyCompleteResponse((await completeRes.json()) as CompleteCheckInResponse);
    }

    // Point the URL and the local cache at the recovered session.
    window.history.replaceState(null, '', `/summary?sessionId=${created.id}`);
    try {
      const stored = sessionStorage.getItem('manas-check-in');
      if (stored) {
        sessionStorage.setItem(
          'manas-check-in',
          JSON.stringify({ ...(JSON.parse(stored) as Record<string, unknown>), sessionId: created.id }),
        );
      }
    } catch {
      // Ignore.
    }
    return created.id;
  };

  // Confirm handler
  const handleConfirm = async (): Promise<void> => {
    if (!sessionId || !formData) return;
    setConfirming(true);
    setError(null);
    try {
      let confirmSessionId = sessionId;
      let res = await fetch(`/api/check-ins/${confirmSessionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedSummary: formData,
          draftSummary: draftSummary ?? undefined,
        }),
      });
      if (!res.ok) {
        // Original server session is gone (e.g. server restarted) — recover
        // with a fresh session and retry, keeping all reviewed answers.
        confirmSessionId = await recoverSession(formData);
        res = await fetch(`/api/check-ins/${confirmSessionId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmedSummary: formData,
            draftSummary: draftSummary ?? undefined,
          }),
        });
      }
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

  // Regenerate AI narrative — each click requests a fresh paraphrase variant.
  const regenVariantRef = useRef(0);
  const handleRegenerate = async (): Promise<void> => {
    if (!sessionId || !formData) return;
    setRegenerating(true);
    setError(null);
    regenVariantRef.current = (regenVariantRef.current % 3) + 1;
    try {
      let regenSessionId = sessionId;
      let res = await fetch(`/api/check-ins/${regenSessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredAnswers: formData, variant: regenVariantRef.current }),
      });
      if (!res.ok) {
        // Same recovery path as confirm — stale server session.
        regenSessionId = await recoverSession(formData);
        res = await fetch(`/api/check-ins/${regenSessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ structuredAnswers: formData, variant: regenVariantRef.current }),
        });
      }
      if (!res.ok) throw new Error('Failed to regenerate summary.');
      const data: CompleteCheckInResponse = await res.json();
      setAiNarrative(data.aiNarrative);
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

  // Next-step journey order is driven by the confirmed routing result —
  // deterministic, never decided by the conversational model.
  const professionalFirst = confirmResponse !== null && confirmResponse.routingState !== 'GENERAL_WELLBEING';
  const moduleStep = {
    testId: 'continue-module',
    href: '/module/pause-reflect',
    title: 'Pause & Reflect',
    description: 'A 5-minute guided exercise to slow down, notice your state, and reflect on what you need right now.',
    cta: 'Start the exercise',
    icon: (
      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  };
  const professionalStep = {
    testId: 'browse-professionals',
    href: '/professionals',
    title: 'Connect with a professional',
    description: 'Browse qualified professionals who can provide personalised support.',
    cta: 'Browse professionals',
    icon: (
      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  };
  const orderedNextSteps = professionalFirst ? [professionalStep, moduleStep] : [moduleStep, professionalStep];

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
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 mb-6">
              <SectionHeader
                icon={
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                title="Manas reflected summary"
                subtitle="A reflection of what you shared — not a diagnosis or assessment."
              />
              <p className="text-text leading-relaxed">{aiNarrative || generateOfflineNarrative(formData)}</p>
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

            {/* Proposed techniques (with sources) */}
            {companionContext && (companionContext.techniques.length > 0 || companionContext.citations.length > 0) && (
              <div data-testid="sources-panel" className="bg-surface border border-text/10 rounded-2xl p-6 mb-6">
                <SectionHeader
                  icon={
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  }
                  title="Proposed Techniques"
                  subtitle="Tap a technique to expand its steps. These were suggested across your conversation."
                />
                {companionContext.techniques.length > 0 && (
                  <div className="space-y-3 mb-5">
                    {companionContext.techniques.map((t) => (
                      <TechniqueCard key={t.id} technique={t} />
                    ))}
                  </div>
                )}
                <CollapsibleSources citations={companionContext.citations} />
              </div>
            )}

            <div className="space-y-6">
              {/* What you shared */}
              <div className="bg-surface rounded-2xl shadow-sm p-6">
                <SectionHeader
                  icon={
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  }
                  title="What you shared"
                  subtitle="These key points come from your own words. Edit or remove any."
                />
                <div data-testid="field-primary_concern" className="mb-5">
                  <span className="block text-sm font-medium text-text mb-2">Primary concern</span>
                  <input
                    type="text"
                    value={formData.primary_concern}
                    onChange={(e) => updateField('primary_concern', e.target.value)}
                    className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none bg-background text-text"
                  />
                </div>
                <div data-testid="field-key_points">
                  <span className="block text-sm font-medium text-text mb-2">Key points</span>
                  <div className="space-y-2">
                    {formData.key_points.map((point, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={point}
                          onChange={(e) => updateKeyPoint(i, e.target.value)}
                          className="flex-1 border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none bg-background text-text"
                        />
                        <button
                          onClick={() => removeKeyPoint(i)}
                          className="text-error hover:text-error/80 px-2 text-sm font-medium shrink-0"
                          aria-label={`Remove key point ${i + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {formData.key_points.length < 10 && (
                      <button
                        onClick={addKeyPoint}
                        className="text-primary hover:text-primary-light text-sm font-medium mt-1"
                      >
                        + Add key point
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Your responses */}
              <div className="bg-surface rounded-2xl shadow-sm p-6">
                <SectionHeader
                  icon={
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  }
                  title="Your responses"
                  subtitle="Tap to adjust — these shape how Manas suggests next steps."
                />
                <div className="space-y-5">
                  <div data-testid="field-concern_duration" className="space-y-2">
                    <span className="block text-sm font-medium text-text">Duration</span>
                    <PillRadioGroup
                      name="concern_duration"
                      value={formData.concern_duration}
                      options={DURATION_OPTIONS}
                      onChange={(v) => updateField('concern_duration', v as StructuredCheckIn['concern_duration'])}
                    />
                  </div>
                  <div data-testid="field-sleep_impact" className="space-y-2">
                    <span className="block text-sm font-medium text-text">Sleep impact</span>
                    <PillRadioGroup
                      name="sleep_impact"
                      value={formData.sleep_impact}
                      options={SLEEP_IMPACT_OPTIONS}
                      onChange={(v) => updateField('sleep_impact', v as StructuredCheckIn['sleep_impact'])}
                    />
                  </div>
                  <div data-testid="field-daily_functioning_impact" className="space-y-2">
                    <span className="block text-sm font-medium text-text">Daily functioning impact</span>
                    <PillRadioGroup
                      name="daily_functioning_impact"
                      value={formData.daily_functioning_impact}
                      options={FUNCTIONING_OPTIONS}
                      onChange={(v) => updateField('daily_functioning_impact', v as StructuredCheckIn['daily_functioning_impact'])}
                    />
                  </div>
                  <div data-testid="field-support_preference" className="space-y-2">
                    <span className="block text-sm font-medium text-text">Support preference</span>
                    <PillRadioGroup
                      name="support_preference"
                      value={formData.support_preference}
                      options={SUPPORT_OPTIONS}
                      onChange={(v) => updateField('support_preference', v as StructuredCheckIn['support_preference'])}
                    />
                  </div>
                  <div data-testid="field-feels_safe" className="space-y-2">
                    <span className="block text-sm font-medium text-text">Safety response</span>
                    <PillRadioGroup
                      name="feels_safe"
                      value={formData.feels_safe}
                      options={SAFETY_OPTIONS}
                      onChange={(v) => updateField('feels_safe', v as StructuredCheckIn['feels_safe'])}
                    />
                    <p className="text-xs text-text-muted italic">This is your direct response, not an AI assessment.</p>
                  </div>
                </div>
              </div>

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

              {/* Final actions — regenerate or confirm, both at the end */}
              <div className="pt-2 space-y-3">
                {isOfflineSession && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-text-muted">
                    You are offline. You can review and edit your summary above, but confirming it requires a connection.
                  </div>
                )}
                <div className="bg-surface border border-text/10 rounded-2xl p-4 space-y-3">
                  <p className="text-sm text-text-muted text-center">
                    Reviewed everything? Regenerate the reflection for a fresh take, or confirm to save.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => void handleRegenerate()}
                      disabled={regenerating || isOfflineSession}
                      className="flex-1 text-sm px-4 py-3 border border-text/20 text-text rounded-lg hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {regenerating ? 'Regenerating…' : 'Regenerate summary'}
                    </button>
                    <button
                      data-testid="confirm-summary"
                      onClick={handleConfirm}
                      disabled={confirming || isOfflineSession}
                      className="flex-1 bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 text-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {confirming ? 'Confirming…' : 'Confirm Summary'}
                    </button>
                  </div>
                </div>
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
              <h2 className="text-base font-semibold text-text mb-2">Manas reflected summary</h2>
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

            {/* Proposed techniques (with sources) — confirmed */}
            {companionContext && (companionContext.techniques.length > 0 || companionContext.citations.length > 0) && (
              <div data-testid="sources-panel" className="bg-surface border border-text/10 rounded-2xl p-6 mb-6">
                <SectionHeader
                  icon={
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  }
                  title="Proposed Techniques"
                  subtitle="Tap a technique to expand its steps."
                />
                {companionContext.techniques.length > 0 && (
                  <div className="space-y-3 mb-5">
                    {companionContext.techniques.map((t) => (
                      <TechniqueCard key={t.id} technique={t} />
                    ))}
                  </div>
                )}
                <CollapsibleSources citations={companionContext.citations} />
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

            {/* Next steps — a guided journey shaped by the routing result */}
            <div data-testid="next-steps" className="bg-surface border border-text/10 rounded-2xl p-6 mb-6">
              <SectionHeader
                icon={
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                }
                title="Your next steps"
                subtitle={professionalFirst
                  ? 'Based on your routing result, connecting with a professional may be the most helpful next step — you set the pace.'
                  : 'Based on your routing result, a moment of calm is a gentle next step — you set the pace.'}
              />
              <div className="space-y-3">
                {orderedNextSteps.map((step, i) => (
                  <Link
                    key={step.href}
                    data-testid={step.testId}
                    href={step.href}
                    className={`group flex items-center gap-4 rounded-xl border p-4 transition-all ${
                      i === 0
                        ? 'bg-primary/5 border-primary/30 hover:border-primary hover:shadow-md'
                        : 'bg-background border-text/10 hover:border-primary/40 hover:shadow-sm'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                        i === 0 ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      {step.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-semibold text-text">{step.title}</span>
                      <span className="block text-sm text-text-muted mt-0.5">{step.description}</span>
                    </span>
                    <span className={`flex-shrink-0 hidden sm:flex items-center gap-1 text-sm font-medium transition-colors ${
                      i === 0 ? 'text-primary' : 'text-text-muted group-hover:text-primary'
                    }`}>
                      {step.cta}
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-text/10 text-center">
                <Link href="/" className="text-sm text-text-muted hover:text-primary transition-colors">
                  ← Return home whenever you&rsquo;re ready
                </Link>
              </div>
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
