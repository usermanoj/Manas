/**
 * Symptom Inference Engine
 *
 * Extracts potential symptom entries from free-text user messages.
 * Combines rule-based keyword detection with heuristic severity/frequency
 * inference. All inferences are suggestions — the user confirms before
 * anything is stored.
 */

import type { SymptomCategory, SymptomSeverity, SymptomFrequency } from '@/domain/repositories';

export interface InferredSymptom {
  text: string;
  category: SymptomCategory;
  severity: SymptomSeverity;
  frequency: SymptomFrequency;
  impact: string;
  confidence: number;
  sourcePhrase: string;
  userReported: boolean;
}

interface SymptomPattern {
  category: SymptomCategory;
  phrases: string[];
  defaultText: string;
  defaultImpact: string;
}

const SEVERITY_MARKERS: Record<SymptomSeverity, string[]> = {
  mild: ['a little', 'bit', 'slightly', 'mild', 'somewhat', 'minor'],
  moderate: ['quite', 'moderate', 'fairly', 'pretty', 'uncomfortable', 'difficult'],
  significant: ['very', 'really', 'significant', 'bad', 'hard', 'overwhelming', 'intense'],
  severe: ['extreme', 'severe', 'unbearable', 'worst', 'terrifying', 'constant', 'can\'t function', 'cannot function'],
};

const FREQUENCY_MARKERS: Record<SymptomFrequency, string[]> = {
  occasionally: ['once', 'rarely', 'sometimes', 'now and then', 'occasionally'],
  weekly: ['weekly', 'once a week', 'few times a week'],
  several_times_a_week: ['several times a week', 'most days', '3-4 times'],
  daily: ['daily', 'every day', 'every night', 'all day', 'most days'],
  constant: ['constant', 'all the time', 'never stops', 'continuous', 'every moment'],
};

