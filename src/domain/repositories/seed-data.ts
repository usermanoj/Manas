import {
  Profile,
  UserPreferences,
  Provider,
  ContentModule,
  ContentModuleVersion,
  CarePlan,
  CarePlanVersion,
} from './types';

// ─── Profiles ──────────────────────────────────────────────────────────────────

export const SEED_PROFILES: Profile[] = [
  {
    id: 'profile-ananya-sharma',
    displayName: 'Ananya Sharma',
    role: 'user',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
  },
  {
    id: 'profile-dr-maya-rao',
    displayName: 'Dr. Maya Rao',
    role: 'clinician',
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
  },
  {
    id: 'profile-arjun-mehta',
    displayName: 'Arjun Mehta',
    role: 'user',
    createdAt: new Date('2026-02-01T12:00:00.000Z'),
  },
];

// ─── User Preferences ──────────────────────────────────────────────────────────

export const SEED_USER_PREFERENCES: UserPreferences[] = [
  {
    id: 'pref-ananya',
    userId: 'profile-ananya-sharma',
    language: 'hi-hinglish',
    mode: 'CONNECTED_CARE',
  },
  {
    id: 'pref-arjun',
    userId: 'profile-arjun-mehta',
    language: 'en',
    mode: 'GUEST',
  },
];

// ─── Providers (all isFictionalDemo: true) ─────────────────────────────────────

export const SEED_PROVIDERS: Provider[] = [
  {
    id: 'provider-dr-maya-rao',
    profileId: 'profile-dr-maya-rao',
    name: 'Dr. Maya Rao',
    title: 'Clinical Psychologist',
    languages: ['en', 'hi', 'hi-hinglish'],
    focusAreas: ['workplace stress', 'anxiety', 'burnout', 'mindfulness'],
    availability: 'Mon–Fri, 9 AM – 5 PM IST',
    sessionType: 'Video + Chat',
    priceRange: '₹1,500 – ₹2,500 per session',
    bio: 'Dr. Maya Rao is a clinical psychologist specialising in workplace wellbeing and burnout recovery. She uses a blend of CBT and mindfulness-based approaches.',
    isFictionalDemo: true,
  },
  {
    id: 'provider-dr-vikram-singh',
    profileId: 'profile-dr-vikram-singh',
    name: 'Dr. Vikram Singh',
    title: 'Counselling Psychologist',
    languages: ['en', 'hi'],
    focusAreas: ['anxiety', 'depression', 'sleep disorders', 'life transitions'],
    availability: 'Tue–Sat, 10 AM – 7 PM IST',
    sessionType: 'Video',
    priceRange: '₹1,200 – ₹2,000 per session',
    bio: 'Dr. Vikram Singh is a counselling psychologist with over 10 years of experience helping adults navigate anxiety, sleep issues, and major life transitions.',
    isFictionalDemo: true,
  },
  {
    id: 'provider-priya-kapoor',
    profileId: 'profile-priya-kapoor',
    name: 'Priya Kapoor',
    title: 'Wellness Coach & Mindfulness Facilitator',
    languages: ['en', 'hi-hinglish'],
    focusAreas: ['stress management', 'mindfulness', 'work-life balance', 'self-compassion'],
    availability: 'Mon–Thu, 6 PM – 9 PM IST; Sat 10 AM – 2 PM IST',
    sessionType: 'Chat + Audio',
    priceRange: '₹800 – ₹1,500 per session',
    bio: 'Priya Kapoor is a certified wellness coach who facilitates mindfulness groups and one-to-one stress-management sessions for working professionals.',
    isFictionalDemo: true,
  },
  {
    id: 'provider-dr-neha-iyer',
    profileId: 'profile-dr-neha-iyer',
    name: 'Dr. Neha Iyer',
    title: 'Psychiatrist & Psychotherapist',
    languages: ['en', 'hi', 'ta'],
    focusAreas: ['trauma', 'PTSD', 'chronic stress', 'somatic therapy'],
    availability: 'Wed–Sun, 11 AM – 6 PM IST',
    sessionType: 'Video',
    priceRange: '₹2,500 – ₹4,000 per session',
    bio: 'Dr. Neha Iyer is a psychiatrist and psychotherapist with expertise in trauma-informed care and somatic experiencing. She offers integrative treatment plans.',
    isFictionalDemo: true,
  },
];

