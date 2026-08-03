'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/components/auth/AuthProvider';
import { BRAND } from '@/lib/config/brand';
import type { StructuredCheckIn, CompleteCheckInResponse, PostMessageResponse } from '@/domain/ai';
import { CompanionMessage } from '@/components/check-in/CompanionMessage';
import { ChatInput } from '@/components/check-in/ChatInput';
import { FormFallback } from '@/components/check-in/FormFallback';

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'manas-check-in-v2';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: PostMessageResponse;
}

interface CheckInStateV2 {
  sessionId: string | null;
  messages: ChatMessage[];
  structuredAnswers: Partial<StructuredCheckIn>;
  mode: 'GUEST' | 'CONNECTED_CARE';
  fallbackMode: boolean;
  completeResponse?: CompleteCheckInResponse;
}

const DEFAULT_STATE: CheckInStateV2 = {
  sessionId: null,
  messages: [],
  structuredAnswers: {},
  mode: 'GUEST',
  fallbackMode: false,
};

const WELCOME_MESSAGE =
  "Hi, I'm your Manas wellbeing companion. I'm here to listen, not to diagnose. " +
  "Tell me, in your own words, what has been feeling most difficult recently?";

function createEmptyResponse(overrides?: Partial<PostMessageResponse>): PostMessageResponse {
  return {
    userFacingResponse: '',
    extractedUpdates: {},
    requestedFollowUp: null,
    modelVersion: 'mock-v1',
    promptVersion: 'prompt-v1',
    fallbackUsed: false,
    isComplete: false,
    archetypes: [],
    primaryArchetype: 'general_wellbeing',
    techniques: [],
    followUpQuestions: [],
    inferredSymptoms: [],
    safetyFlag: false,
    safetyMessage: null,
    crossSessionInsight: null,
    citations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function buildFinalSummary(
  structured: Partial<StructuredCheckIn>,
  lastResponse?: PostMessageResponse,
): StructuredCheckIn {
  const primaryConcern = structured.primary_concern?.trim() || 'General wellbeing check-in';
  const keyPoints = primaryConcern
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 10);

  return {
    primary_concern: primaryConcern,
    concern_duration: (structured.concern_duration ?? 'days') as StructuredCheckIn['concern_duration'],
    sleep_impact: (structured.sleep_impact ?? 'none') as StructuredCheckIn['sleep_impact'],
    daily_functioning_impact: (structured.daily_functioning_impact ?? 'none') as StructuredCheckIn['daily_functioning_impact'],
    support_preference: (structured.support_preference ?? 'general_reflection') as StructuredCheckIn['support_preference'],
    feels_safe: (structured.feels_safe ?? 'prefer_not_to_answer') as StructuredCheckIn['feels_safe'],
    key_points: keyPoints.length > 0 ? keyPoints : [primaryConcern],
    recordedSymptoms: structured.recordedSymptoms,
    primaryArchetype: lastResponse?.primaryArchetype ?? structured.primaryArchetype ?? 'general_wellbeing',
    techniquesUsed: lastResponse?.techniques.map((t) => t.id) ?? structured.techniquesUsed,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CheckInPage(): React.ReactNode {
  const router = useRouter();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<CheckInStateV2>(DEFAULT_STATE);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Hydration ----
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration detection requires synchronous setState
    setMounted(true);
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CheckInStateV2;
        setState(parsed);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // ---- Persist state ----
  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable — continue silently.
    }
  }, [state, mounted]);

  // ---- Scroll to bottom on new messages ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

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
    async (sessionId: string, content: string, structured: Partial<StructuredCheckIn>): Promise<PostMessageResponse> => {
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
      return (await res.json()) as PostMessageResponse;
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

  const recordSymptomApi = useCallback(
    async (symptom: PostMessageResponse['inferredSymptoms'][number], sessionId?: string): Promise<void> => {
      if (!user) return;
      const res = await fetch('/api/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: symptom.text,
          category: symptom.category,
          severity: symptom.severity,
          frequency: symptom.frequency,
          impact: symptom.impact,
          sessionId,
        }),
      });
      if (!res.ok) throw new Error('Failed to record symptom');
    },
    [user],
  );

  // ---- Actions ----
  const startCheckIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sessionId = await createSession();
      const welcomeMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: WELCOME_MESSAGE,
        response: createEmptyResponse({
          userFacingResponse: WELCOME_MESSAGE,
          requestedFollowUp: 'primary_concern',
        }),
      };
      setState((prev) => ({
        ...prev,
        sessionId,
        messages: [welcomeMessage],
        structuredAnswers: {},
      }));
    } catch {
      const fallbackSessionId = generateId();
      setState((prev) => ({
        ...prev,
        sessionId: fallbackSessionId,
        fallbackMode: true,
        messages: [
          {
            id: generateId(),
            role: 'assistant',
            content: WELCOME_MESSAGE,
          },
        ],
      }));
      setError('Could not connect to the server. Switched to offline form mode.');
    } finally {
      setIsLoading(false);
    }
  }, [createSession]);

  const handleSend = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? inputText).trim();
      if (text.length === 0 || text.length > 1000) return;
      if (!state.sessionId) return;

      setIsLoading(true);
      setError(null);
      setInputText('');

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      if (state.fallbackMode) {
        const fallbackResponse: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Your response has been noted. Please continue sharing or complete the check-in.',
        };
        setState((prev) => ({
          ...prev,
          structuredAnswers: { ...prev.structuredAnswers, primary_concern: text },
          messages: [...prev.messages, fallbackResponse],
        }));
        setIsLoading(false);
        return;
      }

      try {
        const response = await postMessage(state.sessionId, text, state.structuredAnswers);
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.userFacingResponse,
          response,
        };
        setState((prev) => ({
          ...prev,
          structuredAnswers: {
            ...prev.structuredAnswers,
            ...(response.extractedUpdates as Partial<StructuredCheckIn>),
          },
          messages: [...prev.messages, assistantMessage],
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          fallbackMode: true,
          messages: [
            ...prev.messages,
            {
              id: generateId(),
              role: 'assistant',
              content: 'Connection lost. Your answers are being saved locally. Please continue or complete the check-in.',
            },
          ],
        }));
        setError('Connection lost. Continuing in offline mode.');
      } finally {
        setIsLoading(false);
      }
    },
    [inputText, state.sessionId, state.fallbackMode, state.structuredAnswers, postMessage],
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      if (isLoading) return;
      void handleSend(text);
    },
    [handleSend, isLoading],
  );

  const handleRecordSymptom = useCallback(
    async (symptom: PostMessageResponse['inferredSymptoms'][number]) => {
      const recordedEntry = {
        id: generateId(),
        userId: user?.sub ?? 'guest',
        sessionId: state.sessionId ?? undefined,
        text: symptom.text,
        category: symptom.category,
        severity: symptom.severity,
        frequency: symptom.frequency,
        impact: symptom.impact,
        createdAt: new Date(),
      };

      setState((prev) => ({
        ...prev,
        structuredAnswers: {
          ...prev.structuredAnswers,
          recordedSymptoms: [...(prev.structuredAnswers.recordedSymptoms ?? []), recordedEntry],
        },
      }));

      if (user && state.sessionId) {
        try {
          await recordSymptomApi(symptom, state.sessionId);
        } catch {
          setError('Could not record symptom to your profile, but it is saved with this check-in.');
        }
      }
    },
    [user, state.sessionId, recordSymptomApi],
  );

  const handleComplete = useCallback(async () => {
    if (!state.sessionId) return;
    setIsLoading(true);
    setError(null);

    const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant' && m.response);
    const finalStructured = buildFinalSummary(state.structuredAnswers, lastAssistant?.response);

    let completeResponse: CompleteCheckInResponse | undefined;
    if (!state.fallbackMode) {
      try {
        completeResponse = (await completeSession(state.sessionId, finalStructured)) ?? undefined;
        if (completeResponse) {
          setState((prev) => ({ ...prev, completeResponse }));
        }
      } catch {
        // API failed — still persist structuredAnswers for offline recovery.
      }
    }

    try {
      const persistedState = {
        ...state,
        structuredAnswers: finalStructured,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));

      // Also store in the legacy key used by the summary page for the fast path.
      const companionContext = lastAssistant?.response
        ? {
            primaryArchetype: lastAssistant.response.primaryArchetype,
            techniques: lastAssistant.response.techniques.map((t) => ({ id: t.id, name: t.name })),
            citations: lastAssistant.response.citations,
            crossSessionInsight: lastAssistant.response.crossSessionInsight,
          }
        : undefined;
      sessionStorage.setItem(
        'manas-check-in',
        JSON.stringify({
          sessionId: state.sessionId,
          structuredAnswers: finalStructured,
          completeResponse: completeResponse,
          companionContext,
        }),
      );
    } catch {
      // Ignore storage errors.
    }

    const params = state.sessionId ? `?sessionId=${state.sessionId}` : '';
    router.push(`/summary${params}`);
  }, [state, completeSession, router]);

  const handleFallbackSubmit = useCallback(
    (data: StructuredCheckIn) => {
      setState((prev) => ({
        ...prev,
        fallbackMode: true,
        structuredAnswers: data,
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
  const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant' && m.response);
  const isComplete = Boolean(lastAssistant?.response?.isComplete);
  const hasPrimaryConcern = Boolean(state.structuredAnswers.primary_concern);

  // ---- Render: loading hydration ----
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

  // ---- Render: fallback form mode ----
  if (state.fallbackMode && state.messages.length > 0) {
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

  // ---- Render: not started ----
  if (state.messages.length === 0) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <div className="text-center py-12 md:py-20">
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-4`}>
              Check-In with {BRAND.name}
            </h1>
            <p className={`${BRAND.typography.bodySize} text-text-muted mb-8 max-w-xl mx-auto`}>
              An open-ended, private conversation with your AI wellbeing companion. Share what&apos;s on your mind —
              we&apos;ll reflect together and suggest evidence-based techniques.
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

  // ---- Render: chat interface ----
  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>Check-In</h1>
              <p className="text-sm text-text-muted">An open conversation with your wellbeing companion</p>
            </div>
            {isComplete && (
              <button
                data-testid="complete-check-in"
                type="button"
                onClick={handleComplete}
                disabled={isLoading}
                className="px-5 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {isLoading ? 'Completing…' : 'Complete Check-In'}
              </button>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start justify-between gap-3" role="alert">
              <p className="text-sm text-text">{error}</p>
              <button type="button" onClick={dismissError} className="text-text-muted hover:text-text text-sm shrink-0">Dismiss</button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
            {state.messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-5 py-3 max-w-3xl shadow-sm">
                    <p className="leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex justify-start">
                  <CompanionMessage
                    response={message.response ?? createEmptyResponse({ userFacingResponse: message.content })}
                    onQuickReply={handleQuickReply}
                    onRecordSymptom={handleRecordSymptom}
                    isLoading={false}
                    disabled={isLoading}
                  />
                </div>
              ),
            )}
            {isLoading && (
              <div className="flex justify-start">
                <CompanionMessage
                  response={createEmptyResponse()}
                  isLoading
                />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="pt-4 border-t border-text/10">
            <ChatInput
              value={inputText}
              onChange={setInputText}
              onSubmit={() => void handleSend()}
              placeholder={hasPrimaryConcern ? 'Share more…' : 'Share what has been feeling most difficult recently…'}
              isLoading={isLoading}
              disabled={isLoading}
            />
            {!isComplete && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  {BRAND.disclosure}
                </p>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isLoading || !hasPrimaryConcern}
                  className="text-sm text-primary hover:text-primary-light font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Complete now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
