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
    category: 'sleep',
    phrases: [
      'can\'t sleep', 'insomnia', 'wake up', 'waking up', '3am', '3 am',
      'restless sleep', 'nightmare', 'bad dreams', 'tired', 'exhausted',
      'not sleeping', 'difficulty falling asleep', 'early morning',
    ],
    defaultText: 'Sleep disturbance',
    defaultImpact: 'Affects energy and daytime functioning',
  },
  {
    category: 'mood',
    phrases: [
      'racing heart', 'heart racing', 'panic', 'anxious', 'worried',
      'can\'t stop thinking', 'dread', 'terrified', 'nervous', 'on edge',
      'restless', 'overwhelming fear', 'what if',
    ],
    defaultText: 'Anxiety or worry',
    defaultImpact: 'Affects calm and concentration',
  },
  {
    category: 'mood',
    phrases: [
      'sad', 'down', 'low mood', 'hopeless', 'empty', 'numb', 'tearful',
      'crying', 'can\'t enjoy', 'lost interest', 'depressed',
    ],
    defaultText: 'Low mood',
    defaultImpact: 'Affects motivation and enjoyment',
  },
  {
    category: 'energy',
    phrases: [
      'no energy', 'fatigue', 'exhausted', 'drained', 'lethargic', 'burnt out',
      'burnout', 'wiped out', 'no motivation',
    ],
    defaultText: 'Low energy or fatigue',
    defaultImpact: 'Affects ability to engage with daily tasks',
  },
  {
    category: 'focus',
    phrases: [
      'can\'t focus', 'cannot focus', 'poor focus', 'poor concentration',
      'concentrate', 'distracted', 'brain fog', 'forgetful',
      'scattered', 'can\'t think', 'memory', 'hard to focus',
      'trouble focusing', 'trouble concentrating', 'difficulty focusing',
    ],
    defaultText: 'Difficulty concentrating',
    defaultImpact: 'Affects work or study performance',
  },
  {
    category: 'physical_tension',
    phrases: [
      'tension', 'headache', 'muscle pain', 'chest tight', 'tight chest',
      'stomach', 'nausea', 'jaw clenching', 'shoulders', 'body aches',
      'physical stress',
    ],
    defaultText: 'Physical tension or discomfort',
    defaultImpact: 'Affects physical comfort and relaxation',
  },
  {
    category: 'social',
    phrases: [
      'lonely', 'isolated', 'no one understands', 'alone', 'disconnected',
      'no friends', 'don\'t belong', 'relationship problems',
    ],
    defaultText: 'Loneliness or disconnection',
    defaultImpact: 'Affects sense of belonging and support',
  },
  {
    category: 'work_stress',
    phrases: [
      'work stress', 'deadline', 'boss', 'colleague', 'workload',
      'work is too much', 'job pressure', 'career', 'workplace',
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

  return ranked[0][1] > 0 ? ranked[0][0] : 'moderate';
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
  const seenCategories = new Set<SymptomCategory>();

  for (const pattern of SYMPTOM_PATTERNS) {
    const matchedPhrase = findMatchingPhrase(message, pattern.phrases);
    if (!matchedPhrase) continue;

    // Avoid duplicate categories; keep the first/best match.
    if (seenCategories.has(pattern.category)) continue;
    seenCategories.add(pattern.category);

    const snippet = extractSnippet(message, matchedPhrase);
    const severity = inferSeverity(snippet);
    const frequency = inferFrequency(snippet);

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

  return results.sort((a, b) => b.confidence - a.confidence);
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
