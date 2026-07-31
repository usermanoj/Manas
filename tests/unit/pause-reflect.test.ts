import { describe, it, expect } from 'vitest';
import {
  PAUSE_REFLECT_MODULE,
  PAUSE_REFLECT_VERSION,
  PAUSE_REFLECT_STEPS,
} from '@/domain/content';

// ---------------------------------------------------------------------------
// Pause & Reflect — Domain Module Fixture Tests
// ---------------------------------------------------------------------------

describe('Pause and Reflect module fixture', () => {
  it('should have status PENDING_CLINICAL_REVIEW, never APPROVED', () => {
    expect(PAUSE_REFLECT_MODULE.status).toBe('PENDING_CLINICAL_REVIEW');
    expect(PAUSE_REFLECT_MODULE.status).not.toBe('APPROVED');
  });

  it('should contain exactly 3 steps (questions)', () => {
    expect(PAUSE_REFLECT_STEPS).toHaveLength(3);
    expect(PAUSE_REFLECT_VERSION.steps).toHaveLength(3);
  });

  it('should not include raw reflection text in any persisted payload or audit event', () => {
    // The module fixture is a clinician-authored template; it must not
    // carry any user-generated reflection content.
    const moduleJson = JSON.stringify(PAUSE_REFLECT_MODULE);
    const versionJson = JSON.stringify(PAUSE_REFLECT_VERSION);

    // Fields that would indicate user-submitted / raw reflection data
    const forbiddenKeys = [
      'rawText',
      'rawReflection',
      'userResponse',
      'userReflection',
      'reflectionText',
      'freeText',
      'userInput',
      'journalEntry',
    ];

    for (const key of forbiddenKeys) {
      expect(moduleJson).not.toContain(`"${key}"`);
      expect(versionJson).not.toContain(`"${key}"`);
    }

    // Steps should only contain the clinician-authored question prompt,
    // never a user answer value.
    for (const step of PAUSE_REFLECT_VERSION.steps) {
      const keys = Object.keys(step as Record<string, unknown>);
      expect(keys).toContain('question');
      expect(keys).not.toContain('answer');
      expect(keys).not.toContain('response');
      expect(keys).not.toContain('rawText');
    }
  });

  it('should not be a DRAFT (DRAFT content is not exposed to users)', () => {
    expect(PAUSE_REFLECT_MODULE.status).not.toBe('DRAFT');
    expect(PAUSE_REFLECT_VERSION.reviewStatus).not.toBe('DRAFT');
  });
});
