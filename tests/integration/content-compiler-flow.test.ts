import { describe, it, expect, beforeEach } from 'vitest';
import { ContentModuleOrchestrator } from '@/domain/content';
import type { ContentModuleOrchestratorDeps } from '@/domain/content';
import { InMemoryRepository } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';
import type { ContentModule, ContentModuleVersion } from '@/domain/repositories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestContext {
  orchestrator: ContentModuleOrchestrator;
  contentModuleRepo: InMemoryRepository<ContentModule>;
  contentModuleVersionRepo: InMemoryRepository<ContentModuleVersion>;
  auditLogger: InMemoryAuditLogger;
}

function createTestContext(): TestContext {
  const contentModuleRepo = new InMemoryRepository<ContentModule>();
  const contentModuleVersionRepo = new InMemoryRepository<ContentModuleVersion>();
  const auditLogger = new InMemoryAuditLogger();

  const deps: ContentModuleOrchestratorDeps = {
    contentModuleRepo,
    contentModuleVersionRepo,
    auditLogger,
  };

  return {
    orchestrator: new ContentModuleOrchestrator(deps),
    contentModuleRepo,
    contentModuleVersionRepo,
    auditLogger,
  };
}

/** Well-structured pasted text with headings and steps. */
const WELL_STRUCTURED_TEXT = `# Title
Pause and Reflect Exercise

# Purpose
A brief grounding exercise to help manage work-related stress through mindful breathing and body awareness.

# Steps
1. Find a comfortable seated position and close your eyes (30 seconds)
2. Take three deep breaths, inhaling slowly and exhaling fully (60 seconds)
3. Scan your body from head to toe, noticing areas of tension (2 minutes)
4. Gently release any tension you find with each exhale (90 seconds)
5. Open your eyes and notice how you feel (30 seconds)

# Warnings
- Do not use this exercise while driving or operating machinery
- If you experience dizziness, stop and breathe normally

# Contraindications
- Active panic attack (use grounding techniques instead)
- Recent trauma flashback

# Escalation Conditions
- User reports feeling worse after the exercise
- User expresses thoughts of self-harm
`;

/** Text with missing fields — no purpose, no steps. */
const MISSING_FIELDS_TEXT = `# Title
Incomplete Module
`;

