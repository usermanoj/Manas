/**
 * Concern Archetype Taxonomy
 *
 * A clinically-informed, non-diagnostic framework for classifying what the user
 * is experiencing. Each archetype defines how Manas should respond: which
 * techniques to suggest, what to validate, and which follow-up questions are
 * most useful.
 *
 * These are wellbeing descriptors, not diagnostic labels.
 */

export type ConcernArchetype =
  | 'stress'
  | 'anxiety'
  | 'low_mood'
  | 'burnout'
  | 'sleep_disturbance'
  | 'grief'
  | 'loneliness'
  | 'trauma'
  | 'somatic_tension'
  | 'existential'
  | 'general_wellbeing';

export interface ArchetypeDefinition {
  id: ConcernArchetype;
  label: string;
  description: string;
  indicators: string[];
  responseStrategy: string;
  suggestedTechniqueIds: string[];
  followUpQuestions: string[];
  safetyConsiderations: string[];
}

export const CONCERN_ARCHETYPES: Record<ConcernArchetype, ArchetypeDefinition> = {
  stress: {
    id: 'stress',
    label: 'Stress or overwhelm',
    description: 'Feeling pressed by demands, deadlines, responsibilities, or uncertainty.',
    indicators: [
      'stress', 'overwhelmed', 'too much', 'can\'t keep up', 'pressure', 'deadline',
      'racing thoughts', 'on edge', 'tense', 'burdened',
    ],
    responseStrategy:
      'Validate the overload, help them name what is within vs outside their control, and offer a fast physiological regulation technique plus a prioritization framework.',
    suggestedTechniqueIds: ['box_breathing', '5_4_3_2_1_grounding', 'worry_time', 'values_clarification'],
    followUpQuestions: [
      'What is the main thing pressing on you right now?',
      'How long have you been feeling this level of pressure?',
      'Where do you feel it most in your body?',
    ],
    safetyConsiderations: ['High stress can mask crisis; scan for hopelessness or self-harm language.'],
  },

  anxiety: {
    id: 'anxiety',
    label: 'Anxiety or worry',
    description: 'Persistent worry, anticipatory dread, physical arousal, or fear of something bad happening.',
    indicators: [
      'anxious', 'anxiety', 'worried', 'worry', 'worrying', 'nervous', 'panic', 'panicking',
      'racing heart', 'heart races', 'heart racing', 'pounding heart', 'can\'t stop thinking',
      'cannot stop thinking', 'cannot stop worrying', 'dread', 'terrified', 'terrifying',
      'fear', 'afraid', 'scared', 'what if', 'restless', 'on edge', 'overwhelming fear',
    ],
    responseStrategy:
      'Normalize anxiety as a threat-response, offer grounding to reduce arousal, and introduce cognitive or behavioral tools based on severity.',
    suggestedTechniqueIds: ['5_4_3_2_1_grounding', 'box_breathing', 'cognitive_restructuring', 'worry_time', 'urge_surfing'],
    followUpQuestions: [
      'What are you most afraid might happen?',
      'Do you notice this more in your body, your thoughts, or both?',
      'When did this worry pattern start?',
    ],
    safetyConsiderations: ['Distinguish distress from panic disorder or trauma; escalate if severe impairment or self-harm mentioned.'],
  },

  low_mood: {
    id: 'low_mood',
    label: 'Low mood or emptiness',
    description: 'Feeling down, numb, hopeless, or having lost interest in things that used to matter.',
    indicators: [
      'sad', 'down', 'empty', 'numb', 'hopeless', 'no point', 'not interested',
      'anhedonia', 'tearful', 'crying', 'low', 'depressed', 'can\'t enjoy',
    ],
    responseStrategy:
      'Respond with warmth and patience; avoid toxic positivity. Offer behavioral activation and values-based action, and assess duration/severity.',
    suggestedTechniqueIds: ['behavioral_activation', 'self_compassion_break', 'values_clarification', 'thought_record'],
    followUpQuestions: [
      'How long have you been feeling this way?',
      'Is there anything that still gives you a small sense of meaning or pleasure?',
      'How is your sleep and appetite?',
    ],
    safetyConsiderations: ['Mandatory suicide/self-harm screening if hopelessness or worthlessness is present.'],
  },

  burnout: {
    id: 'burnout',
    label: 'Burnout or exhaustion',
    description: 'Long-term depletion from chronic workplace or caregiving demands; cynicism and reduced efficacy.',
    indicators: [
      'burnout', 'burned out', 'burnt out', 'exhausted', 'drained', 'cynical', 'detached',
      'can\'t recover', 'no energy', 'no energy left', 'hollow', 'empty', 'work is too much',
      'caregiving', 'compassion fatigue',
    ],
    responseStrategy:
      'Name burnout as a signal, not a personal failing. Focus on recovery, boundaries, and sustainable energy management rather than productivity hacks.',
    suggestedTechniqueIds: ['behavioral_activation', 'values_clarification', 'progressive_muscle_relaxation', 'self_compassion_break'],
    followUpQuestions: [
      'What part of your life is taking the most from you right now?',
      'When did you last feel genuinely rested?',
      'What would it look like to protect even a small boundary?',
    ],
    safetyConsiderations: ['Burnout can co-occur with depression; monitor for hopelessness.'],
  },

  sleep_disturbance: {
    id: 'sleep_disturbance',
    label: 'Sleep disturbance',
    description: 'Difficulty falling asleep, staying asleep, early waking, or non-restorative sleep.',
    indicators: [
      'can\'t sleep', 'insomnia', 'wake up', '3am', 'tired', 'exhausted',
      'nightmare', 'restless', 'racing thoughts at night', 'sleep',
    ],
    responseStrategy:
      'Validate the impact of poor sleep, offer CBT-I principles (stimulus control, sleep hygiene, worry time), and avoid recommending sedatives.',
    suggestedTechniqueIds: ['sleep_stimulus_control', 'worry_time', 'box_breathing', 'progressive_muscle_relaxation'],
    followUpQuestions: [
      'Is it harder to fall asleep, stay asleep, or wake too early?',
      'How many nights a week is this happening?',
      'What tends to be on your mind when you wake?',
    ],
    safetyConsiderations: ['Chronic insomnia increases accident risk and mood deterioration; assess daytime impairment.'],
  },

  grief: {
    id: 'grief',
    label: 'Grief or loss',
    description: 'Reaction to the death of a loved one, a lost relationship, role, dream, or identity.',
    indicators: [
      'grief', 'loss', 'miss them', 'died', 'passed away', 'breakup', 'divorce',
      'mourning', 'empty without', 'can\'t believe they\'re gone',
    ],
    responseStrategy:
      'Hold space without rushing toward solutions. Normalize grief as non-linear, offer gentle coping rituals, and suggest connection or professional support.',
    suggestedTechniqueIds: ['self_compassion_break', 'values_clarification', '5_4_3_2_1_grounding', 'behavioral_activation'],
    followUpQuestions: [
      'Who or what have you lost?',
      'What has been hardest about this today?',
      'Do you have someone you can talk to about this?',
    ],
    safetyConsiderations: ['Grief can include intense suicidal ideation; screen carefully without being intrusive.'],
  },

  loneliness: {
    id: 'loneliness',
    label: 'Loneliness or disconnection',
    description: 'Feeling misunderstood, isolated, or lacking meaningful connection.',
    indicators: [
      'lonely', 'isolated', 'no one understands', 'alone', 'disconnected',
      'no friends', 'don\'t belong', 'abandoned', 'ignored',
    ],
    responseStrategy:
      'Validate loneliness as a real signal of unmet connection needs. Offer small, structured steps toward connection and self-compassion.',
    suggestedTechniqueIds: ['values_clarification', 'self_compassion_break', 'behavioral_activation', '5_4_3_2_1_grounding'],
    followUpQuestions: [
      'Is this loneliness more about quantity of people, quality of connection, or both?',
      'When was the last time you felt truly seen by someone?',
      'What is one small way you might reach out this week?',
    ],
    safetyConsiderations: ['Loneliness is a risk factor for depression and self-harm; assess hopelessness.'],
  },

  trauma: {
    id: 'trauma',
    label: 'Trauma or intrusive memories',
    description: 'Re-experiencing, hypervigilance, or emotional flooding related to past adverse events.',
    indicators: [
      'trauma', 'ptsd', 'flashback', 'nightmare', 'intrusive', 'can\'t stop replaying',
      'on guard', 'hypervigilant', 'triggered', 'adverse childhood',
    ],
    responseStrategy:
      'Respond slowly and safely. Offer grounding techniques to restore the window of tolerance. Strongly encourage professional support without being coercive.',
    suggestedTechniqueIds: ['5_4_3_2_1_grounding', 'box_breathing', 'progressive_muscle_relaxation', 'self_compassion_break'],
    followUpQuestions: [
      'Are you safe right now?',
      'What helps you feel a little more grounded when memories surface?',
      'Do you have a therapist or counselor you trust?',
    ],
    safetyConsiderations: ['Trauma content can be destabilizing; avoid detailed disclosure; prioritize stabilization and referral.'],
  },

  somatic_tension: {
    id: 'somatic_tension',
    label: 'Physical tension or somatic stress',
    description: 'Body-based symptoms such as headaches, muscle tension, chest tightness, or stomach issues linked to stress.',
    indicators: [
      'tension', 'headache', 'muscle pain', 'chest tight', 'stomach', 'nausea',
      'jaw clenching', 'shoulders', 'body aches', 'physically stressed',
    ],
    responseStrategy:
      'Acknowledge the mind-body link, suggest somatic regulation, and recommend medical evaluation if symptoms are new or severe.',
    suggestedTechniqueIds: ['progressive_muscle_relaxation', 'box_breathing', '5_4_3_2_1_grounding', 'self_compassion_break'],
    followUpQuestions: [
      'Where in your body do you feel this most?',
      'Have you had a medical check-up for these symptoms?',
      'Do the symptoms flare with particular situations or thoughts?',
    ],
    safetyConsiderations: ['New severe physical symptoms (chest pain, neurological changes) require medical referral, not just self-help.'],
  },

  existential: {
    id: 'existential',
    label: 'Purpose, meaning, or life direction',
    description: 'Questioning one’s values, direction, identity, or place in the world.',
    indicators: [
      'purpose', 'meaningless', 'stuck', 'don\'t know who i am', 'lost',
      'direction', 'what\'s the point', 'identity', 'transition', 'quarter life',
    ],
    responseStrategy:
      'Use ACT-style values clarification. Avoid quick-fix answers; help the user identify one small value-aligned action.',
    suggestedTechniqueIds: ['values_clarification', 'behavioral_activation', 'self_compassion_break', 'thought_record'],
    followUpQuestions: [
      'What matters to you when life feels hardest?',
      'If you could move one small step toward who you want to be, what would it be?',
      'Is this tied to a specific life transition?',
    ],
    safetyConsiderations: ['Existential distress can coexist with depression; monitor for hopelessness.'],
  },

  general_wellbeing: {
    id: 'general_wellbeing',
    label: 'General wellbeing check-in',
    description: 'User is doing okay and wants to maintain or reflect on wellbeing.',
    indicators: [],
    responseStrategy:
      'Celebrate the check-in, offer a brief reflection prompt, and suggest a preventive technique.',
    suggestedTechniqueIds: ['box_breathing', 'values_clarification', 'self_compassion_break'],
    followUpQuestions: [
      'What has been going well lately?',
      'Is there anything you\'d like to keep building on?',
      'How is your sleep, mood, and energy overall?',
    ],
    safetyConsiderations: ['Still run routine safety scan; wellbeing check-ins can surface hidden struggles.'],
  },
};

export function getArchetype(id: ConcernArchetype): ArchetypeDefinition {
  return CONCERN_ARCHETYPES[id] ?? CONCERN_ARCHETYPES.general_wellbeing;
}

export function listArchetypes(): ArchetypeDefinition[] {
  return Object.values(CONCERN_ARCHETYPES);
}
