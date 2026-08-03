import type { ModelGateway, ModelGatewayContext } from '@/domain/ai';
import type { StructuredCheckIn } from '@/domain/ai';
import type { CheckInSession, SafetyAssessment, SymptomEntry } from '@/domain/repositories';
import type { Repository } from '@/domain/repositories';
import type { AuditLogger } from '@/domain/audit';
import type { RoutingDecision } from '@/domain/safety';
import { checkPreGenSafety, checkPostGenSafety } from '@/domain/safety';
import { determineRouting, SAFETY_POLICY_VERSION } from '@/domain/safety';

import {
  validateCheckInTransition,
  isTerminalCheckInStatus,
} from '@/domain/state-machines';
import type { CheckInStatus, CheckInAction } from '@/domain/state-machines';
import { ProactiveWellbeingEngine } from '@/domain/wellbeing';
import type {
  ProactiveResponse,
  PreviousSessionContext,
  ConcernArchetype,
} from '@/domain/wellbeing';
import type {
  TechniqueSuggestion,
  InferredSymptomSuggestion,
} from '@/domain/ai';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface StepResult {
  userFacingResponse: string;
  extractedUpdates: Record<string, unknown>;
  requestedFollowUp: string | null;
  modelVersion: string;
  promptVersion: string;
  fallbackUsed: boolean;
  currentStep: string;
  isComplete: boolean;
  // Proactive companion v2 fields
  archetypes: string[];
  primaryArchetype: string;
  techniques: TechniqueSuggestion[];
  followUpQuestions: string[];
  inferredSymptoms: InferredSymptomSuggestion[];
  safetyFlag: boolean;
  safetyMessage: string | null;
  crossSessionInsight: string | null;
  citations: Array<{
    source: string;
    title?: string;
    url?: string;
    year?: string;
    description?: string;
  }>;
}

export interface DraftCompleteResult {
  draftSummary: StructuredCheckIn;
  aiNarrative: string;
  suggestedKeyPoints: string[];
  provisionalRouting: {
    routingState: string;
    policyVersion: string;
    triggeredRules: string[];
  };
  modelVersion: string;
  promptVersion: string;
  policyVersion: string;
}

export interface ConfirmResult {
  confirmedSummary: StructuredCheckIn;
  routingDecision: RoutingDecision;
  routingState: string;
  policyVersion: string;
  edited: boolean;
}

export interface CheckInOrchestratorDeps {
  modelGateway: ModelGateway;
  fallbackGateway: ModelGateway;
  sessionRepo: Repository<CheckInSession>;
  safetyAssessmentRepo: Repository<SafetyAssessment>;
  auditLogger: AuditLogger;
  proactiveEngine?: ProactiveWellbeingEngine;
  symptomEntryRepo?: Repository<SymptomEntry>;
}

// ---------------------------------------------------------------------------
// Step definitions — maps each step to its valid enum values (if any)
// ---------------------------------------------------------------------------

const CHECK_IN_STEPS: readonly string[] = [
  'primary_concern',
  'duration',
  'sleep_impact',
  'daily_functioning_impact',
  'support_preference',
  'safety_response',
] as const;

const STEP_ENUM_VALUES: Record<string, readonly string[]> = {
  duration: ['days', 'weeks', 'months', 'over_year'],
  sleep_impact: ['none', 'mild', 'significant', 'severe'],
  daily_functioning_impact: ['none', 'mild', 'moderate', 'significant'],
  support_preference: ['general_reflection', 'professional_support', 'immediate_resources'],
  safety_response: ['yes', 'no', 'prefer_not_to_answer'],
};

/** Map step → corresponding StructuredCheckIn field name */
const STEP_TO_FIELD: Record<string, keyof StructuredCheckIn> = {
  primary_concern: 'primary_concern',
  duration: 'concern_duration',
  sleep_impact: 'sleep_impact',
  daily_functioning_impact: 'daily_functioning_impact',
  support_preference: 'support_preference',
  safety_response: 'feels_safe',
};

// ---------------------------------------------------------------------------
// Deterministic acknowledgment messages per step
// ---------------------------------------------------------------------------