/** Minimal text with no markdown structure at all. */
const UNSTRUCTURED_TEXT = `Some random text without any structure.
No headings here.
Just plain text lines.`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Content Compiler Integration Flow', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  // -------------------------------------------------------------------------
  // 1. Full workflow: extract → create draft → verify repos → verify audit
  // -------------------------------------------------------------------------
  describe('full workflow: extract draft from text → create → verify', () => {
    it('should extract draft from well-structured text, create it, and verify in repos and audit', async () => {
      const { orchestrator, contentModuleRepo, contentModuleVersionRepo, auditLogger } = ctx;

      // Extract draft from pasted text
      const extractResult = orchestrator.extractDraftFromText(WELL_STRUCTURED_TEXT, 'en');

      expect(extractResult.draftModule).toBeDefined();
      expect(extractResult.draftVersion).toBeDefined();
      expect(extractResult.validationWarnings).toEqual([]);

      // Create draft (persist)
      const { module, version } = await orchestrator.createDraft(
        extractResult.draftModule,
        extractResult.draftVersion,
      );

      // Verify module is in repo
      const storedModule = await contentModuleRepo.findById(module.id);
      expect(storedModule).not.toBeNull();
      expect(storedModule?.title).toBe('Pause and Reflect Exercise');
      expect(storedModule?.status).toBe('DRAFT');
      expect(storedModule?.currentVersionId).toBe(version.id);

      // Verify version is in repo
      const storedVersion = await contentModuleVersionRepo.findById(version.id);
      expect(storedVersion).not.toBeNull();
      expect(storedVersion?.moduleId).toBe(module.id);
      expect(storedVersion?.versionNumber).toBe(1);
      expect(storedVersion?.reviewStatus).toBe('DRAFT');

      // Verify audit event
      const events = await auditLogger.findAll();
      const draftCreatedEvents = events.filter(
        (e) => e.eventType === AuditEventType.CONTENT_DRAFT_CREATED,
      );
      expect(draftCreatedEvents.length).toBe(1);
      expect(draftCreatedEvents[0].details).toMatchObject({
        moduleId: module.id,
        versionId: version.id,
        title: 'Pause and Reflect Exercise',
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Extract well-structured text → verify module has correct fields
  // -------------------------------------------------------------------------
  describe('extract well-structured text', () => {
    it('should parse title, purpose, steps with durations, warnings, contraindications, and escalation', () => {
      const { orchestrator } = ctx;

      const result = orchestrator.extractDraftFromText(WELL_STRUCTURED_TEXT, 'en');

      // Module fields
      expect(result.draftModule.title).toBe('Pause and Reflect Exercise');
      expect(result.draftModule.purpose).toContain('grounding exercise');
      expect(result.draftModule.status).toBe('DRAFT');
      expect(result.draftModule.primaryLanguage).toBe('en');

      // Version steps
      expect(result.draftVersion.steps.length).toBe(5);
      expect(result.draftVersion.steps[0]).toMatchObject({
        order: 1,
        durationSeconds: 30,
      });
      expect(result.draftVersion.steps[1]).toMatchObject({
        order: 2,
        durationSeconds: 60,
      });
      expect(result.draftVersion.steps[2]).toMatchObject({
        order: 3,
        durationSeconds: 120, // 2 minutes
      });

      // Warnings
      expect(result.draftVersion.warnings.length).toBe(2);
      expect(result.draftVersion.warnings[0]).toContain('driving');

      // Contraindications
      expect(result.draftVersion.contraindications.length).toBe(2);
      expect(result.draftVersion.contraindications[0]).toContain('panic attack');

      // Escalation conditions
      expect(result.draftVersion.escalationConditions.length).toBe(2);
      expect(result.draftVersion.escalationConditions[0]).toContain('feeling worse');

      // No validation warnings for well-structured text
      expect(result.validationWarnings).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Extract text with missing fields → verify validation warnings
  // -------------------------------------------------------------------------
  describe('extract text with missing fields', () => {
    it('should generate validation warnings for missing purpose and steps', () => {
      const { orchestrator } = ctx;

      const result = orchestrator.extractDraftFromText(MISSING_FIELDS_TEXT, 'en');

      // Title should be extracted
      expect(result.draftModule.title).toBe('Incomplete Module');

      // Missing purpose and steps should produce warnings
      expect(result.validationWarnings).toContain('Missing: purpose');
      expect(result.validationWarnings).toContain('Missing: steps');
      expect(result.validationWarnings.length).toBeGreaterThanOrEqual(2);
    });

    it('should use fallback values for missing fields in the draft', () => {
      const { orchestrator } = ctx;

      const result = orchestrator.extractDraftFromText(MISSING_FIELDS_TEXT, 'en');

      // Fallback purpose
      expect(result.draftModule.purpose).toBe('No purpose specified.');

      // Empty steps
      expect(result.draftVersion.steps).toEqual([]);
    });

    it('should produce a title warning for completely unstructured text', () => {
      const { orchestrator } = ctx;

      // Unstructured text: first line becomes title, rest becomes purpose via fallback
      const result = orchestrator.extractDraftFromText(UNSTRUCTURED_TEXT, 'en');

      // With the fallback parsing logic, the first line becomes the title
      expect(result.draftModule.title).toBeTruthy();
      // Steps will be missing
      expect(result.validationWarnings).toContain('Missing: steps');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Submit for review: DRAFT → PENDING_CLINICAL_REVIEW
  // -------------------------------------------------------------------------
  describe('submit for review', () => {
    it('should transition a DRAFT module to PENDING_CLINICAL_REVIEW', async () => {
      const { orchestrator, contentModuleRepo, contentModuleVersionRepo, auditLogger } = ctx;

      // Create a draft first
      const extractResult = orchestrator.extractDraftFromText(WELL_STRUCTURED_TEXT, 'en');
      const { module } = await orchestrator.createDraft(
        extractResult.draftModule,
        extractResult.draftVersion,
      );

      expect(module.status).toBe('DRAFT');

      // Submit for review
      const updatedModule = await orchestrator.submitForReview(module.id);

      expect(updatedModule.status).toBe('PENDING_CLINICAL_REVIEW');

      // Verify repo state
      const storedModule = await contentModuleRepo.findById(module.id);
      expect(storedModule?.status).toBe('PENDING_CLINICAL_REVIEW');

      // Verify version reviewStatus also updated
      const storedVersion = await contentModuleVersionRepo.findById(
        extractResult.draftVersion.id,
      );
      expect(storedVersion?.reviewStatus).toBe('PENDING_CLINICAL_REVIEW');

      // Verify audit event
      const reviewEvents = await auditLogger.findAll({
        eventType: AuditEventType.CONTENT_SUBMITTED_FOR_REVIEW,
      });
      expect(reviewEvents.length).toBe(1);
      expect(reviewEvents[0].details).toMatchObject({
        moduleId: module.id,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Submit for review on already-submitted module → rejection
  // -------------------------------------------------------------------------
  describe('invalid transition: submit for review on non-DRAFT module', () => {
    it('should reject submitting a PENDING_CLINICAL_REVIEW module for review again', async () => {
      const { orchestrator } = ctx;

      // Create and submit
      const extractResult = orchestrator.extractDraftFromText(WELL_STRUCTURED_TEXT, 'en');
      const { module } = await orchestrator.createDraft(
        extractResult.draftModule,
        extractResult.draftVersion,
      );
      await orchestrator.submitForReview(module.id);

      // Attempt to submit again — should fail (invalid transition)
      await expect(orchestrator.submitForReview(module.id)).rejects.toThrow();
    });

    it('should throw on non-existent module', async () => {
      const { orchestrator } = ctx;

      await expect(orchestrator.submitForReview('non-existent-id')).rejects.toThrow(
        /not found/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. AI constraint: status is always DRAFT after creation, never APPROVED
  // -------------------------------------------------------------------------
  describe('AI constraint: module status always DRAFT after creation', () => {
    it('should always create modules with DRAFT status regardless of input text', async () => {
      const { orchestrator } = ctx;

      // Extract and create from various text inputs
      const result1 = orchestrator.extractDraftFromText(WELL_STRUCTURED_TEXT, 'en');
      const result2 = orchestrator.extractDraftFromText(MISSING_FIELDS_TEXT, 'en');
      const result3 = orchestrator.extractDraftFromText(UNSTRUCTURED_TEXT, 'en');

      // All draft modules must have DRAFT status
      expect(result1.draftModule.status).toBe('DRAFT');
      expect(result2.draftModule.status).toBe('DRAFT');
      expect(result3.draftModule.status).toBe('DRAFT');

      // All draft versions must have DRAFT reviewStatus
      expect(result1.draftVersion.reviewStatus).toBe('DRAFT');
      expect(result2.draftVersion.reviewStatus).toBe('DRAFT');
      expect(result3.draftVersion.reviewStatus).toBe('DRAFT');
    });

    it('should persist with DRAFT status and never APPROVED after createDraft', async () => {
      const { orchestrator, contentModuleRepo } = ctx;

      const extractResult = orchestrator.extractDraftFromText(WELL_STRUCTURED_TEXT, 'en');
      const { module } = await orchestrator.createDraft(
        extractResult.draftModule,
        extractResult.draftVersion,
      );

      // Verify persisted status
      const stored = await contentModuleRepo.findById(module.id);
      expect(stored?.status).toBe('DRAFT');
      expect(stored?.status).not.toBe('APPROVED');
      expect(stored?.status).not.toBe('PENDING_CLINICAL_REVIEW');
    });
  });
});
