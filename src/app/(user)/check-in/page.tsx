'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AuthUser } from '@/components/auth/AuthProvider';
import { BRAND } from '@/lib/config/brand';
import type { StructuredCheckIn, CompleteCheckInResponse, PostMessageResponse, TechniqueSuggestion } from '@/domain/ai';
import { CompanionMessage } from '@/components/check-in/CompanionMessage';
import { ChatInput } from '@/components/check-in/ChatInput';
import { FormFallback } from '@/components/check-in/FormFallback';

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------
const STORAGE_KEY_PREFIX = 'manas-check-in-v2';
const LEGACY_STORAGE_KEY = 'manas-check-in';

function getStorageKey(user: AuthUser | null): string | null {
  if (!user) return null;
  return `${STORAGE_KEY_PREFIX}-${user.sub}`;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: PostMessageResponse;
}

// ---------------------------------------------------------------------------
// Cross-turn aggregation helpers — the summary must reflect the WHOLE
// conversation, not just the last message.
// ---------------------------------------------------------------------------

/** Collect every substantive user message as a distinct key point. */
function collectKeyPoints(messages: ChatMessage[]): string[] {
  const seen = new Set<string>();
  const points: string[] = [];
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const clean = msg.content.trim();
    if (clean.length === 0) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(clean);
  }
  return points.slice(0, 10);
}

/** Aggregate techniques across all turns, deduped by id, first mention wins. */
function collectTechniques(messages: ChatMessage[]): TechniqueSuggestion[] {
  const seen = new Set<string>();
  const techniques: TechniqueSuggestion[] = [];
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.response) continue;
    for (const t of msg.response.techniques) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      techniques.push(t);
    }
  }
  return techniques;
}