const STEP_ACKNOWLEDGMENTS: Record<string, string> = {
  duration: 'Got it. Let\'s continue — has this been affecting your sleep?',
  sleep_impact: 'Thank you for sharing. How is this affecting your daily routine and work?',
  daily_functioning_impact: 'I understand. What kind of support would feel most helpful right now?',
  support_preference: 'Noted. One last question — do you feel safe right now?',
  safety_response: 'Thank you for completing the check-in. I\'m preparing your summary.',
};

// ---------------------------------------------------------------------------
// Helper — generate a unique ID
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Free-text structured-field extraction
// ---------------------------------------------------------------------------

const REQUIRED_STRUCTURED_FIELDS: (keyof StructuredCheckIn)[] = [
  'primary_concern',
  'concern_duration',
  'sleep_impact',
  'daily_functioning_impact',
  'support_preference',
  'feels_safe',
];

const FIELD_QUESTIONS: Record<string, string> = {
  primary_concern: 'What has been feeling most difficult recently?',
  concern_duration: 'How long has this been going on?',
  sleep_impact: 'How has this affected your sleep?',
  daily_functioning_impact: 'How is this affecting your daily routine and work?',
  support_preference: 'What kind of support would feel most helpful right now?',
  feels_safe: 'Do you feel safe right now?',
};

const DURATION_PATTERNS: Record<string, string[]> = {
  days: ['day', 'days', 'a few days', 'couple of days', 'recently', 'just started'],
  weeks: ['week', 'weeks', 'a few weeks', 'couple of weeks'],
  months: ['month', 'months', 'several months', 'few months'],
  over_year: ['year', 'years', 'over a year', 'more than a year', 'long time', 'long while'],
};

const SLEEP_IMPACT_PATTERNS: Record<string, string[]> = {
  none: ['no impact', 'not really', "doesn't affect", 'sleep fine', 'sleeping fine', 'sleep well'],
  mild: ['mild', 'slightly', 'a little', 'bit tired', 'little impact'],
  significant: ['significant', 'very', 'quite a bit', 'waking up', 'trouble falling', 'restless sleep'],
  severe: ['severe', 'cannot sleep', 'no sleep', 'insomnia', 'awake all night', 'barely sleep'],
};

const FUNCTIONING_PATTERNS: Record<string, string[]> = {
  none: ['no impact', 'functioning fine', 'managing fine', 'fine at work', 'coping fine'],
  mild: ['mild', 'slightly', 'a little', 'minor', 'poor focus', 'poor concentration'],
  moderate: ['moderate', 'somewhat', 'noticeable', 'struggling a bit', 'harder than usual', 'hard to focus'],
  significant: ['significant', 'major', 'cannot focus', 'can\'t focus', 'hard to work', 'barely', 'cannot function'],
};

const SUPPORT_PATTERNS: Record<string, string[]> = {
  general_reflection: ['reflection', 'self help', 'myself', 'exercises', 'techniques', 'coping', 'tools'],
  professional_support: ['professional', 'therapist', 'counsellor', 'counselor', 'doctor', 'expert', 'clinician'],
  immediate_resources: ['immediate', 'crisis', 'urgent', 'right now', 'hotline', 'emergency'],
};

const SAFETY_PATTERNS: Record<string, string[]> = {
  yes: ['yes', 'safe', 'i am safe', 'feel safe', 'i\'m safe'],
  no: ['no', 'not safe', 'unsafe', 'scared', 'in danger', 'don\'t feel safe'],
  prefer_not_to_answer: ['prefer not', 'rather not', 'not comfortable', 'don\'t want to say'],
};

function firstMatchingPattern(
  text: string,
  patterns: Record<string, string[]>,
): string | null {
  const lower = text.toLowerCase();
  for (const [value, phrases] of Object.entries(patterns)) {
    for (const phrase of phrases) {
      if (lower.includes(phrase.toLowerCase())) return value;
    }
  }
  return null;
}

function extractDuration(text: string): StructuredCheckIn['concern_duration'] | null {
  const matched = firstMatchingPattern(text, DURATION_PATTERNS);
  if (!matched) return null;
  const valid: StructuredCheckIn['concern_duration'][] = ['days', 'weeks', 'months', 'over_year'];
  return valid.includes(matched as StructuredCheckIn['concern_duration'])
    ? (matched as StructuredCheckIn['concern_duration'])
    : null;
}

