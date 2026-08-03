import { describe, it, expect, beforeEach } from 'vitest';
import { ContentModuleOrchestrator } from '@/domain/content';
import type { ContentModuleOrchestratorDeps } from '@/domain/content';
import { InMemoryRepository } from '@/domain/repositories';
import type { ContentModule, ContentModuleVersion } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDeps(): ContentModuleOrchestratorDeps {
  return {
    contentModuleRepo: new InMemoryRepository<ContentModule>(),
    contentModuleVersionRepo: new InMemoryRepository<ContentModuleVersion>(),
    auditLogger: new InMemoryAuditLogger(),
  };
}

const WELL_STRUCTURED_TEXT = `# Title
Pause and Reflect

# Purpose
A guided micro-exercise that helps the user slow down and reflect.

# Steps
1. Close your eyes. Take three slow breaths. (30 seconds)
2. Notice what you are feeling in your body. (45 seconds)
3. Ask yourself what you need right now. (1 minute)

# Warnings
- If overwhelmed, pause and take a break.
- Not a substitute for professional care.

# Contraindications
- Active crisis — route to resources instead.

# Escalation Conditions
- User reports feeling unsafe.
- User reports dissociation.`;

const MINIMAL_TEXT = `Just some text without any structure.`;

const MISSING_STEPS_TEXT = `# Title
Grounding Exercise

# Purpose
A brief grounding technique for stress relief.

# Warnings
- Do not use during active crisis.`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContentModuleOrchestrator', () => {
  let deps: ContentModuleOrchestratorDeps;
  let orchestrator: ContentModuleOrchestrator;

  beforeEach(() => {
    deps = createDeps();
    orchestrator = new ContentModuleOrchestrator(deps);
  });

  // ─── extractDraftFromText ──────────────────────────────────────────────

  it('extractDraftFromText returns valid ContentModule and ContentModuleVersion', () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    expect(draftModule).toBeDefined();
    expect(draftModule.id).toBeTruthy();
    expect(draftModule.title).toBe('Pause and Reflect');
    expect(draftModule.purpose).toContain('guided micro-exercise');
    expect(draftModule.status).toBe('DRAFT');
    expect(draftModule.currentVersionId).toBe(draftVersion.id);
    expect(draftModule.primaryLanguage).toBe('en');

    expect(draftVersion).toBeDefined();
    expect(draftVersion.id).toBeTruthy();
    expect(draftVersion.moduleId).toBe(draftModule.id);
    expect(draftVersion.versionNumber).toBe(1);
    expect(draftVersion.steps.length).toBe(3);
    expect(draftVersion.reviewStatus).toBe('DRAFT');
    expect(draftVersion.translationStatus).toBe('PENDING');
    expect(draftVersion.language).toBe('en');
  });

  it('extractDraftFromText parses steps with order, instruction, and durationSeconds', () => {
    const { draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    const step1 = draftVersion.steps[0];
    expect(step1.order).toBe(1);
    expect(step1.instruction).toContain('Close your eyes');
    expect(step1.durationSeconds).toBe(30);

    const step3 = draftVersion.steps[2];
    expect(step3.order).toBe(3);
    expect(step3.durationSeconds).toBe(60); // 1 minute = 60 seconds
  });

  it('extractDraftFromText parses warnings, contraindications, and escalationConditions', () => {
    const { draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    expect(draftVersion.warnings.length).toBe(2);
    expect(draftVersion.warnings[0]).toContain('overwhelmed');

    expect(draftVersion.contraindications.length).toBe(1);
    expect(draftVersion.contraindications[0]).toContain('Active crisis');

    expect(draftVersion.escalationConditions.length).toBe(2);
    expect(draftVersion.escalationConditions[0]).toContain('feeling unsafe');
  });

  it('extractDraftFromText produces warnings for missing fields', () => {
    const { validationWarnings } = orchestrator.extractDraftFromText(
      MINIMAL_TEXT,
      'en',
    );

    expect(validationWarnings.length).toBeGreaterThan(0);
    expect(validationWarnings).toContain('Missing: purpose');
    expect(validationWarnings).toContain('Missing: steps');
  });

  it('extractDraftFromText produces warning for missing steps when title and purpose exist', () => {
    const { validationWarnings } = orchestrator.extractDraftFromText(
      MISSING_STEPS_TEXT,
      'en',
    );

    expect(validationWarnings).toContain('Missing: steps');
    expect(validationWarnings).not.toContain('Missing: title');
    expect(validationWarnings).not.toContain('Missing: purpose');
  });

  it('extractDraftFromText with empty text produces all three missing-field warnings', () => {
    const { validationWarnings } = orchestrator.extractDraftFromText('', 'en');

    expect(validationWarnings).toContain('Missing: title');
    expect(validationWarnings).toContain('Missing: purpose');
    expect(validationWarnings).toContain('Missing: steps');
  });

  // ─── AI constraint ──────────────────────────────────────────────────────

  it('module status is always DRAFT (never APPROVED) after extraction', () => {
    const { draftModule } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    expect(draftModule.status).toBe('DRAFT');
    expect(draftModule.status).not.toBe('APPROVED');
  });

  it('version reviewStatus is DRAFT after extraction', () => {
    const { draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    expect(draftVersion.reviewStatus).toBe('DRAFT');
    expect(draftVersion.reviewStatus).not.toBe('APPROVED');
  });

  // ─── createDraft ────────────────────────────────────────────────────────

  it('createDraft persists module and version to repositories', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    const { module, version } = await orchestrator.createDraft(draftModule, draftVersion);

    expect(module).toBeDefined();
    expect(version).toBeDefined();

    const foundModule = await deps.contentModuleRepo.findById(module.id);
    expect(foundModule).not.toBeNull();
    expect(foundModule!.title).toBe('Pause and Reflect');
    expect(foundModule!.status).toBe('DRAFT');
    expect(foundModule!.currentVersionId).toBe(version.id);

    const foundVersion = await deps.contentModuleVersionRepo.findById(version.id);
    expect(foundVersion).not.toBeNull();
    expect(foundVersion!.moduleId).toBe(module.id);
    expect(foundVersion!.reviewStatus).toBe('DRAFT');
  });

  it('createDraft logs CONTENT_DRAFT_CREATED audit event', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    const { module } = await orchestrator.createDraft(draftModule, draftVersion);

    const events = await deps.auditLogger.findAll({
      eventType: AuditEventType.CONTENT_DRAFT_CREATED,
    });
    expect(events.length).toBe(1);
    expect(events[0].details).toHaveProperty('moduleId', module.id);
    expect(events[0].details).toHaveProperty('versionId', draftVersion.id);
    expect(events[0].details).toHaveProperty('title', 'Pause and Reflect');
  });

  it('createDraft does not create APPROVED status', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    const { module } = await orchestrator.createDraft(draftModule, draftVersion);

    expect(module.status).toBe('DRAFT');
    expect(module.status).not.toBe('APPROVED');
  });

  // ─── submitForReview ────────────────────────────────────────────────────

  it('submitForReview transitions DRAFT → PENDING_CLINICAL_REVIEW', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );
    const { module } = await orchestrator.createDraft(draftModule, draftVersion);

    const updated = await orchestrator.submitForReview(module.id);

    expect(updated.status).toBe('PENDING_CLINICAL_REVIEW');
    expect(updated.status).not.toBe('DRAFT');

    const events = await deps.auditLogger.findAll({
      eventType: AuditEventType.CONTENT_SUBMITTED_FOR_REVIEW,
    });
    expect(events.length).toBe(1);
    expect(events[0].details).toHaveProperty('moduleId', module.id);
  });

  it('submitForReview also updates version reviewStatus to PENDING_CLINICAL_REVIEW', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );
    const { module, version } = await orchestrator.createDraft(draftModule, draftVersion);

    await orchestrator.submitForReview(module.id);

    const foundVersion = await deps.contentModuleVersionRepo.findById(version.id);
    expect(foundVersion!.reviewStatus).toBe('PENDING_CLINICAL_REVIEW');
  });

  it('submitForReview rejects invalid transition (already PENDING)', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );
    const { module } = await orchestrator.createDraft(draftModule, draftVersion);

    await orchestrator.submitForReview(module.id);

    await expect(
      orchestrator.submitForReview(module.id),
    ).rejects.toThrow(/Invalid content-review transition/);
  });

  it('submitForReview rejects when module not found', async () => {
    await expect(
      orchestrator.submitForReview('nonexistent-module-id'),
    ).rejects.toThrow(/not found/);
  });

  // ─── End-to-end flow ────────────────────────────────────────────────────

  it('full flow: extract → createDraft → submitForReview logs both audit events', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    const { module } = await orchestrator.createDraft(draftModule, draftVersion);
    await orchestrator.submitForReview(module.id);

    const draftEvents = await deps.auditLogger.findAll({
      eventType: AuditEventType.CONTENT_DRAFT_CREATED,
    });
    const reviewEvents = await deps.auditLogger.findAll({
      eventType: AuditEventType.CONTENT_SUBMITTED_FOR_REVIEW,
    });

    expect(draftEvents.length).toBe(1);
    expect(reviewEvents.length).toBe(1);
  });

  it('audit events contain only metadata (no raw pasted text)', async () => {
    const { draftModule, draftVersion } = orchestrator.extractDraftFromText(
      WELL_STRUCTURED_TEXT,
      'en',
    );

    const { module } = await orchestrator.createDraft(draftModule, draftVersion);

    const events = await deps.auditLogger.findAll({
      eventType: AuditEventType.CONTENT_DRAFT_CREATED,
    });
    expect(events.length).toBe(1);

    const details = events[0].details;
    expect(details).toHaveProperty('moduleId', module.id);
    expect(details).not.toHaveProperty('rawText');
    expect(details).not.toHaveProperty('pastedText');
    expect(JSON.stringify(details)).not.toContain('Close your eyes');
  });
});