/** Aggregate citations across all turns, deduped by source. */
function collectCitations(messages: ChatMessage[]): PostMessageResponse['citations'] {
  const seen = new Set<string>();
  const citations: PostMessageResponse['citations'] = [];
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.response) continue;
    for (const c of msg.response.citations) {
      if (seen.has(c.source)) continue;
      seen.add(c.source);
      citations.push(c);
    }
  }
  return citations;
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
    userInputPrompts: [],
    inferredSymptoms: [],
    safetyFlag: false,
    safetyMessage: null,
    crossSessionInsight: null,
    readiness: 'continue_exploring',
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
  messages: ChatMessage[],
): StructuredCheckIn {
  const primaryConcern = structured.primary_concern?.trim() || 'General wellbeing check-in';
  // Key points reflect the whole conversation (every user message), falling
  // back to the primary concern if no messages were captured.
  const keyPoints = collectKeyPoints(messages);
  const finalKeyPoints = keyPoints.length > 0 ? keyPoints : [primaryConcern];
  const techniqueIds = collectTechniques(messages).map((t) => t.id);
  const lastWithArchetype = [...messages].reverse().find((m) => m.role === 'assistant' && m.response?.primaryArchetype);

  return {
    primary_concern: primaryConcern,
    concern_duration: (structured.concern_duration ?? 'days') as StructuredCheckIn['concern_duration'],
    sleep_impact: (structured.sleep_impact ?? 'none') as StructuredCheckIn['sleep_impact'],
    daily_functioning_impact: (structured.daily_functioning_impact ?? 'none') as StructuredCheckIn['daily_functioning_impact'],
    support_preference: (structured.support_preference ?? 'general_reflection') as StructuredCheckIn['support_preference'],
    feels_safe: (structured.feels_safe ?? 'prefer_not_to_answer') as StructuredCheckIn['feels_safe'],
    key_points: finalKeyPoints,
    recordedSymptoms: structured.recordedSymptoms,
    primaryArchetype: lastWithArchetype?.response?.primaryArchetype ?? structured.primaryArchetype ?? 'general_wellbeing',
    techniquesUsed: techniqueIds.length > 0 ? techniqueIds : structured.techniquesUsed,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CheckInPage(): React.ReactNode {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<CheckInStateV2>(DEFAULT_STATE);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = getStorageKey(user);

  // ---- Hydration ----
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration detection requires synchronous setState
    setMounted(true);
  }, []);

  // ---- Load persisted history only for signed-in users ----
  useEffect(() => {
    if (!mounted || authLoading || loadedRef.current) return;
    loadedRef.current = true;

    if (user) {
      try {
        const stored = storageKey ? sessionStorage.getItem(storageKey) : null;
        if (stored) {
          const parsed = JSON.parse(stored) as CheckInStateV2;
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage
          setState((prev) => ({
            ...parsed,
            mode: 'CONNECTED_CARE',
            fallbackMode: prev.fallbackMode || parsed.fallbackMode,
          }));
          return;
        }
      } catch {
        if (storageKey) sessionStorage.removeItem(storageKey);
      }
      setState((prev) => ({ ...prev, mode: 'CONNECTED_CARE' }));
      return;
    }

    // Guest: make sure no stale history remains.
    try {
      sessionStorage.removeItem(STORAGE_KEY_PREFIX);
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, [mounted, authLoading, user, storageKey]);

  // ---- Persist state ----
  useEffect(() => {
    if (!mounted || !user || !storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Storage unavailable — continue silently.
    }
  }, [state, mounted, user, storageKey]);

  // ---- Scroll to bottom on new messages ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // ---- API helpers ----
  const createSession = useCallback(async (mode: CheckInStateV2['mode']): Promise<string> => {
    const res = await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, language: 'en' }),
    });
    if (!res.ok) throw new Error(`Failed to create session (${res.status})`);
    const data = (await res.json()) as { id: string };
    return data.id;
  }, []);

  const postMessage = useCallback(
    async (
      sessionId: string,
      content: string,
      structured: Partial<StructuredCheckIn>,
      turnNumber: number,
      sessionTechniques: string[],
      sessionUserMessages: string[],
    ): Promise<PostMessageResponse> => {
      const res = await fetch(`/api/check-ins/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          currentStep: 'primary_concern',
          structuredAnswers: structured,
          turnNumber,
          sessionTechniques,
          sessionUserMessages,
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
    const mode = user ? 'CONNECTED_CARE' : 'GUEST';
    try {
      const sessionId = await createSession(mode);
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
        mode,
        sessionId,
        messages: [welcomeMessage],
        structuredAnswers: {},
      }));
    } catch {
      const fallbackSessionId = generateId();
      setState((prev) => ({
        ...prev,
        mode,
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
  }, [createSession, user]);

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

      const turnNumber = state.messages.filter((m) => m.role === 'user').length + 1;
      // Techniques already shown this session — engine avoids repeating them.
      const sessionTechniques = state.messages
        .filter((m) => m.role === 'assistant' && m.response)
        .flatMap((m) => (m.response?.techniques ?? []).map((t) => t.id));
      // Earlier user messages — engine uses them for the closing recap.
      const sessionUserMessages = state.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

      try {
        const response = await postMessage(state.sessionId, text, state.structuredAnswers, turnNumber, sessionTechniques, sessionUserMessages);
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
    [inputText, state.sessionId, state.fallbackMode, state.structuredAnswers, state.messages, postMessage],
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      if (isLoading) return;
      // Pre-fill the input field instead of sending immediately.
      // This lets the user see and optionally edit the text before submitting.
      setInputText(text);
    },
    [isLoading],
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
    const finalStructured = buildFinalSummary(state.structuredAnswers, state.messages);
    const aggregatedTechniques = collectTechniques(state.messages);
    const aggregatedCitations = collectCitations(state.messages);

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

    // Store a transient copy for the summary page fast path for everyone.
    // The signed-in user also gets a personal resume key.
    try {
      const persistedState = {
        ...state,
        structuredAnswers: finalStructured,
      };
      if (user && storageKey) {
        sessionStorage.setItem(storageKey, JSON.stringify(persistedState));
      }

      const companionContext =
        aggregatedTechniques.length > 0 || aggregatedCitations.length > 0 || lastAssistant?.response
          ? {
              primaryArchetype:
                lastAssistant?.response?.primaryArchetype ?? 'general_wellbeing',
              techniques: aggregatedTechniques,
              citations: aggregatedCitations,
              crossSessionInsight: lastAssistant?.response?.crossSessionInsight ?? null,
            }
          : undefined;
      sessionStorage.setItem(
        LEGACY_STORAGE_KEY,
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
  }, [state, completeSession, router, user, storageKey]);

  const handleFallbackSubmit = useCallback(
    (data: StructuredCheckIn) => {
      setState((prev) => ({
        ...prev,
        fallbackMode: true,
        structuredAnswers: data,
      }));
      try {
        if (storageKey) sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Ignore.
      }
      router.push('/summary');
    },
    [router, storageKey],
  );

  const dismissError = useCallback(() => setError(null), []);

  // ---- Derived values ----
  const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant' && m.response);
  const isComplete = Boolean(lastAssistant?.response?.isComplete);
  const hasPrimaryConcern = Boolean(state.structuredAnswers.primary_concern);
  // Only the newest assistant message shows detail sections (symptoms,
  // techniques, prompts) so they always reflect the latest user input.
  const lastAssistantId = lastAssistant?.id;

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
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-4 md:py-6 h-full flex flex-col`}>
          <h1 className="text-xl md:text-2xl font-semibold text-text mb-4">Check-In</h1>
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
    // Don't block on authLoading — guests can start immediately without waiting
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-4 flex flex-col h-full`}>
          <div className="relative flex flex-col items-center justify-center flex-1 text-center">
            {/* Ambient wash */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute top-8 -left-16 w-64 h-64 rounded-full bg-primary/8 blur-3xl" />
              <div className="absolute bottom-4 -right-16 w-72 h-72 rounded-full bg-secondary/15 blur-3xl" />
            </div>

            {/* Companion avatar */}
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-primary/25 blur-xl animate-pulse" aria-hidden="true" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-light shadow-lg shadow-primary/25 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">M</span>
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-success border-2 border-surface" aria-hidden="true" />
            </div>

            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-[10px] font-semibold uppercase tracking-[0.18em] mb-4">
              A calm space to check in
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text mb-3">
              How are you feeling today?
            </h1>
            <p className="text-sm md:text-base text-text-muted leading-relaxed mb-8 max-w-md">
              Share what&apos;s on your mind in your own words. There&apos;s no right or wrong way to start.
            </p>
            <button
              data-testid="begin-check-in"
              type="button"
              onClick={startCheckIn}
              disabled={isLoading}
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-light hover:from-primary-light hover:to-primary text-white font-semibold px-8 py-3.5 rounded-2xl text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {isLoading ? 'Starting…' : 'Begin Check-In'}
              {!isLoading && (
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
            </button>
            {error && (
              <p className="mt-4 text-sm text-error" role="alert">{error}</p>
            )}
            <p className="mt-8 text-[11px] text-text-muted max-w-sm leading-relaxed">
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
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-3 h-full flex flex-col`}>
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-text/10 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-light shadow-sm flex items-center justify-center">
                  <span className="text-[11px] font-bold text-white">M</span>
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-surface" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Manas</p>
                <p className="text-[10px] text-text-muted">Your wellbeing companion · here to listen</p>
              </div>
            </div>
            {hasPrimaryConcern && (
              <button
                data-testid="complete-check-in"
                type="button"
                onClick={handleComplete}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-white text-sm font-medium rounded-xl shadow-sm shadow-primary/20 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {isLoading && isComplete ? 'Completing…' : 'Finish & View Summary'}
              </button>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-3 bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start justify-between gap-3" role="alert">
              <p className="text-sm text-text">{error}</p>
              <button type="button" onClick={dismissError} className="text-text-muted hover:text-text text-sm shrink-0">Dismiss</button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
            {state.messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="bg-gradient-to-br from-primary to-primary-light text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs md:max-w-md shadow-md shadow-primary/15">
                    <p className="text-sm leading-relaxed">{message.content}</p>
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
                    isLatest={message.id === lastAssistantId}
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
          <div className="pt-3 border-t border-text/10">
            <ChatInput
              value={inputText}
              onChange={setInputText}
              onSubmit={() => void handleSend()}
              placeholder={hasPrimaryConcern ? 'Share more…' : 'Describe what’s been feeling most difficult…'}
              isLoading={isLoading}
              disabled={isLoading}
            />
            {/* Gentle next step — placed after the input so it never interrupts the conversation */}
            {hasPrimaryConcern && (
              <div className="mt-3 flex flex-col items-center gap-1.5">
                <button
                  data-testid="summarize-next-steps"
                  type="button"
                  onClick={handleComplete}
                  disabled={isLoading}
                  className="group inline-flex items-center gap-2 px-5 py-2.5 bg-surface border border-primary/25 text-primary text-sm font-medium rounded-full shadow-sm hover:bg-primary/8 hover:border-primary/40 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  {isLoading && isComplete ? 'Preparing…' : 'Summarize & next steps'}
                </button>
                <p className="text-[10px] text-text-muted">Whenever you feel ready — you can keep sharing too</p>
              </div>
            )}
            <p className="mt-2 text-[10px] text-text-muted text-center">
              {BRAND.disclosure}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