function extractSleepImpact(text: string): StructuredCheckIn['sleep_impact'] | null {
  const matched = firstMatchingPattern(text, SLEEP_IMPACT_PATTERNS);
  if (!matched) return null;
  const valid: StructuredCheckIn['sleep_impact'][] = ['none', 'mild', 'significant', 'severe'];
  return valid.includes(matched as StructuredCheckIn['sleep_impact'])
    ? (matched as StructuredCheckIn['sleep_impact'])
    : null;
}

function extractFunctioningImpact(text: string): StructuredCheckIn['daily_functioning_impact'] | null {
  const matched = firstMatchingPattern(text, FUNCTIONING_PATTERNS);
  if (!matched) return null;
  const valid: StructuredCheckIn['daily_functioning_impact'][] = ['none', 'mild', 'moderate', 'significant'];
  return valid.includes(matched as StructuredCheckIn['daily_functioning_impact'])
    ? (matched as StructuredCheckIn['daily_functioning_impact'])
    : null;
}

function extractSupportPreference(text: string): StructuredCheckIn['support_preference'] | null {
  const matched = firstMatchingPattern(text, SUPPORT_PATTERNS);
  if (!matched) return null;
  const valid: StructuredCheckIn['support_preference'][] = ['general_reflection', 'professional_support', 'immediate_resources'];
  return valid.includes(matched as StructuredCheckIn['support_preference'])
    ? (matched as StructuredCheckIn['support_preference'])
    : null;
}

function extractFeelsSafe(text: string): StructuredCheckIn['feels_safe'] | null {
  const matched = firstMatchingPattern(text, SAFETY_PATTERNS);
  if (!matched) return null;
  const valid: StructuredCheckIn['feels_safe'][] = ['yes', 'no', 'prefer_not_to_answer'];
  return valid.includes(matched as StructuredCheckIn['feels_safe'])
    ? (matched as StructuredCheckIn['feels_safe'])
    : null;
}

function extractStructuredUpdates(
  text: string,
  existing: Partial<StructuredCheckIn>,
): Partial<StructuredCheckIn> {
  const updates: Partial<StructuredCheckIn> = { ...existing };
  if (!updates.concern_duration) {
    const duration = extractDuration(text);
    if (duration) updates.concern_duration = duration;
  }
  if (!updates.sleep_impact) {
    const sleep = extractSleepImpact(text);
    if (sleep) updates.sleep_impact = sleep;
  }
  if (!updates.daily_functioning_impact) {
    const functioning = extractFunctioningImpact(text);
    if (functioning) updates.daily_functioning_impact = functioning;
  }
  if (!updates.support_preference) {
    const support = extractSupportPreference(text);
    if (support) updates.support_preference = support;
  }
  if (!updates.feels_safe) {
    const safe = extractFeelsSafe(text);
    if (safe) updates.feels_safe = safe;
  }
  return updates;
}

function getMissingFields(answers: Partial<StructuredCheckIn>): string[] {
  return REQUIRED_STRUCTURED_FIELDS.filter((field) => !answers[field]);
}

function isStructuredComplete(answers: Partial<StructuredCheckIn>): boolean {
  return getMissingFields(answers).length === 0;
}

function buildUserFacingResponse(
  engineOutput: ProactiveResponse,
  missingFields: string[],
): string {
  const parts: string[] = [];

  if (engineOutput.safetyFlag && engineOutput.safetyMessage) {
    parts.push(engineOutput.safetyMessage);
  }

  parts.push(engineOutput.validation);

  if (!engineOutput.safetyFlag && engineOutput.techniques.length > 0) {
    const technique = engineOutput.techniques[0];
    parts.push(
      `One approach that may help right now is **${technique.name}** — ${technique.whenToUse.charAt(0).toLowerCase()}${technique.whenToUse.slice(1)}`,
    );
  }

  if (!engineOutput.safetyFlag && missingFields.length > 0) {
    parts.push(FIELD_QUESTIONS[missingFields[0]] ?? 'Can you tell me a bit more?');
  }

  return parts.join('\n\n');
}

function mapEngineTechniques(engineOutput: ProactiveResponse): TechniqueSuggestion[] {
  return engineOutput.techniques.map((t) => ({
    id: t.id,
    name: t.name,
    whenToUse: t.whenToUse,
    steps: t.steps,
    mechanism: t.mechanism,
    duration: t.duration,
    citations: t.citations,
  }));
}

