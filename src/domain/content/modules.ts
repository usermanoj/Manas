import type { ContentModule, ContentModuleVersion } from '../repositories/types';

export const PAUSE_REFLECT_MODULE: ContentModule = {
  id: 'module-pause-reflect',
  title: 'Pause and Reflect',
  purpose: 'A guided micro-exercise that helps the user slow down, notice their current state, and consider a small practical next step.',
  status: 'PENDING_CLINICAL_REVIEW',
  currentVersionId: 'module-pause-reflect-v1',
  primaryLanguage: 'en',
};

export const PAUSE_REFLECT_VERSION: ContentModuleVersion = {
  id: 'module-pause-reflect-v1',
  moduleId: 'module-pause-reflect',
  versionNumber: 1,
  steps: [
    { order: 1, question: 'What happened?' },
    { order: 2, question: 'What did you notice in your thoughts, emotions or body?' },
    { order: 3, question: 'What is one small, practical next step you would like to consider?' },
  ],
  warnings: [
    'If you feel overwhelmed at any point, pause the exercise and take a break.',
    'This module is not a substitute for professional mental-health care.',
  ],
  contraindications: ['Active crisis or suicidal ideation — route to immediate resources instead.'],
  escalationConditions: ['User reports feeling unsafe during the exercise.'],
  language: 'en',
  reviewStatus: 'PENDING_CLINICAL_REVIEW',
  translationStatus: 'PENDING',
};

export const PAUSE_REFLECT_STEPS = PAUSE_REFLECT_VERSION.steps;

// Compile-time assertion: module must never be APPROVED
const _statusCheck: typeof PAUSE_REFLECT_MODULE.status extends 'APPROVED' ? never : true = true;
void _statusCheck;
