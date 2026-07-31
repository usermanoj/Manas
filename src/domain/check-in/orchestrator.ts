import type { ModelGateway, ModelGatewayContext } from '@/domain/ai';
import type { StructuredCheckIn } from '@/domain/ai';
import type { CheckInSession, SafetyAssessment } from '@/domain/repositories';
import type { Repository } from '@/domain/repositories';
import type { AuditLogger } from '@/domain/audit';
import type { RoutingDecision } from '@/domain/safety';
import { checkPreGenSafety, checkPostGenSafety } from '@/domain/safety';
import { determineRouting, SAFETY_POLICY_VERSION } from '@/domain/safety';
import { SAFE_FALLBACK } from '@/domain/ai';
import {
  validateCheckInTransition,
  isTerminalCheckInStatus,
} from '@/domain/state-machines';
import type { CheckInStatus, CheckInAction } from '@/domain/state-machines';

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
}

export interface DraftCompleteResult {
  draftSummary: StructuredCheckIn;
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
// CheckInOrchestrator
// ---------------------------------------------------------------------------

export class CheckInOrchestrator {
  constructor(private deps: CheckInOrchestratorDeps) {}

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
   * Handle a single check-in step. Stateless-capable: structuredAnswers
   * are passed in so the orchestrator does not rely on server-side state.
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

    let fallbackUsed = false;

    // ── Step 1: primary_concern (AI + safety) ──────────────────────────────
    if (step === 'primary_concern') {
      // Validate input length
      if (userInput.length < 1 || userInput.length > 1000) {
        throw new Error('primary_concern must be between 1 and 1000 characters.');
      }

      // Pre-generation safety
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
          extractedUpdates: {},
          requestedFollowUp: null,
          modelVersion: session.modelVersion,
          promptVersion: session.promptVersion,
          fallbackUsed: false,
          currentStep: step,
          isComplete: false,
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

      // Model generation with fallback
      const context: ModelGatewayContext = {
        sessionId,
        language: session.language as ModelGatewayContext['language'],
        turnNumber: 1,
        previousExtractedUpdates: {},
      };

      let aiOutput;
      try {
        aiOutput = await this.deps.modelGateway.generate(userInput, context);
      } catch {
        aiOutput = await this.deps.fallbackGateway.generate(userInput, context);
        fallbackUsed = true;
        await this.deps.auditLogger.log({
          requestId: sessionId,
          userId: session.userId,
          actor: 'system',
          eventType: 'MODEL_FALLBACK_USED',
          details: { step, reason: 'model_generation_failed' },
          modelVersion: 'fallback',
          promptVersion: 'fallback-v1',
          policyVersion: SAFETY_POLICY_VERSION,
        });
      }

      // Post-generation safety
      const postGen = checkPostGenSafety(aiOutput.user_facing_response);
      let userFacingResponse = aiOutput.user_facing_response;
      if (!postGen.safe) {
        userFacingResponse = SAFE_FALLBACK.user_facing_response;
      }

      return {
        userFacingResponse,
        extractedUpdates: aiOutput.extracted_updates,
        requestedFollowUp: aiOutput.requested_follow_up,
        modelVersion: aiOutput.model_version,
        promptVersion: aiOutput.prompt_version,
        fallbackUsed,
        currentStep: step,
        isComplete: false, // primary_concern is never the last step
      };
    }

    // ── Steps 2–6: deterministic enum validation ─────────────────────────
    const validValues = STEP_ENUM_VALUES[step];
    if (validValues && !validValues.includes(userInput)) {
      throw new Error(
        `Invalid value "${userInput}" for step "${step}". Expected one of: ${validValues.join(', ')}.`,
      );
    }

    // Build the extracted update for this step
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
    };
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
          });
        }
      }
    } else {
      const transition = validateCheckInTransition(currentStatus, 'complete');
      if (transition.valid) {
        await this.deps.sessionRepo.update(sessionId, {
          status: transition.nextStatus,
          completedAt: new Date(),
        });
      }
    }

    // Provisional routing
    const requestId = generateId();
    const routingDecision = determineRouting(structuredAnswers, requestId);

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