function mapEngineSymptoms(engineOutput: ProactiveResponse): InferredSymptomSuggestion[] {
  return engineOutput.inferredSymptoms.map((s) => ({
    text: s.text,
    category: s.category,
    severity: s.severity,
    frequency: s.frequency,
    impact: s.impact,
    confidence: s.confidence,
    sourcePhrase: s.sourcePhrase,
    userReported: false,
  }));
}

// ---------------------------------------------------------------------------
// CheckInOrchestrator
// ---------------------------------------------------------------------------

export class CheckInOrchestrator {
  private proactiveEngine: ProactiveWellbeingEngine;

  constructor(private deps: CheckInOrchestratorDeps) {
    this.proactiveEngine = deps.proactiveEngine ?? new ProactiveWellbeingEngine();
  }

  /**
   * Create a new check-in session.
   */
  async createSession(
    mode: 'GUEST' | 'CONNECTED_CARE',
    language: 'en',
  ): Promise<CheckInSession> {
    const session: CheckInSession = {
      id: generateId(),
      userId: mode === 'GUEST' ? 'guest' : 'connected',
      mode,
      language,
      status: 'INITIATED',
      modelVersion: 'mock-v1',
      promptVersion: 'prompt-v1',
      startedAt: new Date(),
    };

    await this.deps.sessionRepo.create(session);

    await this.deps.auditLogger.log({
      requestId: session.id,
      userId: session.userId,
      actor: 'system',
      eventType: 'CHECK_IN_STARTED',
      details: { sessionId: session.id, mode },
      modelVersion: session.modelVersion,
      promptVersion: session.promptVersion,
      policyVersion: SAFETY_POLICY_VERSION,
    });

    return session;
  }

