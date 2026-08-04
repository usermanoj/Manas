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
  /** Internal guidance for how Manas should respond (not shown to users). */
  responseStrategy: string;
  /** Warm, user-facing validation sentence for this archetype. */
  validationMessage: string;
  suggestedTechniqueIds: string[];
  /**
   * Questions Manas might ask the user to gather more context.
   * NOT shown in the "You could say…" panel.
   */
  followUpQuestions: string[];
  /**
   * First-person phrases a user might naturally say to elaborate.
   * These populate the "You could say…" input-helper panel.
   * They must read naturally when typed into the chat input — not as questions.
   */
  userPrompts: string[];
  safetyConsiderations: string[];
}

export const CONCERN_ARCHETYPES: Record<ConcernArchetype, ArchetypeDefinition> = {
  stress: {
    id: 'stress',
    label: 'Stress or overwhelm',
    description: 'Feeling pressed by demands, deadlines, responsibilities, or uncertainty.',
    indicators: [
      'stress', 'stressed', 'overwhelmed', 'too much', "can't keep up", 'pressure', 'deadline',
      'racing thoughts', 'on edge', 'tense', 'burdened', 'overloaded',
    ],
    responseStrategy:
      'Validate the overload, help them name what is within vs outside their control, and offer a fast physiological regulation technique plus a prioritization framework.',
    validationMessage:
      "It makes sense that you're feeling overloaded when so much is being asked of you.",
    suggestedTechniqueIds: ['box_breathing', '5_4_3_2_1_grounding', 'worry_time', 'values_clarification'],
    followUpQuestions: [
      'What is the main thing pressing on you right now?',
      'How long have you been feeling this level of pressure?',
      'Where do you feel it most in your body?',
    ],
    userPrompts: [
      "It's been building up for a while now",
      "I feel like I can't catch a breath",
      "There's too much on my plate at once",
    ],
    safetyConsiderations: ['High stress can mask crisis; scan for hopelessness or self-harm language.'],
  },

  anxiety: {
    id: 'anxiety',
    label: 'Anxiety or worry',
    description: 'Persistent worry, anticipatory dread, physical arousal, or fear of something bad happening.',
    indicators: [
      'anxious', 'anxiety', 'worried', 'worry', 'worrying', 'nervous', 'panic', 'panicking',
      'racing heart', 'heart races', 'heart racing', 'pounding heart', "can't stop thinking",
      'cannot stop thinking', 'cannot stop worrying', 'dread', 'terrified', 'terrifying',
      'fear', 'afraid', 'scared', 'what if', 'restless', 'on edge', 'overwhelming fear',
    ],
    responseStrategy:
      'Normalize anxiety as a threat-response, offer grounding to reduce arousal, and introduce cognitive or behavioral tools based on severity.',
    validationMessage:
      'Anxiety is a normal threat-response, and there are small ways to soften the intensity when it shows up.',
    suggestedTechniqueIds: ['5_4_3_2_1_grounding', 'box_breathing', 'cognitive_restructuring', 'worry_time', 'urge_surfing'],
    followUpQuestions: [
      'What are you most afraid might happen?',
      'Do you notice this more in your body, your thoughts, or both?',
      'When did this worry pattern start?',
    ],
    userPrompts: [
      "I keep overthinking everything",
      "My mind won't switch off",
      "I feel on edge most of the time",
    ],
    safetyConsiderations: ['Distinguish distress from panic disorder or trauma; escalate if severe impairment or self-harm mentioned.'],
  },

  low_mood: {
    id: 'low_mood',
    label: 'Low mood or emptiness',
    description: 'Feeling down, numb, hopeless, or having lost interest in things that used to matter.',
    indicators: [
      'sad', 'not happy', 'unhappy', 'not so happy', 'down', 'feeling down', 'empty', 'numb',
      'hopeless', 'no point', 'not interested', 'anhedonia', 'tearful', 'crying', 'low mood',
      'feeling low', 'depressed', "can't enjoy", 'miserable', 'gloomy',
      "don't like anything", 'no interest', 'nothing feels good',
      "don't feel like doing", 'do not feel like doing', "don't want to do anything",
      'appetit', 'apetit', 'lost interest',
    ],
    responseStrategy:
      'Respond with warmth and patience; avoid toxic positivity. Offer behavioral activation and values-based action, and assess duration/severity.',
    validationMessage:
      'Thank you for trusting me with this. Low moods can feel heavy, and you do not have to push through them alone.',
    suggestedTechniqueIds: ['behavioral_activation', 'self_compassion_break', 'values_clarification', 'thought_record'],
    followUpQuestions: [
      'How long have you been feeling this way?',
      'Is there anything that still gives you a small sense of meaning or pleasure?',
      'How is your sleep and appetite?',
    ],
    userPrompts: [
      "I've been feeling this way for a few days",
      "Nothing feels enjoyable right now",
      "I just feel flat and unmotivated",
    ],
    safetyConsiderations: ['Mandatory suicide/self-harm screening if hopelessness or worthlessness is present.'],
  },

  burnout: {
    id: 'burnout',
    label: 'Burnout or exhaustion',
    description: 'Long-term depletion from chronic workplace or caregiving demands; cynicism and reduced efficacy.',
    indicators: [
      'burnout', 'burned out', 'burnt out', 'exhausted', 'drained', 'cynical', 'detached',
      "can't recover", 'no energy', 'no energy left', 'hollow', 'work is too much',
      'caregiving', 'compassion fatigue', 'lethargic', 'lethargy', 'tired all the time',
    ],
    responseStrategy:
      'Name burnout as a signal, not a personal failing. Focus on recovery, boundaries, and sustainable energy management rather than productivity hacks.',
    validationMessage:
      'Burnout is usually a signal that your energy has been outpacing your recovery — it is not a personal failing.',
    suggestedTechniqueIds: ['behavioral_activation', 'values_clarification', 'progressive_muscle_relaxation', 'self_compassion_break'],
    followUpQuestions: [
      'What part of your life is taking the most from you right now?',
      'When did you last feel genuinely rested?',
      'What would it look like to protect even a small boundary?',
    ],
    userPrompts: [
      "I have no energy left for anything",
      "Even small tasks feel like too much effort",
      "I haven't felt rested in a long time",
    ],
    safetyConsiderations: ['Burnout can co-occur with depression; monitor for hopelessness.'],
  },

  sleep_disturbance: {
    id: 'sleep_disturbance',
    label: 'Sleep disturbance',
    description: 'Difficulty falling asleep, staying asleep, early waking, or non-restorative sleep.',
    indicators: [
      "can't sleep", 'insomnia', 'wake up at', 'waking at', '3am', '3 am',
      'nightmare', 'restless sleep', 'racing thoughts at night', 'unable to sleep',
      'not sleeping well', 'sleep problem', 'poor sleep', 'unabel to sleep',
      'unble to sleep', 'not able to sleep', 'cant sleep', 'trouble sleeping',
      'difficulty sleeping', 'sleepless', "couldn't sleep", 'could not sleep',
      'hard to sleep', 'not sleeping', "didn't sleep", 'did not sleep',
      'tossing and turning', 'keep waking', 'lying awake', 'lie awake',
      'staying asleep', 'awake all night',
    ],
    responseStrategy:
      'Validate the impact of poor sleep, offer CBT-I principles (stimulus control, sleep hygiene, worry time), and avoid recommending sedatives.',
    validationMessage:
      'Sleep touches everything else — mood, focus, and energy. Poor sleep deserves attention, not blame.',
    suggestedTechniqueIds: ['sleep_stimulus_control', 'worry_time', 'box_breathing', 'progressive_muscle_relaxation'],
    followUpQuestions: [
      'Is it harder to fall asleep, stay asleep, or wake too early?',
      'How many nights a week is this happening?',
      'What tends to be on your mind when you wake?',
    ],
    userPrompts: [
      "I lie awake for hours before falling asleep",
      "I keep waking up in the middle of the night",
      "My sleep feels really shallow and unrefreshing",
    ],
    safetyConsiderations: ['Chronic insomnia increases accident risk and mood deterioration; assess daytime impairment.'],
  },

  grief: {
    id: 'grief',
    label: 'Grief or loss',
    description: 'Reaction to the death of a loved one, a lost relationship, role, dream, or identity.',
    indicators: [
      'grief', 'loss', 'miss them', 'died', 'passed away', 'breakup', 'divorce',
      'mourning', 'empty without', "can't believe they're gone",
    ],
    responseStrategy:
      'Hold space without rushing toward solutions. Normalize grief as non-linear, offer gentle coping rituals, and suggest connection or professional support.',
    validationMessage:
      'Grief does not follow a straight path. There is no rush to feel better, and there is no wrong way to carry a loss.',
    suggestedTechniqueIds: ['self_compassion_break', 'values_clarification', '5_4_3_2_1_grounding', 'behavioral_activation'],
    followUpQuestions: [
      'Who or what have you lost?',
      'What has been hardest about this today?',
      'Do you have someone you can talk to about this?',
    ],
    userPrompts: [
      "Some days are harder than others",
      "I miss them more than I expected",
      "I'm struggling to accept what happened",
    ],
    safetyConsiderations: ['Grief can include intense suicidal ideation; screen carefully without being intrusive.'],
  },

  loneliness: {
    id: 'loneliness',
    label: 'Loneliness or disconnection',
    description: 'Feeling misunderstood, isolated, or lacking meaningful connection.',
    indicators: [
      'lonely', 'loneliness', 'isolated', 'no one understands', 'feel alone', 'disconnected',
      'no friends', "don't belong", 'abandoned', 'ignored', 'feel unseen',
    ],
    responseStrategy:
      'Validate loneliness as a real signal of unmet connection needs. Offer small, structured steps toward connection and self-compassion.',
    validationMessage:
      'Loneliness is a real signal that connection needs matter to you, and it is brave to name it.',
    suggestedTechniqueIds: ['values_clarification', 'self_compassion_break', 'behavioral_activation', '5_4_3_2_1_grounding'],
    followUpQuestions: [
      'Is this loneliness more about quantity of people, quality of connection, or both?',
      'When was the last time you felt truly seen by someone?',
      'What is one small way you might reach out this week?',
    ],
    userPrompts: [
      "I feel like no one really gets what I'm going through",
      "I've been spending a lot of time alone lately",
      "I miss feeling genuinely connected to people",
    ],
    safetyConsiderations: ['Loneliness is a risk factor for depression and self-harm; assess hopelessness.'],
  },

  trauma: {
    id: 'trauma',
    label: 'Trauma or intrusive memories',
    description: 'Re-experiencing, hypervigilance, or emotional flooding related to past adverse events.',
    indicators: [
      'trauma', 'ptsd', 'flashback', 'nightmare', 'intrusive', "can't stop replaying",
      'on guard', 'hypervigilant', 'triggered', 'adverse childhood',
    ],
    responseStrategy:
      'Respond slowly and safely. Offer grounding techniques to restore the window of tolerance. Strongly encourage professional support without being coercive.',
    validationMessage:
      'When difficult memories surface, grounding can help bring the present back into focus. You deserve steady support.',
    suggestedTechniqueIds: ['5_4_3_2_1_grounding', 'box_breathing', 'progressive_muscle_relaxation', 'self_compassion_break'],
    followUpQuestions: [
      'Are you safe right now?',
      'What helps you feel a little more grounded when memories surface?',
      'Do you have a therapist or counselor you trust?',
    ],
    userPrompts: [
      "It keeps coming back even when I don't want it to",
      "Certain things trigger memories I'd rather not think about",
      "I find it hard to feel safe sometimes",
    ],
    safetyConsiderations: ['Trauma content can be destabilizing; avoid detailed disclosure; prioritize stabilization and referral.'],
  },

  somatic_tension: {
    id: 'somatic_tension',
    label: 'Physical tension or somatic stress',
    description: 'Body-based symptoms such as headaches, muscle tension, chest tightness, or stomach issues linked to stress.',
    indicators: [
      'tension', 'headache', 'muscle pain', 'chest tight', 'tight chest', 'stomach ache',
      'nausea', 'jaw clenching', 'stiff shoulders', 'body aches', 'physically stressed', 'aching',
    ],
    responseStrategy:
      'Acknowledge the mind-body link, suggest somatic regulation, and recommend medical evaluation if symptoms are new or severe.',
    validationMessage:
      'The body often carries what the mind is processing. Noticing where you hold stress is an important first step.',
    suggestedTechniqueIds: ['progressive_muscle_relaxation', 'box_breathing', '5_4_3_2_1_grounding', 'self_compassion_break'],
    followUpQuestions: [
      'Where in your body do you feel this most?',
      'Have you had a medical check-up for these symptoms?',
      'Do the symptoms flare with particular situations or thoughts?',
    ],
    userPrompts: [
      "I notice a lot of tension in my neck and shoulders",
      "My body feels wound up even when I try to relax",
      "I've been getting headaches more often lately",
    ],
    safetyConsiderations: ['New severe physical symptoms (chest pain, neurological changes) require medical referral, not just self-help.'],
  },

  existential: {
    id: 'existential',
    label: 'Purpose, meaning, or life direction',
    description: "Questioning one's values, direction, identity, or place in the world.",
    indicators: [
      'purpose', 'meaningless', 'stuck', "don't know who i am", 'lost', 'no direction',
      "what's the point", 'identity', 'transition', 'quarter life', 'meaning',
    ],
    responseStrategy:
      'Use ACT-style values clarification. Avoid quick-fix answers; help the user identify one small value-aligned action.',
    validationMessage:
      'Questions of meaning and direction deserve patience. One small, value-aligned step is often enough to begin.',
    suggestedTechniqueIds: ['values_clarification', 'behavioral_activation', 'self_compassion_break', 'thought_record'],
    followUpQuestions: [
      'What matters to you when life feels hardest?',
      'If you could move one small step toward who you want to be, what would it be?',
      'Is this tied to a specific life transition?',
    ],
    userPrompts: [
      "I feel like I've lost my sense of direction",
      "I'm not sure what I want anymore",
      "Things that used to matter don't feel important now",
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
    validationMessage:
      'Thanks for checking in with yourself. Small moments of reflection can make a real difference over time.',
    suggestedTechniqueIds: ['box_breathing', 'values_clarification', 'self_compassion_break'],
    followUpQuestions: [
      'What has been going well lately?',
      "Is there anything you'd like to keep building on?",
      'How is your sleep, mood, and energy overall?',
    ],
    userPrompts: [
      "Things have been okay, but I want to reflect a bit",
      "I just want to check in with how I'm feeling",
      "I'd like to keep building on some positive habits",
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
