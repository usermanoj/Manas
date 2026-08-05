/**
 * Clinician-authored care-plan guidance presented on the user's Care Plan page.
 *
 * This content is authored as if written by the caring professional to the
 * patient — warm, specific, and actionable. It is demonstration content for
 * the Manas prototype; the page footer carries the prototype disclaimer.
 */

export interface GoalGuidance {
  /** Keyword match against the stored goal title (case-insensitive). */
  match: RegExp;
  /** Illustration shown on the goal card. */
  image: string;
  alt: string;
  /** Why this goal matters — one professional paragraph. */
  why: string;
  /** Concrete practices for this week. */
  practices: string[];
  /** A short encouraging note to close the card. */
  tip: string;
}

export interface ResourceLink {
  title: string;
  org: string;
  description: string;
  url: string;
  tag: string;
}

/** Opening note from the clinician, rendered as a personal letter. */
export const CLINICIAN_NOTE = {
  greeting: 'Dear Manoj,',
  paragraphs: [
    'Thank you for trusting me with your check-in. I have read your summary carefully. What you describe — months of anxiety, restlessness and exhaustion — is a very understandable response to sustained work pressure. It is not a weakness, and it is not something you have to push through alone.',
    'I have designed this plan around two goals: first, understanding the patterns behind your anxiety and restlessness, and second, rebuilding your energy steadily rather than in bursts. Both are fully achievable with small, consistent steps — which is exactly what we will practise together over the coming weeks.',
    'Please treat this plan as a gentle structure, not another demand on your energy. Some weeks will be easier than others; what matters is that we keep reviewing honestly at each check-in.',
  ],
  closing: 'With warmth and encouragement,',
};

/** Per-goal guidance, matched to the stored goal titles. */
export const GOAL_GUIDANCE: GoalGuidance[] = [
  {
    match: /anxiety|restless/i,
    image: '/images/care-plan/goal-awareness.png',
    alt: 'A person journaling peacefully by a window in morning light',
    why: 'Anxiety and restlessness often run ahead of our awareness — by the time we notice them, they have already shaped the whole day. Learning to catch them early, and to see what triggers them, is the single most effective first step. Patterns that are visible can be worked with; patterns that stay hidden tend to grow.',
    practices: [
      'Morning check-in (2 minutes): before opening work messages, rate your restlessness from 1–5 and note one word for how your body feels.',
      'Pattern log: at the end of each day, note the one moment restlessness peaked — the time, what was happening, and what your body signalled first.',
      'Evening two-line journal: write one line about what drained you today and one line about what steadied you, even slightly.',
    ],
    tip: 'We are building awareness, not judgement. Every pattern you notice is progress — bring them to our follow-up and we will work with them together.',
  },
  {
    match: /energy|exhaust|tired|fatigue/i,
    image: '/images/care-plan/goal-energy.png',
    alt: 'A person walking on a tree-lined path in golden afternoon light',
    why: 'Exhaustion that has built up over months does not lift in one good weekend. Energy returns through small, repeatable acts of recovery — consistent sleep timing, real breaks, and gentle movement. The aim is a steady upward slope, not sudden bursts followed by crashes.',
    practices: [
      'Anchor your wake time: rise within the same 30-minute window every day — this alone steadies your sleep drive more than sleeping in.',
      'Two 10-minute movement breaks daily: a short walk or light stretching, ideally outdoors or near daylight.',
      'Protect the last hour: stop caffeine after mid-afternoon and keep the final hour before sleep screen-light and work-free.',
    ],
    tip: 'Choose the one practice that feels easiest and do it daily this week. Consistency with one habit beats ambition with three.',
  },
];

/** Fallback guidance when a goal title matches no curated card. */
export const GENERIC_GOAL_GUIDANCE: Pick<GoalGuidance, 'why' | 'practices' | 'tip'> = {
  why: 'This goal gives our work a clear direction. We will take it one small step at a time and review progress together at every check-in.',
  practices: [
    'Identify one small action that moves this goal forward and schedule it this week.',
    'Note what helped and what got in the way at your next check-in.',
  ],
  tip: 'Small consistent steps compound. I will be reviewing your progress personally.',
};

/** Weekly rhythm summary shown alongside the check-in frequency. */
export const WEEKLY_RHYTHM = {
  heading: 'Your rhythm this week',
  items: [
    { icon: '🗓️', text: 'Two check-ins with Manas — honest reflections, no preparation needed.' },
    { icon: '🌿', text: 'Three Pause & Reflect grounding sessions, 10 minutes each.' },
    { icon: '📓', text: 'Daily micro-practices from your goal cards below — two minutes is enough.' },
    { icon: '👩‍⚕️', text: 'I personally review your progress each week and will adjust this plan as needed.' },
  ],
};

/** Curated professional resources shared with the patient. */
export const RESOURCES: ResourceLink[] = [
  {
    title: 'Doing What Matters in Times of Stress',
    org: 'World Health Organization',
    description: 'A practical WHO companion guide for managing stress, with grounding exercises you can use in minutes.',
    url: 'https://www.who.int/publications/i/item/9789240003927',
    tag: 'Guide',
  },
  {
    title: 'Every Mind Matters',
    org: 'UK National Health Service',
    description: 'NHS expert advice on sleep, anxiety and building a personal mental wellbeing plan.',
    url: 'https://www.nhs.uk/every-mind-matters/',
    tag: 'Advice',
  },
  {
    title: 'Stress Management Basics',
    org: 'Mayo Clinic',
    description: 'Evidence-based techniques to recognise stress triggers and build durable coping habits.',
    url: 'https://www.mayoclinic.org/healthy-lifestyle/stress-management/in-depth/stress-relief/art-20044476',
    tag: 'Article',
  },
  {
    title: 'Stress: How It Affects You',
    org: 'American Psychological Association',
    description: 'Understanding the physical and emotional signals of prolonged stress — useful alongside your pattern log.',
    url: 'https://www.apa.org/topics/stress',
    tag: 'Reading',
  },
];

/** How-we-work-together boundaries, phrased as professional commitments. */
export const CARE_BOUNDARIES_HEADING = 'How we will work together';

/** Resolve curated guidance for a stored goal title. */
export function guidanceForGoal(goal: string): GoalGuidance | null {
  return GOAL_GUIDANCE.find((g) => g.match.test(goal)) ?? null;
}
