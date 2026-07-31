'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import type { StructuredCheckIn, CompleteCheckInResponse } from '@/domain';
import { StepProgress } from '@/components/check-in/StepProgress';
import { ChatBubble } from '@/components/check-in/ChatBubble';
import { FreeTextInput } from '@/components/check-in/FreeTextInput';
import { OptionSelector, type OptionItem } from '@/components/check-in/OptionSelector';
import { FormFallback } from '@/components/check-in/FormFallback';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'manas-check-in';
const TOTAL_STEPS = 6;

const STEP_NAMES = [
  'primary_concern',
  'duration',
  'sleep_impact',
  'daily_functioning_impact',
  'support_preference',
  'safety_response',
] as const;

const STEP_PROMPTS: Record<number, string> = {
  1: 'What has been feeling most difficult recently?',
  2: 'How long has this been going on?',
  3: 'How has this affected your sleep?',
  4: 'How has this affected your daily functioning?',
  5: 'What kind of support are you looking for?',
  6: 'For this demonstration, do you feel safe right now?',
};

const STEP_OPTIONS: Record<number, OptionItem[]> = {
  2: [
    { value: 'days', label: 'A few days' },
    { value: 'weeks', label: 'A few weeks' },
    { value: 'months', label: 'Several months' },
    { value: 'over_year', label: 'Over a year' },
  ],
  3: [
    { value: 'none', label: 'No impact' },
    { value: 'mild', label: 'Mild impact' },
    { value: 'significant', label: 'Significant impact' },
    { value: 'severe', label: 'Severe impact' },
  ],
  4: [
    { value: 'none', label: 'No impact' },
    { value: 'mild', label: 'Mild impact' },
    { value: 'moderate', label: 'Moderate impact' },
    { value: 'significant', label: 'Significant impact' },
  ],
  5: [
    { value: 'general_reflection', label: 'General reflection' },
    { value: 'professional_support', label: 'Professional support' },
    { value: 'immediate_resources', label: 'Immediate resources' },
  ],
  6: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'prefer_not_to_answer', label: 'Prefer not to answer' },
  ],
};