  /**
   * Handle a single check-in step.
   *
   * Stateless-capable: structuredAnswers are passed in so the orchestrator
   * does not rely on server-side state.
   *
   * Mode A — primary_concern (chat-style):
   *   Runs the proactive wellbeing engine to produce a contextual, cited
   *   response, infer symptoms, suggest techniques, and extract structured
   *   fields from free text.
   *
   * Mode B — steps 2–6 with enum value:
   *   Backward-compatible deterministic acknowledgment for existing tests
   *   and quick-reply clients.
   *
   * Mode C — steps 2–6 with free text:
   *   Treated as additional chat context; proactive engine enriches the
   *   response and extracts any new structured fields.
   */
  async handleStep(
    sessionId: string,
    step: string,
    userInput: string,
    structuredAnswers: Partial<StructuredCheckIn>,
  ): Promise<StepResult> {
    // Validate step
    if (!CHECK_IN_STEPS.includes(step)) {
      throw new Error(`Invalid check-in step: "${step}".`);
    }

    const session = await this.deps.sessionRepo.findById(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }
    if (isTerminalCheckInStatus(session.status as CheckInStatus)) {
      throw new Error(`Session "${sessionId}" is in terminal status "${session.status}".`);
    }

    // Enforce state machine: INITIATED requires primary_concern as the first step.
    if (session.status === 'INITIATED') {
      if (step !== 'primary_concern') {
        throw new Error(
          `Session "${sessionId}" is INITIATED — first step must be "primary_concern", got "${step}".`,
        );
      }
      const transition = validateCheckInTransition(session.status as CheckInStatus, 'first_message' as CheckInAction);
      if (transition.valid) {
        await this.deps.sessionRepo.update(sessionId, { status: transition.nextStatus });
      }
    } else if (session.status === 'IN_PROGRESS') {
      // subsequent messages keep IN_PROGRESS
      validateCheckInTransition(session.status as CheckInStatus, 'subsequent_message' as CheckInAction);
    }

    // ── Mode B: backward-compatible deterministic enum step ────────────────
    const validValues = STEP_ENUM_VALUES[step];
    if (step !== 'primary_concern' && validValues && validValues.includes(userInput)) {
      const field = STEP_TO_FIELD[step];
      const extractedUpdates: Record<string, unknown> = {
        ...structuredAnswers,
        [field]: userInput,
      };
      const isLastStep = step === 'safety_response';

      return {
        userFacingResponse: STEP_ACKNOWLEDGMENTS[step] ?? 'Noted.',
        extractedUpdates,
        requestedFollowUp: null,
        modelVersion: session.modelVersion,
        promptVersion: session.promptVersion,
        fallbackUsed: false,
        currentStep: step,
        isComplete: isLastStep,
        archetypes: [],
        primaryArchetype: 'general_wellbeing',
        techniques: [],
        followUpQuestions: [],
        inferredSymptoms: [],
        safetyFlag: false,
        safetyMessage: null,
        crossSessionInsight: null,
        citations: [],
      };
    }

    // ── Mode A/C: chat-style proactive companion ───────────────────────────
    if (userInput.length < 1 || userInput.length > 1000) {
      throw new Error('Message must be between 1 and 1000 characters.');
    }

    // Pre-generation safety (clinical boundary guard)
    const preGen = checkPreGenSafety(userInput);
    if (preGen.action === 'BLOCK') {
      await this.deps.auditLogger.log({
        requestId: sessionId,
        userId: session.userId,
        actor: 'system',
        eventType: 'SAFEGUARD_TRIGGERED',
        details: { step, action: 'BLOCK', ruleName: preGen.ruleName ?? '' },
        modelVersion: session.modelVersion,
        promptVersion: session.promptVersion,
        policyVersion: SAFETY_POLICY_VERSION,
      });

      return {
        userFacingResponse: preGen.userFacingMessage ?? 'This request cannot be processed.',
        extractedUpdates: { ...structuredAnswers },
        requestedFollowUp: null,
        modelVersion: session.modelVersion,
        promptVersion: session.promptVersion,
        fallbackUsed: false,
        currentStep: step,
        isComplete: false,
        archetypes: [],
        primaryArchetype: 'general_wellbeing',
        techniques: [],
        followUpQuestions: [],
        inferredSymptoms: [],
        safetyFlag: true,
        safetyMessage: preGen.userFacingMessage ?? null,
        crossSessionInsight: null,
        citations: [],
      };
    }

    if (preGen.action === 'ESCALATE') {
      await this.deps.auditLogger.log({
        requestId: sessionId,
        userId: session.userId,
        actor: 'system',
        eventType: 'SAFEGUARD_TRIGGERED',
        details: { step, action: 'ESCALATE', ruleName: preGen.ruleName ?? '' },
        modelVersion: session.modelVersion,
        promptVersion: session.promptVersion,
        policyVersion: SAFETY_POLICY_VERSION,
      });
    }

    // Start from previously extracted answers.
    let baseAnswers: Partial<StructuredCheckIn> = { ...structuredAnswers };

    // Ensure primary_concern is captured from the first chat message.
    if (step === 'primary_concern' && !baseAnswers.primary_concern) {
      baseAnswers = { ...baseAnswers, primary_concern: userInput };
    }

    // Extract additional structured fields from free text.
    const extractedAnswers = extractStructuredUpdates(userInput, baseAnswers);

    // Gather cross-session context (demo: previous sessions and symptoms from same user in repo).
    const previousSessions = await this.buildPreviousSessionContext(sessionId, session.userId);
    const previousSymptoms = this.deps.symptomEntryRepo
      ? await this.deps.symptomEntryRepo.findAll({ userId: session.userId })
      : [];

    let engineOutput: ProactiveResponse;
    try {
      engineOutput = await this.proactiveEngine.process({
        message: userInput,
        language: session.language as 'en' | 'hi' | 'hi-hinglish',
        turnNumber: 1,
        previousSessions,
        previousSymptoms,
        existingStructuredAnswers: extractedAnswers,
      });
    } catch {
      // Fallback: deterministic validation + next missing field question.
      const missing = getMissingFields(extractedAnswers);
      engineOutput = {
        archetypes: ['general_wellbeing'],
        primaryArchetype: 'general_wellbeing',
        validation: 'Thank you for sharing that with me.',
        techniques: [],
        followUpQuestions: missing.length > 0 ? [FIELD_QUESTIONS[missing[0]] ?? 'Can you tell me more?'] : [],
        inferredSymptoms: [],
        safetyFlag: false,
        citations: [],
      };
    }

    const missingFields = getMissingFields(extractedAnswers);
    const userFacingResponse = buildUserFacingResponse(engineOutput, missingFields);

    return {
      userFacingResponse,
      extractedUpdates: extractedAnswers as Record<string, unknown>,
      requestedFollowUp: missingFields.length > 0 ? missingFields[0] : null,
      modelVersion: session.modelVersion,
      promptVersion: session.promptVersion,
      fallbackUsed: false,
      currentStep: step,
      isComplete: isStructuredComplete(extractedAnswers),
      archetypes: engineOutput.archetypes,
      primaryArchetype: engineOutput.primaryArchetype,
      techniques: mapEngineTechniques(engineOutput),
      followUpQuestions: engineOutput.followUpQuestions,
      inferredSymptoms: mapEngineSymptoms(engineOutput),
      safetyFlag: engineOutput.safetyFlag,
      safetyMessage: engineOutput.safetyMessage ?? null,
      crossSessionInsight: engineOutput.crossSessionInsight ?? null,
      citations: engineOutput.citations,
    };
  }

