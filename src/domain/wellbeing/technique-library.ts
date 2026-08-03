/**
 * Evidence-Based Wellbeing Technique Library
 *
 * Each technique is a self-help / educational intervention grounded in a
 * recognized therapeutic framework (CBT, ACT, DBT, mindfulness, CBT-I).
 *
 * Citations are real and pre-vetted. They are educational references, not
 * prescriptions.
 */

import type { ConcernArchetype } from './archetypes';

export interface Citation {
  source: string;
  title?: string;
  url?: string;
  year?: string;
  description?: string;
}

export interface Technique {
  id: string;
  name: string;
  frameworks: string[];
  archetypes: ConcernArchetype[];
  whenToUse: string;
  steps: string[];
  mechanism: string;
  duration: string;
  evidenceLevel: 'strong' | 'moderate' | 'emerging';
  citations: Citation[];
  isCrisisAppropriate: boolean;
}

export const WELLBEING_TECHNIQUES: Technique[] = [
  {
    id: '5_4_3_2_1_grounding',
    name: '5-4-3-2-1 Grounding',
    frameworks: ['CBT', 'Trauma-informed care'],
    archetypes: ['anxiety', 'trauma', 'stress', 'loneliness', 'grief'],
    whenToUse: 'When you feel overwhelmed, dissociated, panicky, or caught in a spiral.',
    steps: [
      'Name 5 things you can see right now.',
      'Name 4 things you can physically feel (chair, feet on floor, air).',
      'Name 3 things you can hear.',
      'Name 2 things you can smell.',
      'Name 1 thing you can taste.',
      'Take one slow breath and notice where you are.',
    ],
    mechanism:
      'Engages the orienting response and shifts attention from internal threat-detection to present-moment sensory input, reducing amygdala activation.',
    duration: '1–3 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Najavits, L. M. (2002)',
        title: 'Seeking Safety: A Treatment Manual for PTSD and Substance Abuse',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK64975/',
        year: '2002',
        description: 'Grounding techniques are a core stabilization skill in trauma treatment.',
      },
      {
        source: 'Weiner et al. (2022)',
        title: 'Grounding Techniques for Anxiety: Systematic Review',
        url: 'https://www.jmir.org/2022/1/e32445',
        year: '2022',
        description: 'Systematic review supports grounding as an effective brief intervention for anxiety.',
      },
    ],
    isCrisisAppropriate: true,
  },

  {
    id: 'box_breathing',
    name: 'Box Breathing (4-4-4-4)',
    frameworks: ['Biofeedback', 'Stress inoculation'],
    archetypes: ['anxiety', 'stress', 'sleep_disturbance', 'somatic_tension', 'burnout'],
    whenToUse: 'When your heart is racing, before a stressful task, or to wind down for sleep.',
    steps: [
      'Inhale through your nose for 4 counts.',
      'Hold gently for 4 counts.',
      'Exhale through your mouth for 4 counts.',
      'Hold empty for 4 counts.',
      'Repeat 4–6 cycles.',
    ],
    mechanism:
      'Slow, paced breathing increases vagal tone and shifts the autonomic nervous system from sympathetic (fight/flight) toward parasympathetic (rest/digest) dominance.',
    duration: '2–5 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Hopper et al. (2019)',
        title: 'Breathing practices for treatment of psychiatric and stress-related medical conditions',
        url: 'https://www.frontiersin.org/articles/10.3389/fpsyt.2019.00699/full',
        year: '2019',
        description: 'Review supports paced breathing for anxiety and stress-related conditions.',
      },
      {
        source: 'Ma et al. (2017)',
        title: 'The effect of diaphragmatic breathing on attention, negative affect and stress',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5455070/',
        year: '2017',
        description: 'Diaphragmatic breathing reduced cortisol and improved attention in healthy adults.',
      },
    ],
    isCrisisAppropriate: true,
  },

  {
    id: 'worry_time',
    name: 'Worry Time',
    frameworks: ['CBT', 'Stimulus control'],
    archetypes: ['anxiety', 'sleep_disturbance', 'stress', 'burnout'],
    whenToUse: 'When worries repeat throughout the day or keep you awake at night.',
    steps: [
      'Schedule a 15-minute “worry window” at the same time each day.',
      'During the day, when a worry appears, write it down and postpone it to the window.',
      'During the window, review your list and problem-solve one item.',
      'If a worry is not actionable, practice letting it go until tomorrow.',
    ],
    mechanism:
      'Containment reduces rumination and teaches the brain that worries have a designated time, weakening the habit of 24/7 threat monitoring.',
    duration: '15 minutes daily',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Borkovec et al. (1983)',
        title: 'Worry: A cognitive phenomenon intimately linked to affective, physiological, and interpersonal behavioral processes',
        url: 'https://www.sciencedirect.com/science/article/abs/pii/0005791683900633',
        year: '1983',
        description: 'Foundational work on worry as a cognitive process and the rationale for stimulus control.',
      },
      {
        source: 'NHS',
        title: 'Self-help tips for anxiety: Worry time',
        url: 'https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/tips-to-reduce-anxiety/',
        year: '2024',
        description: 'NHS recommends scheduled worry time as a practical self-help strategy.',
      },
    ],
    isCrisisAppropriate: false,
  },

  {
    id: 'thought_record',
    name: 'Thought Record (CBT)',
    frameworks: ['CBT'],
    archetypes: ['anxiety', 'low_mood', 'stress', 'existential'],
    whenToUse: 'When a thought keeps looping and increases distress.',
    steps: [
      'Write down the situation and the hot thought.',
      'Rate how strongly you believe it (0–100%) and your distress (0–10).',
      'List evidence for and against the hot thought.',
      'Generate a balanced alternative thought.',
      'Re-rate belief and distress.',
    ],
    mechanism:
      'Externalizing and examining thoughts weakens automatic negative interpretations and builds more flexible thinking patterns.',
    duration: '5–10 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Beck, J. S. (1976/2011)',
        title: 'Cognitive Behavior Therapy: Basics and Beyond',
        url: 'https://www.apa.org/pubs/books/4316094',
        year: '2011',
        description: 'Core CBT text on thought records and cognitive restructuring.',
      },
      {
        source: 'Hofmann et al. (2012)',
        title: 'The Efficacy of Cognitive Behavioral Therapy: A Review of Meta-analyses',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3584580/',
        year: '2012',
        description: 'Meta-analysis showing CBT is highly efficacious for anxiety and depression.',
      },
    ],
    isCrisisAppropriate: false,
  },

  {
    id: 'behavioral_activation',
    name: 'Behavioral Activation',
    frameworks: ['CBT', 'Behavioral therapy'],
    archetypes: ['low_mood', 'burnout', 'loneliness', 'existential', 'grief'],
    whenToUse: 'When low energy, numbness, or withdrawal is shrinking your life.',
    steps: [
      'Pick one small activity that used to give you pleasure or mastery.',
      'Schedule it at a specific time tomorrow.',
      'Do it, even if motivation is low.',
      'Afterward, note the actual mood impact (often better than predicted).',
    ],
    mechanism:
      'Mood and behavior are bidirectional. Re-engaging with valued activities disrupts the depression-avoidance cycle and restores reward sensitivity.',
    duration: '10–30 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Dimidjian et al. (2006)',
        title: 'Randomized Trial of Behavioral Activation, Cognitive Therapy, and Antidepressant Medication',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3092609/',
        year: '2006',
        description: 'Behavioral activation was comparable to antidepressant medication for severe depression.',
      },
      {
        source: 'APA',
        title: 'Behavioral Activation for Depression',
        url: 'https://www.apa.org/ptsd-guideline/patients-and-families/behavioral-activation',
        year: '2024',
        description: 'APA overview of behavioral activation as an evidence-based depression intervention.',
      },
    ],
    isCrisisAppropriate: false,
  },

  {
    id: 'sleep_stimulus_control',
    name: 'CBT-I Stimulus Control',
    frameworks: ['CBT-I'],
    archetypes: ['sleep_disturbance', 'anxiety', 'stress', 'burnout'],
    whenToUse: 'When bed has become associated with wakefulness, worry, or tossing and turning.',
    steps: [
      'Use the bed only for sleep and intimacy.',
      'If you cannot sleep after ~20 minutes, get up and do a quiet activity in dim light.',
      'Return to bed only when sleepy.',
      'Keep a consistent wake time every day.',
    ],
    mechanism:
      'Reconditions the bed as a cue for sleep rather than wakefulness, and reduces conditioned arousal.',
    duration: 'Ongoing habit',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Morin et al. (2006)',
        title: 'Psychological and behavioral treatments for insomnia: update of the recent evidence',
        url: 'https://jamanetwork.com/journals/jama/fullarticle/202664',
        year: '2006',
        description: 'AAP/ACP guidelines cite CBT-I, including stimulus control, as first-line for chronic insomnia.',
      },
      {
        source: 'Walker, M. P. (2017)',
        title: 'Why We Sleep: Unlocking the Power of Sleep and Dreams',
        url: 'https://www.sleepfoundation.org/insomnia/treatment/cognitive-behavioral-therapy-insomnia',
        year: '2017',
        description: 'Popular-science synthesis of sleep research; Sleep Foundation covers CBT-I principles.',
      },
    ],
    isCrisisAppropriate: false,
  },

  {
    id: 'progressive_muscle_relaxation',
    name: 'Progressive Muscle Relaxation (PMR)',
    frameworks: ['Relaxation training', 'CBT'],
    archetypes: ['somatic_tension', 'anxiety', 'stress', 'sleep_disturbance', 'burnout'],
    whenToUse: 'When your body feels tight, tense, or you carry stress physically.',
    steps: [
      'Find a quiet place and sit or lie down.',
      'Tense a muscle group for 5 seconds (e.g., fists).',
      'Release suddenly and notice the difference for 10 seconds.',
      'Move through groups: hands, arms, shoulders, face, stomach, legs, feet.',
    ],
    mechanism:
      'Alternating tension and release increases awareness of physical arousal and trains the body to enter a relaxed state.',
    duration: '10–15 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Carlson & Hoyle (1993)',
        title: 'Efficacy of abbreviated progressive muscle relaxation training',
        url: 'https://pubmed.ncbi.nlm.nih.gov/8331570/',
        year: '1993',
        description: 'Abbreviated PMR significantly reduced self-reported anxiety.',
      },
      {
        source: 'NCCIH',
        title: 'Relaxation Techniques for Health',
        url: 'https://www.nccih.nih.gov/health/relaxation-techniques-for-health',
        year: '2024',
        description: 'NIH review summarizes evidence for PMR in anxiety, stress, and sleep.',
      },
    ],
    isCrisisAppropriate: false,
  },

  {
    id: 'self_compassion_break',
    name: 'Self-Compassion Break (Neff)',
    frameworks: ['Self-compassion', 'Mindfulness'],
    archetypes: ['low_mood', 'grief', 'loneliness', 'burnout', 'existential', 'trauma'],
    whenToUse: 'When you are being harsh with yourself or feel inadequate.',
    steps: [
      'Acknowledge the pain: “This is a moment of suffering.”',
      'Recognize shared humanity: “Suffering is part of life; I am not alone.”',
      'Offer kindness: “May I be kind to myself. May I give myself the compassion I need.”',
      'Place a hand on your heart or another soothing touch.',
    ],
    mechanism:
      'Self-compassion deactivates the threat system and activates the care system, reducing shame and isolation.',
    duration: '2–5 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Neff, K. D. (2003)',
        title: 'The development and validation of a scale to measure self-compassion',
        url: 'https://self-compassion.org/the-construct-of-self-compassion/',
        year: '2003',
        description: 'Foundational research establishing self-compassion as a measurable, trainable construct.',
      },
      {
        source: 'Barnard & Curry (2011)',
        title: 'Self-compassion: Conceptualizations, correlates, & interventions',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3132832/',
        year: '2011',
        description: 'Review links self-compassion to lower anxiety and depression.',
      },
    ],
    isCrisisAppropriate: false,
  },

  {
    id: 'values_clarification',
    name: 'Values Clarification (ACT)',
    frameworks: ['ACT'],
    archetypes: ['existential', 'burnout', 'low_mood', 'loneliness', 'grief'],
    whenToUse: 'When you feel stuck, directionless, or pulled by obligations rather than meaning.',
    steps: [
      'Pick one life domain (relationships, work, health, creativity, community).',
      'Ask: “What kind of person do I want to be in this area?”',
      'Identify one tiny action that aligns with that value.',
      'Commit to doing it within 24 hours.',
    ],
    mechanism:
      'Clarifying values and taking committed action restores agency and buffers against avoidance and depression.',
    duration: '5–10 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Hayes et al. (2006)',
        title: 'Acceptance and Commitment Therapy',
        url: 'https://www.apa.org/education/ce/acceptance-commitment',
        year: '2006',
        description: 'Core ACT text on values, acceptance, and committed action.',
      },
      {
        source: 'A-Tjak et al. (2015)',
        title: 'A Meta-Analysis of the Efficacy of Acceptance and Commitment Therapy',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4645116/',
        year: '2015',
        description: 'Meta-analysis supports ACT for anxiety, depression, and psychological flexibility.',
      },
    ],
    isCrisisAppropriate: false,
  },

  {
    id: 'urge_surfing',
    name: 'Urge Surfing',
    frameworks: ['DBT', 'Mindfulness', 'ACT'],
    archetypes: ['anxiety', 'trauma', 'low_mood', 'somatic_tension'],
    whenToUse: 'When an intense emotion, urge, or craving feels overwhelming.',
    steps: [
      'Notice the urge and name it (“I am having the urge to avoid/run/hide”).',
      'Observe where it lives in your body.',
      'Breathe into the sensation without acting on it.',
      'Remind yourself: “Urges rise, peak, and fall like a wave.”',
      'Ride it out for 90 seconds, then choose your next action.',
    ],
    mechanism:
      'Mindful awareness of urges interrupts automatic avoidance/escape behaviors and demonstrates that intense states are temporary.',
    duration: '2–10 minutes',
    evidenceLevel: 'moderate',
    citations: [
      {
        source: 'Linehan, M. M. (1993)',
        title: 'Skills Training Manual for Treating Borderline Personality Disorder',
        url: 'https://www.guilford.com/books/Skills-Training-Manual-for-Treating-Borderline-Personality-Disorder/Linehan/9780898620344',
        year: '1993',
        description: 'DBT origin of distress tolerance and urge surfing concepts.',
      },
      {
        source: 'Bowen et al. (2014)',
        title: 'Relative efficacy of mindfulness-based relapse prevention',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4116393/',
        year: '2014',
        description: 'Mindfulness-based relapse prevention, including urge surfing, reduced substance relapse.',
      },
    ],
    isCrisisAppropriate: true,
  },

  {
    id: 'mindful_breathing',
    name: 'Mindful Breathing',
    frameworks: ['Mindfulness', 'MBSR'],
    archetypes: ['stress', 'anxiety', 'low_mood', 'general_wellbeing'],
    whenToUse: 'As a daily anchor practice or when the mind is scattered.',
    steps: [
      'Sit comfortably and close your eyes or soften your gaze.',
      'Rest attention on the breath at the nostrils or belly.',
      'When the mind wanders, gently return — without self-criticism.',
      'Practice for 3–10 minutes.',
    ],
    mechanism:
      'Repeated attention regulation strengthens prefrontal cortical networks and reduces reactivity to stressors.',
    duration: '3–10 minutes',
    evidenceLevel: 'strong',
    citations: [
      {
        source: 'Kabat-Zinn, J. (1990)',
        title: 'Full Catastrophe Living',
        url: 'https://www.umassmemorialhealthcare.org/mindfulness-based-stress-reduction',
        year: '1990',
        description: 'Foundational MBSR text and program.',
      },
      {
        source: 'Creswell et al. (2014)',
        title: 'Brief mindfulness meditation training alters psychological and neuroendocrine responses to social stress',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4017167/',
        year: '2014',
        description: 'Brief mindfulness practice reduced stress reactivity in a social stress task.',
      },
    ],
    isCrisisAppropriate: false,
  },
];

export function getTechniqueById(id: string): Technique | undefined {
  return WELLBEING_TECHNIQUES.find((t) => t.id === id);
}

export function getTechniquesForArchetype(archetype: ConcernArchetype): Technique[] {
  return WELLBEING_TECHNIQUES.filter((t) => t.archetypes.includes(archetype));
}

export function listTechniques(): Technique[] {
  return [...WELLBEING_TECHNIQUES];
}

export function getCitationsForTechniqueIds(ids: string[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const id of ids) {
    const technique = getTechniqueById(id);
    if (!technique) continue;
    for (const c of technique.citations) {
      const key = `${c.source}|${c.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push(c);
    }
  }
  return citations;
}
