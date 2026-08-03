/**
 * Proactive Wellbeing Engine
 *
 * The heart of the new Manas companion experience.
 *
 * Given a user message and optional context (previous sessions, prior symptoms),
 * the engine:
 *  1. Classifies concern archetype(s).
 *  2. Runs a safety scan.
 *  3. Infers symptoms from the message.
 *  4. Selects evidence-based techniques matched to archetype + severity.
 *  5. Generates a compassionate, contextual response with dynamic follow-ups.
 *  6. Surfaces cross-session insights when prior data is available.
 *  7. Collects citations.
 *
 * The output is non-diagnostic, educational, and safety-aware.
 */

import {
  CONCERN_ARCHETYPES,
  type ConcernArchetype,
  getArchetype,
} from './archetypes';
import {
  getTechniquesForArchetype,
  type Technique,
  type Citation,
} from './technique-library';
import { inferSymptoms, type InferredSymptom } from './symptom-inference';
import {
  HybridCitationService,
  buildCitationQuery,
  type CitationService,
  type CitationResult,
} from './citation-service';
import type { SymptomEntry } from '@/domain/repositories';

// ---------------------------------------------------------------------------
// Input / context types
// ---------------------------------------------------------------------------

export interface PreviousSessionContext {
  id: string;
  date: string;
  primaryArchetype: ConcernArchetype;
  keyPoints: string[];
  techniquesUsed: string[];
}

export interface ProactiveEngineInput {
  message: string;
  language?: 'en' | 'hi' | 'hi-hinglish';
  turnNumber?: number;
  previousSessions?: PreviousSessionContext[];
  previousSymptoms?: SymptomEntry[];
  existingStructuredAnswers?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ProactiveResponse {
  archetypes: ConcernArchetype[];
  primaryArchetype: ConcernArchetype;
  validation: string;
  techniques: Technique[];
  followUpQuestions: string[];
  inferredSymptoms: InferredSymptom[];
  safetyFlag: boolean;
  safetyMessage?: string;
  crossSessionInsight?: string;
  citations: Citation[];
  suggestedRoutingIndicator?:
    | 'general_wellbeing'
    | 'stress_management'
    | 'sleep_support'
    | 'professional_support_suggested'
    | 'human_review_required';
}

// ---------------------------------------------------------------------------
// Safety scan
// ---------------------------------------------------------------------------

const CRISIS_TERMS = [
  'kill myself', 'killing myself', 'end my life', 'suicide', 'suicidal',
  'want to die', 'better off dead', 'not worth living', 'hurt myself',
  'self-harm', 'cutting myself', 'end it all',
];

const SEVERE_IMPAIRMENT_TERMS = [
  'can\'t get out of bed', 'can\'t eat', 'can\'t sleep for days',
  'hearing voices', 'seeing things', 'losing touch', 'paranoid',
];

function runSafetyScan(message: string): { flag: boolean; message?: string } {
  const lower = message.toLowerCase();

  const hasCrisis = CRISIS_TERMS.some((term) => lower.includes(term));
  const hasSevereImpairment = SEVERE_IMPAIRMENT_TERMS.some((term) => lower.includes(term));

  if (hasCrisis) {
    return {
      flag: true,
      message:
        'I’m really concerned about what you’ve shared. Your safety matters more than anything right now. ' +
        'If you are in immediate danger, please call your local emergency number or go to the nearest emergency room. ' +
        'In the US, you can call or text 988 for the Suicide & Crisis Lifeline. ' +
        'You don’t have to go through this alone.',
    };
  }

  if (hasSevereImpairment) {
    return {
      flag: true,
      message:
        'What you’re describing sounds very serious and may need professional support soon. ' +
        'If you’re not already connected with a mental health professional, please consider reaching out to one. ' +
        'If you feel unsafe, contact emergency services or a crisis line immediately.',
    };
  }

  return { flag: false };
}

// ---------------------------------------------------------------------------
// Archetype classification
// ---------------------------------------------------------------------------

function classifyArchetypes(message: string): ConcernArchetype[] {
  const lower = message.toLowerCase();
  const scores = new Map<ConcernArchetype, number>();

  for (const archetype of Object.keys(CONCERN_ARCHETYPES) as ConcernArchetype[]) {
    if (archetype === 'general_wellbeing') continue;
    const def = CONCERN_ARCHETYPES[archetype];
    let score = 0;
    for (const indicator of def.indicators) {
      if (lower.includes(indicator.toLowerCase())) score += 1;
    }
    if (score > 0) scores.set(archetype, score);
  }

  // Sort by score descending.
  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) return ['general_wellbeing'];

  // Return top archetypes, but cap at 3 and require a meaningful score.
  const topScore = ranked[0][1];
  return ranked
    .filter(([, score]) => score >= topScore * 0.5 && score >= 1)
    .map(([id]) => id)
    .slice(0, 3);
}