  /**
   * Build previous-session context for cross-session insights.
   * Demo implementation: scans the repository for sessions belonging to the
   * same user, excluding the current one, and synthesizes a lightweight context.
   */
  private async buildPreviousSessionContext(
    currentSessionId: string,
    userId: string,
  ): Promise<PreviousSessionContext[]> {
    try {
      const sessions = await this.deps.sessionRepo.findAll({ userId });
      return sessions
        .filter((s) => s.id !== currentSessionId && s.structuredSummary)
        .map((s) => ({
          id: s.id,
          date: s.startedAt instanceof Date ? s.startedAt.toISOString() : String(s.startedAt),
          primaryArchetype: (s.structuredSummary?.primaryArchetype as ConcernArchetype) ?? 'general_wellbeing',
          keyPoints: s.structuredSummary?.key_points ?? [],
          techniquesUsed: (s.structuredSummary?.techniquesUsed as string[]) ?? [],
        }))
        .slice(-3);
    } catch {
      return [];
    }
  }

  /**
   * Complete the check-in session and produce a draft summary with
   * provisional routing. Stateless-capable: structuredAnswers passed in.
   */
  async completeSession(
    sessionId: string,
    structuredAnswers: StructuredCheckIn,
  ): Promise<DraftCompleteResult> {
    const session = await this.deps.sessionRepo.findById(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }

    // Idempotent: if the session is already terminal and has a summary, reuse it.
    if (isTerminalCheckInStatus(session.status as CheckInStatus) && session.structuredSummary) {
      const routingDecision = determineRouting(session.structuredSummary, generateId());
      const { narrative, suggestedKeyPoints } = await this.generateNarrative(
        sessionId,
        session.structuredSummary,
        session,
      );
      return {
        draftSummary: session.structuredSummary,
        aiNarrative: narrative,
        suggestedKeyPoints,
        provisionalRouting: {
          routingState: routingDecision.routingState,
          policyVersion: routingDecision.policyVersion,
          triggeredRules: routingDecision.triggeredRules,
        },
        modelVersion: session.modelVersion,
        promptVersion: session.promptVersion,
        policyVersion: SAFETY_POLICY_VERSION,
      };
    }

    if (isTerminalCheckInStatus(session.status as CheckInStatus)) {
      throw new Error(`Session "${sessionId}" is in terminal status "${session.status}".`);
    }

    // Transition to COMPLETED
    const currentStatus = session.status as CheckInStatus;
    if (currentStatus === 'INITIATED') {
      // Must pass through IN_PROGRESS first
      const firstTransition = validateCheckInTransition(currentStatus, 'first_message');
      if (firstTransition.valid) {
        await this.deps.sessionRepo.update(sessionId, { status: firstTransition.nextStatus });
        const completeTransition = validateCheckInTransition(firstTransition.nextStatus, 'complete');
        if (completeTransition.valid) {
          await this.deps.sessionRepo.update(sessionId, {
            status: completeTransition.nextStatus,
            completedAt: new Date(),
            structuredSummary: structuredAnswers,
          });
        }
      }
    } else {
      const transition = validateCheckInTransition(currentStatus, 'complete');
      if (transition.valid) {
        await this.deps.sessionRepo.update(sessionId, {
          status: transition.nextStatus,
          completedAt: new Date(),
          structuredSummary: structuredAnswers,
        });
      }
    }

    // Provisional routing
    const requestId = generateId();
    const routingDecision = determineRouting(structuredAnswers, requestId);

    // AI narrative + key points
    const { narrative, suggestedKeyPoints } = await this.generateNarrative(
      sessionId,
      structuredAnswers,
      session,
    );

    await this.deps.auditLogger.log({
      requestId,
      userId: session.userId,
      actor: 'system',
      eventType: 'SUMMARY_GENERATED',
      details: {
        sessionId,
        routingState: routingDecision.routingState,
        triggeredRules: routingDecision.triggeredRules,
      },
      modelVersion: session.modelVersion,
      promptVersion: session.promptVersion,
      policyVersion: SAFETY_POLICY_VERSION,
    });

    return {
      draftSummary: structuredAnswers,
      aiNarrative: narrative,
      suggestedKeyPoints,
      provisionalRouting: {
        routingState: routingDecision.routingState,
        policyVersion: routingDecision.policyVersion,
        triggeredRules: routingDecision.triggeredRules,
      },
      modelVersion: session.modelVersion,
      promptVersion: session.promptVersion,
      policyVersion: SAFETY_POLICY_VERSION,
    };
  }