// Maps step number → StructuredCheckIn field name (steps 2-6)
const STRUCTURED_FIELD: Record<number, keyof StructuredCheckIn> = {
  2: 'concern_duration',
  3: 'sleep_impact',
  4: 'daily_functioning_impact',
  5: 'support_preference',
  6: 'feels_safe',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CheckInState {
  sessionId: string | null;
  currentStep: number;
  answers: Record<string, string>;
  aiResponse: string | null;
  structuredAnswers: Partial<StructuredCheckIn>;
  mode: 'GUEST' | 'CONNECTED_CARE';
  fallbackMode: boolean;
}

const DEFAULT_STATE: CheckInState = {
  sessionId: null,
  currentStep: 0,
  answers: {},
  aiResponse: null,
  structuredAnswers: {},
  mode: 'GUEST',
  fallbackMode: false,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CheckInPage(): React.ReactNode {
  const router = useRouter();

  // Hydration guard: avoid reading sessionStorage during SSR.
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<CheckInState>(DEFAULT_STATE);

  // Local UI state
  const [primaryText, setPrimaryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Hydration ----
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration detection requires synchronous setState
    setMounted(true);
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CheckInState;
        setState(parsed);
        if (parsed.answers['primary_concern']) {
          setPrimaryText(parsed.answers['primary_concern']);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // ---- Persist on every state change ----
  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — continue silently.
    }
  }, [state, mounted]);

  // ---- API helpers ----
  const createSession = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: state.mode, language: 'en' }),
    });
    if (!res.ok) throw new Error(`Failed to create session (${res.status})`);
    const data = (await res.json()) as { id: string };
    return data.id;
  }, [state.mode]);

  const postMessage = useCallback(
    async (sessionId: string, content: string, structured: Partial<StructuredCheckIn>): Promise<string> => {
      const res = await fetch(`/api/check-ins/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          currentStep: 'primary_concern',
          structuredAnswers: structured,
        }),
      });
      if (!res.ok) throw new Error(`Failed to send message (${res.status})`);
      const data = (await res.json()) as { userFacingResponse: string };
      return data.userFacingResponse;
    },
    [],
  );

  const completeSession = useCallback(
    async (sessionId: string, structured: StructuredCheckIn): Promise<CompleteCheckInResponse | null> => {
      const res = await fetch(`/api/check-ins/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredAnswers: structured }),
      });
      if (!res.ok) return null;
      return (await res.json()) as CompleteCheckInResponse;
    },
    [],
  );

  // ---- Actions ----
  const startCheckIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sessionId = await createSession();
      setState((prev) => ({ ...prev, sessionId, currentStep: 1 }));
    } catch {
      setState((prev) => ({ ...prev, fallbackMode: true, currentStep: 1 }));
      setError('Could not connect to the server. Switched to offline form mode.');
    } finally {
      setIsLoading(false);
    }
  }, [createSession]);

  const handleSubmitStep1 = useCallback(async () => {
    const text = primaryText.trim();
    if (text.length === 0 || text.length > 1000) return;

    setIsLoading(true);
    setError(null);

    const updatedStructured: Partial<StructuredCheckIn> = {
      ...state.structuredAnswers,
      primary_concern: text,
    };

    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, primary_concern: text },
      structuredAnswers: updatedStructured,
      aiResponse: null,
    }));

    if (state.fallbackMode || !state.sessionId) {
      // Offline — no API call, just move forward.
      setState((prev) => ({
        ...prev,
        answers: { ...prev.answers, primary_concern: text },
        structuredAnswers: updatedStructured,
        aiResponse: 'Your response has been noted. Please continue to the next question.',
      }));
      setIsLoading(false);
      return;
    }

    try {
      const aiResponse = await postMessage(state.sessionId, text, updatedStructured);
      setState((prev) => ({
        ...prev,
        answers: { ...prev.answers, primary_concern: text },
        structuredAnswers: updatedStructured,
        aiResponse,
      }));
    } catch {
      // Switch to fallback on failure.
      setState((prev) => ({
        ...prev,
        fallbackMode: true,
        answers: { ...prev.answers, primary_concern: text },
        structuredAnswers: updatedStructured,
        aiResponse: 'Your response has been noted. Please continue to the next question.',
      }));
      setError('Connection lost. Continuing in offline mode.');
    } finally {
      setIsLoading(false);
    }
  }, [primaryText, state.sessionId, state.fallbackMode, state.structuredAnswers, postMessage]);

  const handleOptionSelect = useCallback(
    (value: string) => {
      const stepName = STEP_NAMES[state.currentStep - 1];
      const fieldName = STRUCTURED_FIELD[state.currentStep];

      setState((prev) => {
        const newAnswers = { ...prev.answers, [stepName]: value };
        const newStructured = { ...prev.structuredAnswers };
        if (fieldName) {
          (newStructured as Record<string, unknown>)[fieldName] = value;
        }
        return { ...prev, answers: newAnswers, structuredAnswers: newStructured };
      });
    },
    [state.currentStep],
  );

  const goNext = useCallback(() => {
    if (state.currentStep < TOTAL_STEPS) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  }, [state.currentStep]);

  const goPrev = useCallback(() => {
    if (state.currentStep > 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  }, [state.currentStep]);

  const handleComplete = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Build complete StructuredCheckIn with key_points derived from primary concern.
    const finalStructured: StructuredCheckIn = {
      primary_concern: state.structuredAnswers.primary_concern ?? '',
      concern_duration: (state.structuredAnswers.concern_duration ?? 'days') as StructuredCheckIn['concern_duration'],
      sleep_impact: (state.structuredAnswers.sleep_impact ?? 'none') as StructuredCheckIn['sleep_impact'],
      daily_functioning_impact: (state.structuredAnswers.daily_functioning_impact ?? 'none') as StructuredCheckIn['daily_functioning_impact'],
      support_preference: (state.structuredAnswers.support_preference ?? 'general_reflection') as StructuredCheckIn['support_preference'],
      feels_safe: (state.structuredAnswers.feels_safe ?? 'prefer_not_to_answer') as StructuredCheckIn['feels_safe'],
      key_points: (state.structuredAnswers.primary_concern ?? '')
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 10),
    };

    if (!state.fallbackMode && state.sessionId) {
      try {
        const completeResponse = await completeSession(state.sessionId, finalStructured);

        // Persist the /complete response in sessionStorage so the summary page
        // can read it without calling /complete a second time.
        if (completeResponse) {
          const stored = sessionStorage.getItem(STORAGE_KEY);
          const base = stored ? JSON.parse(stored) as CheckInState : ({} as CheckInState);
          const updated = {
            ...base,
            structuredAnswers: finalStructured,
            completeResponse,
          };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
      } catch {
        // Proceed to summary regardless — data is in sessionStorage.
      }
    }

    const params = state.sessionId ? `?sessionId=${state.sessionId}` : '';
    router.push(`/summary${params}`);
  }, [state.sessionId, state.fallbackMode, state.structuredAnswers, completeSession, router]);

  const handleFallbackSubmit = useCallback(
    (data: StructuredCheckIn) => {
      setState((prev) => ({
        ...prev,
        fallbackMode: true,
        structuredAnswers: data,
        answers: {
          primary_concern: data.primary_concern,
          duration: data.concern_duration,
          sleep_impact: data.sleep_impact,
          daily_functioning_impact: data.daily_functioning_impact,
          support_preference: data.support_preference,
          safety_response: data.feels_safe,
        },
      }));

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore.
      }

      router.push('/summary');
    },
    [router],
  );

  const dismissError = useCallback(() => setError(null), []);

  // ---- Derived values ----
  const currentStepName = state.currentStep >= 1 ? STEP_NAMES[state.currentStep - 1] : null;
  const currentAnswer = currentStepName ? state.answers[currentStepName] ?? null : null;
  const step1Complete = Boolean(state.answers['primary_concern'] && state.aiResponse);
  const currentStepHasAnswer = Boolean(currentAnswer);
  const isLastStep = state.currentStep === TOTAL_STEPS;

  // Don't render interactive content until after hydration.
  if (!mounted) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </Layout>
    );
  }

  // ---- Render: Fallback form mode ----
  if (state.fallbackMode && state.currentStep >= 1) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-6`}>Check-In</h1>
          {error && (
            <div className="mb-4 bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start justify-between gap-3" role="alert">
              <p className="text-sm text-text">{error}</p>
              <button type="button" onClick={dismissError} className="text-text-muted hover:text-text text-sm shrink-0">Dismiss</button>
            </div>
          )}
          <FormFallback onSubmit={handleFallbackSubmit} />
        </div>
      </Layout>
    );
  }

  // ---- Render: Not started ----
  if (state.currentStep === 0) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <div className="text-center py-12 md:py-20">
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-4`}>
              Check-In with {BRAND.name}
            </h1>
            <p className={`${BRAND.typography.bodySize} text-text-muted mb-8 max-w-xl mx-auto`}>
              A brief, guided conversation to help you reflect on your wellbeing. Your responses stay private and are never shared without your consent.
            </p>
            <button
              data-testid="begin-check-in"
              type="button"
              onClick={startCheckIn}
              disabled={isLoading}
              className="inline-block bg-primary hover:bg-primary-light text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {isLoading ? 'Starting…' : 'Begin Check-In'}
            </button>
            {error && (
              <p className="mt-4 text-sm text-error" role="alert">{error}</p>
            )}
            <p className="mt-8 text-sm text-text-muted bg-accent/10 border border-accent/30 rounded-lg p-4 max-w-lg mx-auto">
              {BRAND.prototypeLabel}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // ---- Render: Wizard steps 1–6 ----
  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>Check-In</h1>

        {/* Error banner */}
        {error && (
          <div className="mb-4 bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start justify-between gap-3" role="alert">
            <p className="text-sm text-text">{error}</p>
            <button type="button" onClick={dismissError} className="text-text-muted hover:text-text text-sm shrink-0">Dismiss</button>
          </div>
        )}

        {/* Progress */}
        <StepProgress currentStep={state.currentStep} totalSteps={TOTAL_STEPS} />

        {/* Step card */}
        <div className="bg-surface rounded-xl shadow-sm border border-text/10 p-6">
          {/* Prompt */}
          <h2 className="text-lg md:text-xl font-medium text-text mb-4">{STEP_PROMPTS[state.currentStep]}</h2>

          {/* Step 1: Free text */}
          {state.currentStep === 1 && (
            <div>
              <FreeTextInput
                value={primaryText}
                onChange={setPrimaryText}
                onSubmit={handleSubmitStep1}
                isLoading={isLoading}
                disabled={step1Complete}
              />

              {/* Loading indicator for AI response */}
              {isLoading && state.answers['primary_concern'] && !state.aiResponse && (
                <ChatBubble message="" isLoading />
              )}

              {/* AI response */}
              {state.aiResponse && (
                <ChatBubble message={state.aiResponse} />
              )}
            </div>
          )}

          {/* Steps 2–6: Option selector */}
          {state.currentStep >= 2 && (
            <OptionSelector
              options={STEP_OPTIONS[state.currentStep]}
              selectedValue={currentAnswer}
              onSelect={handleOptionSelect}
              stepName={currentStepName ?? ''}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 gap-4">
          {/* Previous */}
          {state.currentStep > 1 ? (
            <button
              data-testid="prev-step"
              type="button"
              onClick={goPrev}
              className="px-5 py-2.5 border border-text/20 text-text rounded-lg hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              ← Previous
            </button>
          ) : (
            <div />
          )}

          {/* Next / Complete */}
          {isLastStep ? (
            <button
              data-testid="complete-check-in"
              type="button"
              onClick={handleComplete}
              disabled={!currentStepHasAnswer || isLoading}
              className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg transition-colors hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {isLoading ? 'Completing…' : 'Complete Check-In'}
            </button>
          ) : (
            <button
              data-testid="next-step"
              type="button"
              onClick={goNext}
              disabled={
                (state.currentStep === 1 && !step1Complete) ||
                (state.currentStep >= 2 && !currentStepHasAnswer) ||
                isLoading
              }
              className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg transition-colors hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Next →
            </button>
          )}
        </div>

        {/* Persistent disclosure reminder */}
        <p className="mt-8 text-xs text-text-muted text-center bg-secondary/10 border border-secondary/20 rounded-lg p-3">
          {BRAND.disclosure}
        </p>
      </div>
    </Layout>
  );
}