function selectPrimaryArchetype(archetypes: ConcernArchetype[]): ConcernArchetype {
  if (archetypes.length === 1) return archetypes[0];

  // Priority order for common comorbid presentations.
  const priority: ConcernArchetype[] = [
    'trauma', 'grief', 'burnout', 'low_mood', 'anxiety',
    'sleep_disturbance', 'somatic_tension', 'stress', 'loneliness', 'existential',
  ];

  for (const p of priority) {
    if (archetypes.includes(p)) return p;
  }

  return archetypes[0];
}

// ---------------------------------------------------------------------------
// Severity inference
// ---------------------------------------------------------------------------

function inferMessageSeverity(message: string): 'mild' | 'moderate' | 'significant' | 'severe' {
  const lower = message.toLowerCase();

  if (
    lower.includes('unbearable') ||
    lower.includes('can\'t function') ||
    lower.includes('worst') ||
    lower.includes('constant') ||
    lower.includes('never stops')
  ) {
    return 'severe';
  }

  if (
    lower.includes('very') ||
    lower.includes('really') ||
    lower.includes('significant') ||
    lower.includes('intense') ||
    lower.includes('bad')
  ) {
    return 'significant';
  }

  if (
    lower.includes('quite') ||
    lower.includes('fairly') ||
    lower.includes('moderate') ||
    lower.includes('difficult')
  ) {
    return 'moderate';
  }

  return 'mild';
}

// ---------------------------------------------------------------------------
// Technique selection
// ---------------------------------------------------------------------------

function selectTechniques(
  primaryArchetype: ConcernArchetype,
  severity: 'mild' | 'moderate' | 'significant' | 'severe',
  message: string,
  previousTechniques: string[] = [],
): Technique[] {
  const def = getArchetype(primaryArchetype);
  const candidates = getTechniquesForArchetype(primaryArchetype);
  if (candidates.length === 0) {
    return getTechniquesForArchetype('general_wellbeing').slice(0, 2);
  }

  // Prefer crisis-appropriate techniques if severe distress language is present.
  const lower = message.toLowerCase();
  const acuteDistress =
    lower.includes('panic') ||
    lower.includes('racing heart') ||
    lower.includes('heart races') ||
    lower.includes('overwhelming') ||
    severity === 'severe';

  const suggestedIds = new Set(def.suggestedTechniqueIds);

  const scored = candidates.map((technique) => {
    let score = 0;
    if (suggestedIds.has(technique.id)) score += 2;
    if (acuteDistress && technique.isCrisisAppropriate) score += 3;
    if (!previousTechniques.includes(technique.id)) score += 1;
    if (technique.evidenceLevel === 'strong') score += 1;
    const suggestedIndex = def.suggestedTechniqueIds.indexOf(technique.id);
    return { technique, score, suggestedIndex };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break by archetype-suggested order (lower index wins).
    if (a.suggestedIndex !== -1 && b.suggestedIndex !== -1) {
      return a.suggestedIndex - b.suggestedIndex;
    }
    if (a.suggestedIndex !== -1) return -1;
    if (b.suggestedIndex !== -1) return 1;
    return 0;
  });

  // Return top 2 techniques, never more than 2 to avoid overwhelming the user.
  return scored.slice(0, 2).map((s) => s.technique);
}

// ---------------------------------------------------------------------------
// Response generation
// ---------------------------------------------------------------------------

function buildValidation(
  primaryArchetype: ConcernArchetype,
  archetypes: ConcernArchetype[],
  severity: 'mild' | 'moderate' | 'significant' | 'severe',
): string {
  const def = getArchetype(primaryArchetype);
  const severityPhrase =
    severity === 'severe'
      ? 'really intense'
      : severity === 'significant'
      ? 'significant'
      : severity === 'moderate'
      ? 'noticeable'
      : 'mild but still valid';

  const secondary = archetypes.filter((a) => a !== primaryArchetype);

  let validation = `I hear that you're going through something ${severityPhrase}. `;

  if (primaryArchetype === 'general_wellbeing') {
    validation += 'Thanks for checking in with yourself. ';
  } else {
    validation += `${def.responseStrategy} `;
  }

  if (secondary.length > 0) {
    const labels = secondary.map((a) => getArchetype(a).label.toLowerCase());
    validation += `I also notice some elements of ${labels.join(' and ')}. `;
  }

  validation += "You don't have to figure this all out right now — let's take it one step at a time.";

  return validation.trim();
}