  /**
   * Generate a compassionate, non-diagnostic narrative summary from the
   * structured answers. Falls back to a deterministic narrative if the model
   * is unavailable or returns unsafe output.
   */
  private async generateNarrative(
    sessionId: string,
    summary: StructuredCheckIn,
    session: CheckInSession,
  ): Promise<{ narrative: string; suggestedKeyPoints: string[] }> {
    const durationLabels: Record<string, string> = {
      days: 'a few days',
      weeks: 'a few weeks',
      months: 'several months',
      over_year: 'over a year',
    };
    const sleepLabels: Record<string, string> = {
      none: 'no impact on sleep',
      mild: 'a mild impact on sleep',
      significant: 'a significant impact on sleep',
      severe: 'a severe impact on sleep',
    };
    const functioningLabels: Record<string, string> = {
      none: 'no impact on daily functioning',
      mild: 'a mild impact on daily functioning',
      moderate: 'a moderate impact on daily functioning',
      significant: 'a significant impact on daily functioning',
    };

    // Defensive defaults for incomplete/bypassed input (e.g. tests).
    const primaryConcern = summary.primary_concern?.trim() || 'something difficult';
    const concernDuration = (summary.concern_duration as string) || 'days';
    const sleepImpact = (summary.sleep_impact as string) || 'none';
    const functioningImpact = (summary.daily_functioning_impact as string) || 'none';
    const supportPreference = (summary.support_preference as string) || 'general_reflection';
    const feelsSafe = (summary.feels_safe as string) || 'prefer_not_to_answer';

    const fallbackNarrative =
      `You've shared that "${primaryConcern}" has been difficult for ${durationLabels[concernDuration]}. ` +
      `You noticed ${sleepLabels[sleepImpact]} and ${functioningLabels[functioningImpact]}. ` +
      `You're looking for ${supportPreference.replace(/_/g, ' ')}. ` +
      "This is a reflection of what you told me — not a diagnosis or clinical assessment.";

    const fallbackKeyPoints = [
      primaryConcern,
      `Duration: ${durationLabels[concernDuration]}`,
      `Sleep: ${sleepLabels[sleepImpact]}`,
      `Daily functioning: ${functioningLabels[functioningImpact]}`,
      `Support preference: ${supportPreference.replace(/_/g, ' ')}`,
    ];

    try {
      const prompt =
        "You are Manus, a warm AI wellbeing companion. Write a short, compassionate, non-diagnostic summary (max 200 words) based on the following check-in. " +
        "Do not diagnose, label, or recommend medication. Reflect the user's own words.\n\n" +
        `Primary concern: ${primaryConcern}\n` +
        `Duration: ${durationLabels[concernDuration]}\n` +
        `Sleep impact: ${sleepLabels[sleepImpact]}\n` +
        `Daily functioning impact: ${functioningLabels[functioningImpact]}\n` +
        `Support preference: ${supportPreference.replace(/_/g, ' ')}\n` +
        `Feels safe right now: ${feelsSafe}`;

      const context: ModelGatewayContext = {
        sessionId,
        language: session.language as ModelGatewayContext['language'],
        turnNumber: 7,
        previousExtractedUpdates: {},
      };

      const aiOutput = await this.deps.modelGateway.generate(prompt, context);
      const postGen = checkPostGenSafety(aiOutput.user_facing_response);
      const narrative = postGen.safe ? aiOutput.user_facing_response : fallbackNarrative;

      const keyPoints =
        summary.key_points && summary.key_points.length > 0
          ? summary.key_points.slice(0, 10)
          : fallbackKeyPoints;

      return { narrative, suggestedKeyPoints: keyPoints };
    } catch {
      return { narrative: fallbackNarrative, suggestedKeyPoints: fallbackKeyPoints };
    }
  }

