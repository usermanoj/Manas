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
  WELLBEING_TECHNIQUES,
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
import type { SymptomEntry, SymptomCategory } from '@/domain/repositories';

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
  /** Technique IDs already suggested earlier in the CURRENT session. */
  sessionTechniques?: string[];
  /** User message texts from earlier in the CURRENT session (oldest first). */
  sessionUserMessages?: string[];
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ProactiveResponse {
  archetypes: ConcernArchetype[];
  primaryArchetype: ConcernArchetype;
  validation: string;
  techniques: Technique[];
  /** Questions Manas may ask the user internally (used for session logic). */
  followUpQuestions: string[];
  /**
   * First-person phrases the user might type to elaborate their experience.
   * Shown in the "You could say…" input-helper panel — NOT as AI questions.
   */
  userInputPrompts: string[];
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
  /** Conversation readiness signal: when to summarize or suggest professional help. */
  readiness: 'continue_exploring' | 'almost_ready' | 'ready_to_summarize';
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

type ConversationStage = 1 | 2 | 3 | 4;

function getConversationStage(turnNumber: number): ConversationStage {
  return Math.min(Math.max(turnNumber, 1), 4) as ConversationStage;
}

function techniqueStageCategory(technique: Technique): 'regulation' | 'cognitive_behavioral' | 'meaning_compassion' {
  const frameworks = technique.frameworks.map((f) => f.toLowerCase());
  // Meaning / acceptance / self-compassion first.
  if (frameworks.some((f) => f.includes('act'))) return 'meaning_compassion';
  if (frameworks.some((f) => f.includes('self-compassion'))) return 'meaning_compassion';
  // Regulation practices (breathing, grounding, relaxation, mindfulness).
  if (
    frameworks.some((f) =>
      f.includes('relaxation') ||
      f.includes('biofeedback') ||
      f.includes('mindfulness') ||
      f.includes('mbsr') ||
      f.includes('trauma-informed') ||
      f.includes('stress inoculation') ||
      f.includes('dbt'),
    )
  ) {
    return 'regulation';
  }
  // CBT and behavioral frameworks.
  if (
    frameworks.some((f) => f.includes('cbt') || f.includes('behavioral therapy') || f.includes('stimulus control'))
  ) {
    return 'cognitive_behavioral';
  }
  return 'regulation';
}

function selectTechniques(
  primaryArchetype: ConcernArchetype,
  severity: 'mild' | 'moderate' | 'significant' | 'severe',
  message: string,
  stage: ConversationStage,
  previousTechniques: string[] = [],
): Technique[] {
  const def = getArchetype(primaryArchetype);
  let candidates = getTechniquesForArchetype(primaryArchetype);
  if (candidates.length === 0) {
    candidates = getTechniquesForArchetype('general_wellbeing');
  }

  const lower = message.toLowerCase();
  const acuteDistress =
    lower.includes('panic') ||
    lower.includes('racing heart') ||
    lower.includes('heart races') ||
    lower.includes('overwhelming') ||
    severity === 'severe';

  const suggestedIds = new Set(def.suggestedTechniqueIds);

  // Stage-aware category preference.
  const stageCategoryOrder: Array<'regulation' | 'cognitive_behavioral' | 'meaning_compassion'> =
    stage === 1
      ? ['regulation', 'cognitive_behavioral', 'meaning_compassion']
      : stage === 2
        ? ['cognitive_behavioral', 'regulation', 'meaning_compassion']
        : stage === 3
          ? ['meaning_compassion', 'cognitive_behavioral', 'regulation']
          : ['meaning_compassion', 'cognitive_behavioral', 'regulation'];

  // Stage 4: offer at most one consolidation technique; otherwise two.
  const limit = stage === 4 ? 1 : 2;

  const scoreAndSort = (pool: Technique[]): Technique[] => {
    const scored = pool.map((technique) => {
      let score = 0;
      if (suggestedIds.has(technique.id)) score += 2;
      if (acuteDistress && technique.isCrisisAppropriate) score += 3;
      if (technique.evidenceLevel === 'strong') score += 1;
      const category = techniqueStageCategory(technique);
      const categoryRank = stageCategoryOrder.indexOf(category);
      // Stage is a tie-breaker; archetype-curated suggestions still dominate.
      score += 2 - categoryRank;
      const suggestedIndex = def.suggestedTechniqueIds.indexOf(technique.id);
      return { technique, score, suggestedIndex };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.suggestedIndex !== -1 && b.suggestedIndex !== -1) {
        return a.suggestedIndex - b.suggestedIndex;
      }
      if (a.suggestedIndex !== -1) return -1;
      if (b.suggestedIndex !== -1) return 1;
      return 0;
    });

    return scored.map((s) => s.technique);
  };

  // Never repeat within a conversation: prefer fresh archetype-matched picks.
  const fresh = candidates.filter((t) => !previousTechniques.includes(t.id));
  const selected = scoreAndSort(fresh).slice(0, limit);

  // If the archetype pool is exhausted (e.g. general wellbeing has few
  // techniques), top up from the full library so consecutive turns still vary.
  if (selected.length < limit) {
    const globalFresh = WELLBEING_TECHNIQUES.filter(
      (t) =>
        !previousTechniques.includes(t.id) &&
        !selected.some((s) => s.id === t.id) &&
        (!acuteDistress || t.isCrisisAppropriate),
    );
    selected.push(...scoreAndSort(globalFresh).slice(0, limit - selected.length));
  }

  // Absolute fallback: everything suitable has already been shown — repeat the
  // top archetype picks rather than return an empty list.
  if (selected.length < limit) {
    const repeats = scoreAndSort(candidates).filter((t) => !selected.some((s) => s.id === t.id));
    selected.push(...repeats.slice(0, limit - selected.length));
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Response generation
// ---------------------------------------------------------------------------

function openingAcknowledgment(
  severity: 'mild' | 'moderate' | 'significant' | 'severe',
): string {
  if (severity === 'severe') {
    return 'I can hear how much distress you are carrying right now.';
  }
  if (severity === 'significant') {
    return 'Thank you for sharing that — it sounds like this is really weighing on you.';
  }
  if (severity === 'moderate') {
    return 'Thank you for sharing that — it sounds like a lot to hold.';
  }
  return 'Thank you for checking in — every feeling is worth paying attention to.';
}

function formatSymptomList(symptoms: InferredSymptom[]): string {
  if (symptoms.length === 0) return '';
  const unique = Array.from(new Set(symptoms.map((s) => s.text.toLowerCase())));
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

function buildStageResponse(
  primaryArchetype: ConcernArchetype,
  archetypes: ConcernArchetype[],
  severity: 'mild' | 'moderate' | 'significant' | 'severe',
  stage: ConversationStage,
  inferredSymptoms: InferredSymptom[],
  existingAnswers: Record<string, unknown>,
  wrapUp: boolean = false,
  sessionSymptoms: InferredSymptom[] = [],
): string {
  const def = getArchetype(primaryArchetype);
  const secondary = archetypes.filter((a) => a !== primaryArchetype);
  const parts: string[] = [];

  const validation =
    primaryArchetype === 'general_wellbeing' && inferredSymptoms.length > 0
      ? // The generic archetype's stock validation reads tone-deaf when concrete
        // symptoms were named — acknowledge the specific difficulty instead.
        'That sounds genuinely hard to deal with, and it makes sense that it is wearing on you.'
      : def.validationMessage;

  if (stage === 1) {
    parts.push(openingAcknowledgment(severity));
    parts.push(validation);
    if (inferredSymptoms.length > 0) {
      parts.push(`I noticed you mentioned ${formatSymptomList(inferredSymptoms)}.`);
    }
    parts.push("You don't have to figure this all out right now — let's take it one step at a time.");
  } else if (stage === 2) {
    parts.push('It helps to understand a bit more about what this is like for you.');
    parts.push(validation);
    if (inferredSymptoms.length > 0) {
      parts.push(`I noticed you mentioned ${formatSymptomList(inferredSymptoms)}.`);
    }
    if (secondary.length > 0) {
      const labels = secondary.map((a) => getArchetype(a).label.toLowerCase());
      parts.push(`I also hear some ${labels.join(' and ')} in what you shared.`);
    }
  } else if (stage === 3) {
    parts.push('Thank you for going a little deeper.');
    if (inferredSymptoms.length > 0) {
      parts.push(`I noticed you mentioned ${formatSymptomList(inferredSymptoms)}.`);
    }
    parts.push('To make sure I point you toward the right kind of support, it would help to know what makes this better or harder, and whether you have someone you can talk to.');
  } else {
    // Stage 4: synthesis / closing. Recap the whole session (not just the
    // current message) and point clearly at the summarize action.
    if (wrapUp) {
      parts.push('Thank you for trusting me with all of this today.');
    } else {
      parts.push("You've shared a lot, and I want to make sure I've understood you correctly.");
    }
    const recap = sessionSymptoms.length > 0 ? sessionSymptoms : inferredSymptoms;
    if (recap.length > 0) {
      parts.push(`The main themes from our conversation are ${formatSymptomList(recap.slice(0, 4))}.`);
    } else if (
      typeof existingAnswers.primary_concern === 'string' &&
      (existingAnswers.primary_concern as string).trim().length > 0
    ) {
      parts.push(`You came in to talk about "${(existingAnswers.primary_concern as string).trim()}".`);
    } else {
      parts.push('It sounds like there are a few things sitting under the surface.');
    }
    if (existingAnswers.concern_duration) {
      parts.push('And this has been going on for a while.');
    }
    parts.push(
      'Whenever you\'re ready, tap "Summarize & next steps" below — I\'ll put together your summary along with suggestions, including whether talking to a professional could help.',
    );
  }

  return parts.join(' ').trim();
}

function buildFollowUpQuestions(
  primaryArchetype: ConcernArchetype,
  existingAnswers: Record<string, unknown>,
  stage: ConversationStage,
  turnNumber: number = 1,
): string[] {
  const def = getArchetype(primaryArchetype);

  // Pool of candidate questions from the archetype definition.
  const pool = [...def.followUpQuestions];

  // If we already know the duration, remove duration-related questions.
  if (existingAnswers.concern_duration) {
    const filtered = pool.filter(
      (q) =>
        !q.toLowerCase().includes('how long') &&
        !q.toLowerCase().includes('when did'),
    );
    pool.splice(0, pool.length, ...filtered);
  }

  // Stage-aware filtering: keep questions that fit the current depth.
  const stageFiltered = pool.filter((q) => {
    const lower = q.toLowerCase();
    if (stage <= 2) {
      // Early stages: focus on facts (duration, context, body).
      return (
        lower.includes('how long') ||
        lower.includes('when did') ||
        lower.includes('where do you feel') ||
        lower.includes('what is the main thing') ||
        lower.includes('who or what') ||
        lower.includes('is it harder')
      );
    }
    // Later stages: focus on impact, coping, support, safety.
    return true;
  });

  const usablePool = stageFiltered.length > 0 ? stageFiltered : pool;

  // Rotate the pool so each turn the order shifts, giving variety.
  const offset = (turnNumber - 1) % Math.max(usablePool.length, 1);
  const rotated = [...usablePool.slice(offset), ...usablePool.slice(0, offset)];

  return rotated.slice(0, 2);
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

  // Generic pattern note when previous symptoms exist but no specific pattern is met.
  if (insights.length === 0 && previousSymptoms.length > 0) {
    const categories = Array.from(
      new Set(previousSymptoms.map((s) => s.category).filter((c): c is SymptomCategory => Boolean(c))),
    );
    const categoryLabels: Record<string, string> = {
      sleep: 'sleep',
      mood: 'mood',
      energy: 'energy',
      focus: 'focus',
      physical_tension: 'physical tension',
      social: 'social',
      work_stress: 'work stress',
      other: 'other',
    };
    const labels = categories.map((c) => categoryLabels[c] ?? c);
    if (labels.length > 0) {
      const joined =
        labels.length === 1
          ? labels[0]
          : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
      insights.push(`You have previously noted symptoms related to ${joined}. This check-in adds to that pattern.`);
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
// User input prompts ("You could say…")
// ---------------------------------------------------------------------------

/**
 * Build first-person user elaboration prompts for the "You could say…" panel.
 *
 * These are phrases the user might actually type — they are NOT questions for
 * the user to answer. They rotate across turns to stay fresh, and blend the
 * primary archetype prompts with secondary archetype prompts for variety.
 */
function buildUserInputPrompts(
  primaryArchetype: ConcernArchetype,
  archetypes: ConcernArchetype[],
  stage: ConversationStage,
  turnNumber: number,
): string[] {
  const primaryDef = getArchetype(primaryArchetype);
  const pool: string[] = [...primaryDef.userPrompts];

  // Blend in one prompt from each secondary archetype for richer variety.
  for (const secondary of archetypes.filter((a) => a !== primaryArchetype)) {
    const def = getArchetype(secondary);
    if (def.userPrompts.length > 0) {
      const idx = (turnNumber - 1) % def.userPrompts.length;
      pool.push(def.userPrompts[idx]);
    }
  }

  // Stage-tailored elaboration prompts.
  if (stage === 2) {
    pool.push('It started around...');
    pool.push('It feels worst when...');
  } else if (stage === 3) {
    pool.push('What helps a little is...');
    pool.push('I don\'t really have anyone to talk to about this');
  } else if (stage >= 4) {
    pool.push('I think I\'m ready to see a summary');
    pool.push('I\'d like to know if professional support could help');
  }

  // Rotate the pool so each conversation turn shows different prompts.
  const offset = (turnNumber - 1) % Math.max(pool.length, 1);
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];

  return rotated.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface ProactiveEngineDeps {
  citationService?: CitationService;
}

// Phrases that signal the user wants to close the conversation and see their
// summary / next steps. Deliberately excludes ambiguous words like "finish" or
// "done" alone (e.g. "I can't finish anything at work" is not a wrap-up).
const WRAP_UP_PHRASES = [
  'summarize', 'summarise', 'summary', 'sum up', 'next steps', 'next step',
  'wrap up', "that's all", 'thats all', 'that is all', "that's it", 'thats it',
  'nothing else', "i'm done", 'im done', 'i am done', 'done for now',
  'not sure what else', 'nothing more', "can't think of anything",
  'cant think of anything', 'enough for now', "that's everything",
  'thats everything', 'nothing more to add',
];

function detectsWrapUpIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return WRAP_UP_PHRASES.some((phrase) => lower.includes(phrase));
}

function inferReadiness(
  stage: ConversationStage,
  severity: 'mild' | 'moderate' | 'significant' | 'severe',
  safetyFlag: boolean,
  wrapUp: boolean = false,
): ProactiveResponse['readiness'] {
  if (safetyFlag || severity === 'severe' || wrapUp) return 'ready_to_summarize';
  if (stage <= 2) return 'continue_exploring';
  if (stage === 3) return 'almost_ready';
  // Stage 4+: enough conversation depth to offer a summary.
  return 'ready_to_summarize';
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
    // An explicit wrap-up request ("summarize", "that's all", …) jumps the
    // conversation straight to the synthesis stage regardless of turn number.
    const wrapUp = detectsWrapUpIntent(message);
    const stage: ConversationStage = wrapUp ? 4 : getConversationStage(input.turnNumber ?? 1);
    const existingAnswers = input.existingStructuredAnswers ?? {};

    // Safety scan runs before anything else.
    const safety = runSafetyScan(message);

    // Infer symptoms from the message.
    const inferredSymptoms = inferSymptoms(message);

    // Session-level symptom picture (all earlier user messages + this one),
    // used for the closing recap so it reflects the whole conversation.
    const sessionSymptoms: InferredSymptom[] = [];
    {
      const seen = new Set<string>();
      for (const prior of [...(input.sessionUserMessages ?? []), message]) {
        for (const symptom of inferSymptoms(prior)) {
          if (!seen.has(symptom.text)) {
            seen.add(symptom.text);
            sessionSymptoms.push(symptom);
          }
        }
      }
    }

    // Select techniques based on conversation depth and avoid repeats —
    // combine techniques used in past sessions with those already suggested
    // earlier in THIS session.
    const previousTechniques = [
      ...(input.previousSessions ?? []).flatMap((s) => s.techniquesUsed),
      ...(input.sessionTechniques ?? []),
    ];
    const techniques = selectTechniques(primaryArchetype, severity, message, stage, previousTechniques);

    // Build response components.
    const validation = buildStageResponse(
      primaryArchetype,
      archetypes,
      severity,
      stage,
      inferredSymptoms,
      existingAnswers,
      wrapUp,
      sessionSymptoms,
    );
    const followUpQuestions = safety.flag
      ? [] // Do not ask follow-ups in a safety situation.
      : buildFollowUpQuestions(
          primaryArchetype,
          existingAnswers,
          stage,
          input.turnNumber ?? 1,
        );

    // Build user-facing input prompts (first-person phrases, not AI questions).
    const userInputPrompts = safety.flag
      ? []
      : buildUserInputPrompts(primaryArchetype, archetypes, stage, input.turnNumber ?? 1);

    const crossSessionInsight = buildCrossSessionInsight(
      primaryArchetype,
      inferredSymptoms,
      input.previousSessions,
      input.previousSymptoms,
    );

    const readiness = inferReadiness(stage, severity, safety.flag, wrapUp);

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
      userInputPrompts,
      inferredSymptoms,
      safetyFlag: safety.flag,
      safetyMessage: safety.message,
      crossSessionInsight,
      readiness,
      citations: citationResult.citations,
      suggestedRoutingIndicator: inferRoutingIndicator(primaryArchetype, severity, safety.flag),
    };
  }
}