function buildFollowUpQuestions(
  primaryArchetype: ConcernArchetype,
  existingAnswers: Record<string, unknown>,
): string[] {
  const def = getArchetype(primaryArchetype);
  const questions = [...def.followUpQuestions];

  // If duration is not yet known, prioritize it.
  if (!existingAnswers.concern_duration) {
    questions.unshift('How long has this been going on?');
  }

  // Deduplicate while preserving order.
  return Array.from(new Set(questions)).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Cross-session insights
// ---------------------------------------------------------------------------

function buildCrossSessionInsight(
  primaryArchetype: ConcernArchetype,
  inferredSymptoms: InferredSymptom[],
  previousSessions: PreviousSessionContext[] = [],
  previousSymptoms: SymptomEntry[] = [],
): string | undefined {
  if (previousSessions.length === 0 && previousSymptoms.length === 0) return undefined;

  const insights: string[] = [];

  // Pattern: same archetype recurring.
  const sameArchetypeCount = previousSessions.filter(
    (s) => s.primaryArchetype === primaryArchetype,
  ).length;
  if (sameArchetypeCount >= 2) {
    const label = getArchetype(primaryArchetype).label.toLowerCase();
    insights.push(`This is the ${sameArchetypeCount + 1}th time ${label} has come up recently.`);
  }

  // Pattern: sleep mentioned repeatedly.
  const sleepMentions =
    inferredSymptoms.filter((s) => s.category === 'sleep').length +
    previousSymptoms.filter((s) => s.category === 'sleep').length +
    previousSessions.filter((s) => s.keyPoints.some((k) => k.toLowerCase().includes('sleep'))).length;
  if (sleepMentions >= 3) {
    insights.push('Sleep has come up several times — it may be worth focusing on directly.');
  }

  // Pattern: technique already tried.
  if (previousSessions.length > 0) {
    const recentTechniques = previousSessions[previousSessions.length - 1].techniquesUsed;
    if (recentTechniques.length > 0) {
      insights.push('Last time we discussed some techniques — feel free to tell me what helped or what didn\'t.');
    }
  }

  return insights.length > 0 ? insights.join(' ') : undefined;
}

// ---------------------------------------------------------------------------
// Routing indicator
// ---------------------------------------------------------------------------

function inferRoutingIndicator(
  primaryArchetype: ConcernArchetype,
  severity: 'mild' | 'moderate' | 'significant' | 'severe',
  safetyFlag: boolean,
): ProactiveResponse['suggestedRoutingIndicator'] {
  if (safetyFlag) return 'human_review_required';
  if (severity === 'severe' || severity === 'significant') return 'professional_support_suggested';
  if (primaryArchetype === 'sleep_disturbance') return 'sleep_support';
  if (primaryArchetype === 'stress' || primaryArchetype === 'anxiety') return 'stress_management';
  return 'general_wellbeing';
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface ProactiveEngineDeps {
  citationService?: CitationService;
}

export class ProactiveWellbeingEngine {
  private citationService: CitationService;

  constructor(deps: ProactiveEngineDeps = {}) {
    this.citationService = deps.citationService ?? new HybridCitationService();
  }

  async process(input: ProactiveEngineInput): Promise<ProactiveResponse> {
    const message = input.message.trim();
    const archetypes = classifyArchetypes(message);
    const primaryArchetype = selectPrimaryArchetype(archetypes);
    const severity = inferMessageSeverity(message);

    // Safety scan runs before anything else.
    const safety = runSafetyScan(message);

    // Infer symptoms from the message.
    const inferredSymptoms = inferSymptoms(message);

    // Select techniques.
    const previousTechniques = (input.previousSessions ?? [])
      .flatMap((s) => s.techniquesUsed);
    const techniques = selectTechniques(primaryArchetype, severity, message, previousTechniques);

    // Build response components.
    const validation = buildValidation(primaryArchetype, archetypes, severity);
    const followUpQuestions = safety.flag
      ? [] // Do not ask follow-ups in a safety situation.
      : buildFollowUpQuestions(primaryArchetype, input.existingStructuredAnswers ?? {});

    const crossSessionInsight = buildCrossSessionInsight(
      primaryArchetype,
      inferredSymptoms,
      input.previousSessions,
      input.previousSymptoms,
    );

    // Collect citations.
    const citationQuery = buildCitationQuery(
      techniques,
      `${getArchetype(primaryArchetype).label} mental health`,
    );
    let citationResult: CitationResult;
    try {
      citationResult = await this.citationService.search(citationQuery);
    } catch {
      citationResult = { citations: [], source: 'static', query: citationQuery.query };
    }

    return {
      archetypes,
      primaryArchetype,
      validation,
      techniques,
      followUpQuestions,
      inferredSymptoms,
      safetyFlag: safety.flag,
      safetyMessage: safety.message,
      crossSessionInsight,
      citations: citationResult.citations,
      suggestedRoutingIndicator: inferRoutingIndicator(primaryArchetype, severity, safety.flag),
    };
  }
}