const SYMPTOM_PATTERNS: SymptomPattern[] = [
  {
    // Sleep — explicit sleep-disruption phrases, NOT generic tiredness.
    // Includes common misspellings ('unabel', 'unble', 'cant') so a single
    // typo does not silently drop the symptom.
    category: 'sleep',
    phrases: [
      'can\'t sleep', 'cannot sleep', 'cant sleep', 'insomnia', 'wake up at',
      'waking up at', '3am', '3 am', 'restless sleep', 'nightmare', 'bad dreams',
      'not sleeping', 'unable to sleep', 'unabel to sleep', 'unble to sleep',
      'not able to sleep', 'difficulty falling asleep', 'can\'t fall asleep',
      'early morning waking', 'sleep poorly', 'poor sleep', 'sleep problem',
      'sleep issue', 'trouble sleeping', 'difficulty sleeping', 'sleepless',
      'couldn\'t sleep', 'could not sleep', 'hard to sleep', 'tossing and turning',
      'didn\'t sleep', 'did not sleep', 'no sleep', 'keep waking up',
      'keep waking', 'awake all night', 'awake at night', 'lying awake',
      'lie awake', 'trouble falling asleep', 'staying asleep',
    ],
    defaultText: 'Sleep disturbance',
    defaultImpact: 'Affects energy and daytime functioning',
  },
  {
    // Anxiety / worry — anticipatory worry and physical arousal.
    // Fear-specific language is captured by the separate "Fear or dread" pattern.
    category: 'mood',
    phrases: [
      'racing heart', 'heart racing', 'panic', 'panicking', 'anxious', 'anxiety',
      'worried', 'worry', 'worrying', 'can\'t stop thinking', 'dread', 'overwhelming fear',
      'nervous', 'on edge', 'restless', 'what if', 'constantly worried', 'always worried',
      'something bad will happen', 'apprehensive',
    ],
    defaultText: 'Anxiety or worry',
    defaultImpact: 'Affects calm and concentration',
  },
  {
    // Fear / dread — distinct from general worry: acute fear of something happening.
    category: 'mood',
    phrases: [
      'fear', 'fearful', 'afraid', 'scared', 'frightened', 'terrified', 'terrifying',
      'fear of', 'in fear', 'feeling fearful', 'full of fear',
    ],
    defaultText: 'Fear or dread',
    defaultImpact: 'Affects sense of safety and calm',
  },
  {
    // Low mood / sadness / loss of interest (anhedonia-type language).
    // 'doing anything' catches common negations like "don't feel like doing
    // anything" (including typos such as "loke"); false-positive risk is low
    // in a wellbeing check-in context.
    category: 'mood',
    phrases: [
      'not happy', 'unhappy', 'not so happy', 'sad', 'down', 'low mood', 'feeling low',
      'hopeless', 'empty', 'numb', 'tearful', 'crying', 'can\'t enjoy', 'lost interest',
      'depressed', 'miserable', 'gloomy', 'melancholy', 'feeling blue', 'no point',
      'no joy', 'nothing matters', 'disconnected from myself', 'don\'t like anything',
      'don\'t feel like doing', 'do not feel like doing', 'don\'t want to do anything',
      'do not want to do anything', 'no interest', 'nothing interests me',
      'can\'t be bothered', 'nothing feels good', 'doing anything',
    ],
    defaultText: 'Low mood',
    defaultImpact: 'Affects motivation and enjoyment',
  },
  {
    // Energy / fatigue — includes tired, lethargic, exhausted, sleepy
    category: 'energy',
    phrases: [
      'tired', 'lethargic', 'lethargy', 'no energy', 'low energy', 'fatigue', 'fatigued',
      'exhausted', 'drained', 'burnt out', 'burnout', 'wiped out', 'no motivation',
      'sluggish', 'heavy', 'weary', 'worn out', 'running on empty', 'no stamina',
      'can\'t get going', 'dragging myself', 'sleepy', 'drowsy', 'feeling sleepy',
    ],
    defaultText: 'Low energy or fatigue',
    defaultImpact: 'Affects ability to engage with daily tasks',
  },
  {
    category: 'focus',
    phrases: [
      'can\'t focus', 'cannot focus', 'unable to focus', 'poor focus', 'poor concentration',
      'concentrate', 'distracted', 'brain fog', 'forgetful',
      'scattered', 'can\'t think', 'hard to focus', 'can\'t concentrate',
      'trouble focusing', 'trouble concentrating', 'difficulty focusing',
      'mind keeps wandering', 'unable to concentrate',
    ],
    defaultText: 'Difficulty concentrating',
    defaultImpact: 'Affects work or study performance',
  },
  {
    category: 'physical_tension',
    phrases: [
      'tension', 'headache', 'muscle pain', 'chest tight', 'tight chest',
      'stomach ache', 'nausea', 'jaw clenching', 'stiff shoulders', 'body aches',
      'physical stress', 'aching', 'pain in', 'giddy', 'dizzy', 'lightheaded',
      'feeling faint',
    ],
    defaultText: 'Physical tension or discomfort',
    defaultImpact: 'Affects physical comfort and relaxation',
  },
  {
    // Appetite / eating changes — tracked separately from physical tension.
    // 'appetit'/'apetit' stems intentionally catch common misspellings
    // (appetite, apetite, apetitite).
    category: 'other',
    phrases: [
      'appetit', 'apetit', 'not hungry', 'no hunger', 'lost my appetite',
      'eating less', 'eating more than usual', 'can\'t eat', 'hardly eating',
    ],
    defaultText: 'Appetite changes',
    defaultImpact: 'Affects energy and physical wellbeing',
  },
  {
    // Mobility / movement difficulty — includes misspelling stems ('unabel').
    category: 'other',
    phrases: [
      'can\'t walk', 'cant walk', 'cannot walk', 'unable to walk', 'unabel to walk',
      'not able to walk', 'difficulty walking', 'trouble walking', 'hard to walk',
      'can\'t move', 'cannot move', 'unable to move', 'limited mobility',
      'mobility issue', 'mobility problem', 'can\'t stand for long',
    ],
    defaultText: 'Mobility or movement difficulty',
    defaultImpact: 'Affects daily movement and independence',
  },
  {
    category: 'social',
    phrases: [
      'lonely', 'isolated', 'no one understands', 'feel alone', 'disconnected',
      'no friends', "don't belong", 'relationship problems', 'feel unseen',
    ],
    defaultText: 'Loneliness or disconnection',
    defaultImpact: 'Affects sense of belonging and support',
  },
  {
    category: 'work_stress',
    phrases: [
      'work stress', 'deadline', 'my boss', 'colleague', 'workload',
      'work is too much', 'job pressure', 'career stress', 'workplace',
    ],
    defaultText: 'Work-related stress',
    defaultImpact: 'Affects work performance and recovery time',
  },
];