  /**
   * Confirm (or edit) the draft summary. Produces final routing,
   * persists SafetyAssessment, and transitions to SUMMARIZED.
   */
  async confirmSummary(
    sessionId: string,
    confirmedSummary: StructuredCheckIn,
    draftSummary?: StructuredCheckIn,
  ): Promise<ConfirmResult> {
    const session = await this.deps.sessionRepo.findById(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found.`);
    }
    if (isTerminalCheckInStatus(session.status as CheckInStatus)) {
      throw new Error(`Session "${sessionId}" has already been confirmed (status: "${session.status}").`);
    }

    // Detect edits
    let edited = false;
    if (draftSummary) {
      const fields: (keyof StructuredCheckIn)[] = [
        'primary_concern',
        'concern_duration',
        'sleep_impact',
        'daily_functioning_impact',
        'support_preference',
        'feels_safe',
      ];
      for (const field of fields) {
        if (confirmedSummary[field] !== draftSummary[field]) {
          edited = true;
          break;
        }
      }
      // Also compare key_points arrays
      if (
        !edited &&
        JSON.stringify(confirmedSummary.key_points) !== JSON.stringify(draftSummary.key_points)
      ) {
        edited = true;
      }
    }

    const requestId = generateId();

    if (edited) {
      await this.deps.auditLogger.log({
        requestId,
        userId: session.userId,
        actor: 'user',
        eventType: 'SUMMARY_EDITED',
        details: { sessionId },
        modelVersion: session.modelVersion,
        promptVersion: session.promptVersion,
        policyVersion: SAFETY_POLICY_VERSION,
      });
    }

    // Persist confirmed summary
    await this.deps.sessionRepo.update(sessionId, {
      structuredSummary: confirmedSummary,
    });

    // Final routing
    const routingDecision = determineRouting(confirmedSummary, requestId);

    // Transition to SUMMARIZED
    const currentStatus = session.status as CheckInStatus;
    const transition = validateCheckInTransition(currentStatus, 'summary_stored' as CheckInAction);
    if (transition.valid) {
      await this.deps.sessionRepo.update(sessionId, { status: transition.nextStatus });
    }

    // Persist SafetyAssessment
    const safetyAssessment: SafetyAssessment = {
      id: generateId(),
      sessionId,
      preGenResult: { action: 'ALLOW' },
      postGenResult: { safe: true, claimsDetected: [], replacedWithFallback: false },
      routingState: routingDecision.routingState,
      policyVersion: routingDecision.policyVersion,
      createdAt: new Date(),
    };
    await this.deps.safetyAssessmentRepo.create(safetyAssessment);

    // Audit: SUMMARY_CONFIRMED
    await this.deps.auditLogger.log({
      requestId,
      userId: session.userId,
      actor: 'user',
      eventType: 'SUMMARY_CONFIRMED',
      details: { sessionId, edited },
      modelVersion: session.modelVersion,
      promptVersion: session.promptVersion,
      policyVersion: SAFETY_POLICY_VERSION,
    });

    // Audit: ROUTING_DECIDED
    await this.deps.auditLogger.log({
      requestId,
      userId: session.userId,
      actor: 'system',
      eventType: 'ROUTING_DECIDED',
      details: {
        sessionId,
        routingState: routingDecision.routingState,
        triggeredRules: routingDecision.triggeredRules,
      },
      modelVersion: session.modelVersion,
      promptVersion: session.promptVersion,
      policyVersion: SAFETY_POLICY_VERSION,
    });

    return {
      confirmedSummary,
      routingDecision,
      routingState: routingDecision.routingState,
      policyVersion: routingDecision.policyVersion,
      edited,
    };
  }
}