// ─── Content Modules ───────────────────────────────────────────────────────────

export const SEED_CONTENT_MODULES: ContentModule[] = [
  {
    id: 'module-pause-reflect',
    title: 'Pause and Reflect',
    purpose: 'A guided micro-exercise that helps the user slow down, notice their current state, and reflect on what they need right now.',
    status: 'DRAFT',
    currentVersionId: 'module-pause-reflect-v1',
    primaryLanguage: 'en',
  },
];

export const SEED_CONTENT_MODULE_VERSIONS: ContentModuleVersion[] = [
  {
    id: 'module-pause-reflect-v1',
    moduleId: 'module-pause-reflect',
    versionNumber: 1,
    steps: [
      {
        order: 1,
        instruction: 'Close your eyes or soften your gaze. Take three slow breaths.',
        durationSeconds: 30,
      },
      {
        order: 2,
        instruction: 'Notice what you are feeling in your body right now. Name it silently.',
        durationSeconds: 45,
      },
      {
        order: 3,
        instruction: 'Ask yourself: "What do I need most right now?" Sit with the answer for a moment.',
        durationSeconds: 60,
      },
      {
        order: 4,
        instruction: 'When you are ready, write one sentence about what came up for you.',
        durationSeconds: 120,
      },
    ],
    warnings: [
      'If you feel overwhelmed at any point, pause the exercise and take a break.',
      'This module is not a substitute for professional mental-health care.',
    ],
    contraindications: [
      'Active crisis or suicidal ideation — route to immediate resources instead.',
    ],
    escalationConditions: [
      'User reports feeling unsafe during the exercise.',
      'User reports dissociation or severe distress.',
    ],
    language: 'en',
    reviewStatus: 'DRAFT',
    translationStatus: 'PENDING',
  },
];

// ─── Care Plans ────────────────────────────────────────────────────────────────

export const SEED_CARE_PLANS: CarePlan[] = [
  {
    id: 'care-plan-ananya-001',
    userId: 'profile-ananya-sharma',
    clinicianId: 'provider-dr-maya-rao',
    status: 'ACTIVE',
  },
];

export const SEED_CARE_PLAN_VERSIONS: CarePlanVersion[] = [
  {
    id: 'care-plan-ananya-001-v1',
    carePlanId: 'care-plan-ananya-001',
    versionNumber: 1,
    goals: [
      'Reduce work-related anxiety using structured reflection',
      'Improve sleep hygiene through nightly wind-down routine',
      'Build self-compassion practices for high-pressure days',
    ],
    assignedModules: ['module-pause-reflect'],
    checkInFrequency: 'twice_per_week',
    boundaries: {
      aiRole: 'facilitator',
      clinicianOversight: 'weekly_review',
      escalationPolicy: 'immediate_routing_to_crisis_resources_if_safety_flag',
    },
    followUpDate: new Date('2026-08-15T10:00:00.000Z'),
    status: 'COMPLETED',
    clinicianApprovedAt: new Date('2026-02-05T14:00:00.000Z'),
    userAcceptedAt: new Date('2026-02-06T09:30:00.000Z'),
    createdAt: new Date('2026-02-04T11:00:00.000Z'),
  },
  {
    id: 'care-plan-ananya-001-v2',
    carePlanId: 'care-plan-ananya-001',
    versionNumber: 2,
    goals: [
      'Deepen mindfulness practice with longer sessions',
      'Address workplace boundary-setting with manager',
      'Maintain sleep improvements achieved in V1',
      'Explore support-group participation',
    ],
    assignedModules: ['module-pause-reflect'],
    checkInFrequency: 'weekly',
    boundaries: {
      aiRole: 'facilitator',
      clinicianOversight: 'biweekly_review',
      escalationPolicy: 'immediate_routing_to_crisis_resources_if_safety_flag',
      v1Preserved: true,
    },
    followUpDate: new Date('2026-09-01T10:00:00.000Z'),
    status: 'ACTIVE',
    clinicianApprovedAt: new Date('2026-04-10T15:00:00.000Z'),
    userAcceptedAt: new Date('2026-04-11T10:00:00.000Z'),
    createdAt: new Date('2026-04-09T09:00:00.000Z'),
  },
];