function inferSeverity(text: string): SymptomSeverity {
  const lower = text.toLowerCase();
  const scores: Record<SymptomSeverity, number> = {
    mild: 0,
    moderate: 0,
    significant: 0,
    severe: 0,
  };

  for (const [severity, markers] of Object.entries(SEVERITY_MARKERS) as [SymptomSeverity, string[]][]) {
    for (const marker of markers) {
      if (lower.includes(marker)) scores[severity]++;
    }
  }

  const ranked = (Object.entries(scores) as [SymptomSeverity, number][])
    .sort((a, b) => b[1] - a[1]);

  // No explicit severity marker found — assume mild rather than moderate.
  // Neutral phrases like "tired" or "not so happy" do not imply moderate severity.
  return ranked[0][1] > 0 ? ranked[0][0] : 'mild';
}

function inferFrequency(text: string): SymptomFrequency {
  const lower = text.toLowerCase();
  const scores: Record<SymptomFrequency, number> = {
    occasionally: 0,
    weekly: 0,
    several_times_a_week: 0,
    daily: 0,
    constant: 0,
  };

  for (const [frequency, markers] of Object.entries(FREQUENCY_MARKERS) as [SymptomFrequency, string[]][]) {
    for (const marker of markers) {
      if (lower.includes(marker)) scores[frequency]++;
    }
  }

  const ranked = (Object.entries(scores) as [SymptomFrequency, number][])
    .sort((a, b) => b[1] - a[1]);

  return ranked[0][1] > 0 ? ranked[0][0] : 'occasionally';
}

function findMatchingPhrase(text: string, phrases: string[]): string | null {
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

function extractSnippet(text: string, phrase: string, window = 40): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(phrase.toLowerCase());
  if (index === -1) return text.slice(0, window * 2);
  const start = Math.max(0, index - window);
  const end = Math.min(text.length, index + phrase.length + window);
  return text.slice(start, end).trim();
}

/**
 * Infer symptom suggestions from a user message.
 * Returns sorted by confidence (highest first).
 */
export function inferSymptoms(message: string): InferredSymptom[] {
  const results: InferredSymptom[] = [];
  const seenTexts = new Set<string>();

  for (const pattern of SYMPTOM_PATTERNS) {
    const matchedPhrase = findMatchingPhrase(message, pattern.phrases);
    if (!matchedPhrase) continue;

    // Avoid duplicate symptom labels, but allow distinct symptoms within the
    // same category (e.g. "Anxiety or worry" and "Fear or dread" are both mood).
    if (seenTexts.has(pattern.defaultText)) continue;
    seenTexts.add(pattern.defaultText);

    const snippet = extractSnippet(message, matchedPhrase);
    // Score severity against the whole message, not just the local snippet,
    // so modifiers like "a little" or "very" are captured wherever they appear.
    const severity = inferSeverity(message);
    const frequency = inferFrequency(message);

    results.push({
      text: pattern.defaultText,
      category: pattern.category,
      severity,
      frequency,
      impact: pattern.defaultImpact,
      confidence: 0.7,
      sourcePhrase: snippet,
      userReported: false,
    });
  }

  // Keep pattern definition order — it is curated so the most salient symptom
  // (matching the user's actual words) appears first.
  return results;
}

/**
 * Apply a user-reported severity override while keeping the inference.
 */
export function applyUserSeverity(
  inferred: InferredSymptom,
  severity: SymptomSeverity,
): InferredSymptom {
  return { ...inferred, severity, userReported: true };
}

/**
 * Build a human-readable symptom text from the source phrase if possible.
 */
export function refineSymptomText(inferred: InferredSymptom): string {
  if (!inferred.sourcePhrase || inferred.sourcePhrase.length < 5) {
    return inferred.text;
  }
  // Use the snippet but clean it up.
  const cleaned = inferred.sourcePhrase
    .replace(/^[^a-zA-Z]+/, '')
    .replace(/[^a-zA-Z0-9\s.,;:!?]+$/, '')
    .trim();
  return cleaned.length > 5 ? cleaned : inferred.text;
}
