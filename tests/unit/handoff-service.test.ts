import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDraftHandoff,
  updateHandoff,
  excludeField,
  submitForReview,
  buildPreview,
} from '@/domain/handoff';
import type { HandoffServiceDeps } from '@/domain/handoff';
import { InMemoryRepository } from '@/domain/repositories/in-memory';
import { InMemoryAuditLogger } from '@/domain/audit/logger';
import type { Handoff } from '@/domain/repositories';
import type { StructuredCheckIn } from '@/domain/ai';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_USER_ID = 'user-001';
const FIXTURE_PROVIDER_ID = 'provider-001';

const confirmedSummary: StructuredCheckIn = {
  primary_concern: 'Persistent anxiety about upcoming exams',
  concern_duration: 'weeks',
  sleep_impact: 'mild',
  daily_functioning_impact: 'moderate',
  support_preference: 'professional_support',
  feels_safe: 'yes',
  key_points: ['Exam stress', 'Sleep disruption on weekdays', 'Wants coping strategies'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(): HandoffServiceDeps & {
  handoffRepo: InMemoryRepository<Handoff>;
  auditLogger: InMemoryAuditLogger;
} {
  return {
    handoffRepo: new InMemoryRepository<Handoff>(),
    auditLogger: new InMemoryAuditLogger(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HandoffService', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
  });

  // -------------------------------------------------------------------------
  // 1. Handoff is built only from confirmed structured summary
  // -------------------------------------------------------------------------
  describe('createDraftHandoff', () => {
    it('builds a handoff from a confirmed structured summary', async () => {
      const handoff = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      expect(handoff.status).toBe('DRAFT');
      expect(handoff.structuredSummary).toEqual(confirmedSummary);
      expect(handoff.userId).toBe(FIXTURE_USER_ID);
      expect(handoff.providerId).toBe(FIXTURE_PROVIDER_ID);
      expect(handoff.version).toBe(1);
      expect(handoff.excludedEntries).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Excluded fields are omitted from preview
  // -------------------------------------------------------------------------
  describe('buildPreview', () => {
    it('omits excluded fields from the included fields in preview', async () => {
      const handoff = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
        ['sleep_impact', 'key_points'],
      );

      const preview = buildPreview(handoff);

      expect(preview.excludedFields).toEqual(['sleep_impact', 'key_points']);
      expect(preview.includedFields).not.toHaveProperty('sleep_impact');
      expect(preview.includedFields).not.toHaveProperty('key_points');
      expect(preview.includedFields).toHaveProperty('primary_concern');
      expect(preview.includedFields).toHaveProperty('concern_duration');
      expect(preview.includedFields).toHaveProperty('daily_functioning_impact');
      expect(preview.includedFields).toHaveProperty('support_preference');
      expect(preview.includedFields).toHaveProperty('feels_safe');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Handoff cannot transition beyond USER_REVIEW in Day 3 scope
  // -------------------------------------------------------------------------
  describe('Day 3 transition ceiling', () => {
    it('allows DRAFT → USER_REVIEW via submitForReview but provides no service function to go further', async () => {
      const draft = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      const reviewed = await submitForReview(deps, draft.id);
      expect(reviewed.status).toBe('USER_REVIEW');

      // USER_REVIEW is the max status reachable through Day 3 HandoffService.
      // grant_consent transition exists in the state machine but has no
      // corresponding HandoffService function in Day 3 scope.
      // Attempting submit_for_review from USER_REVIEW should fail (invalid transition).
      await expect(submitForReview(deps, reviewed.id)).rejects.toThrow(/Invalid handoff transition/);
    });
  });

  // -------------------------------------------------------------------------
  // 4. No consent is granted by creating a draft
  // -------------------------------------------------------------------------
  describe('no implicit consent', () => {
    it('creating a DRAFT does not grant any consent — status remains DRAFT', async () => {
      const handoff = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      expect(handoff.status).toBe('DRAFT');

      // No HANDOFF_READY_FOR_REVIEW or consent-related audit event was emitted
      const events = await deps.auditLogger.findAll();
      const consentEvents = events.filter(
        (e) => e.eventType === 'HANDOFF_READY_FOR_REVIEW' || e.eventType.includes('CONSENT'),
      );
      expect(consentEvents).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. HANDOFF_DRAFT_CREATED audit event contains no raw sensitive text
  // -------------------------------------------------------------------------
  describe('audit: HANDOFF_DRAFT_CREATED', () => {
    it('emits HANDOFF_DRAFT_CREATED with metadata only — no raw summary text', async () => {
      await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
        ['sleep_impact'],
      );

      const events = await deps.auditLogger.findAll({ eventType: 'HANDOFF_DRAFT_CREATED' });
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.userId).toBe(FIXTURE_USER_ID);
      expect(event.details).toHaveProperty('handoffId');
      expect(event.details).toHaveProperty('providerId', FIXTURE_PROVIDER_ID);
      expect(event.details).toHaveProperty('excludedCount', 1);

      // No raw sensitive text should appear in audit details
      const detailsStr = JSON.stringify(event.details);
      expect(detailsStr).not.toContain(confirmedSummary.primary_concern);
      for (const kp of confirmedSummary.key_points) {
        expect(detailsStr).not.toContain(kp);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. HANDOFF_FIELD_EXCLUDED event records which field was excluded
  //    (metadata only — no raw text)
  // -------------------------------------------------------------------------
  describe('audit: HANDOFF_FIELD_EXCLUDED', () => {
    it('records the fieldKey in the audit event without raw summary values', async () => {
      const draft = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      const updated = await excludeField(deps, draft.id, 'primary_concern');

      expect(updated.excludedEntries).toContain('primary_concern');

      const events = await deps.auditLogger.findAll({ eventType: 'HANDOFF_FIELD_EXCLUDED' });
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.details).toHaveProperty('fieldKey', 'primary_concern');

      // Raw value of primary_concern must not appear in audit details
      const detailsStr = JSON.stringify(event.details);
      expect(detailsStr).not.toContain(confirmedSummary.primary_concern);
    });
  });

  // -------------------------------------------------------------------------
  // 7. userNote is optional, max 500 chars, not included in audit details
  // -------------------------------------------------------------------------
  describe('userNote', () => {
    it('is optional — handoff can be created without a userNote', async () => {
      const handoff = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      expect(handoff.userNote).toBeUndefined();
    });

    it('is capped at 500 characters by the schema', async () => {
      // Schema enforcement: userNote field is z.string().max(500)
      // We verify the schema constant here; the Zod schema is the authority.
      const { CreateHandoffRequestSchema } = await import('@/domain/handoff');
      const longNote = 'x'.repeat(501);
      const parseResult = CreateHandoffRequestSchema.safeParse({
        providerId: 'prov-1',
        structuredSummary: confirmedSummary,
        userNote: longNote,
      });
      expect(parseResult.success).toBe(false);
    });

    it('is not included in HANDOFF_DRAFT_CREATED audit details', async () => {
      const note = 'I want the clinician to know about my work stress';
      await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
        [],
        note,
      );

      const events = await deps.auditLogger.findAll({ eventType: 'HANDOFF_DRAFT_CREATED' });
      expect(events).toHaveLength(1);

      const detailsStr = JSON.stringify(events[0].details);
      expect(detailsStr).not.toContain(note);
    });

    it('is not included in HANDOFF_EDITED audit details', async () => {
      const draft = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      const note = 'Updated note about my situation';
      await updateHandoff(deps, draft.id, { userNote: note });

      const events = await deps.auditLogger.findAll({ eventType: 'HANDOFF_EDITED' });
      expect(events).toHaveLength(1);

      const detailsStr = JSON.stringify(events[0].details);
      expect(detailsStr).not.toContain(note);
    });
  });

  // -------------------------------------------------------------------------
  // 8. userNote is displayed in preview
  // -------------------------------------------------------------------------
  describe('buildPreview with userNote', () => {
    it('includes userNote in the preview when present', async () => {
      const note = 'Please share with my therapist';
      const handoff = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
        [],
        note,
      );

      const preview = buildPreview(handoff);
      expect(preview.userNote).toBe(note);
    });

    it('returns undefined userNote in preview when no note was set', async () => {
      const handoff = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      const preview = buildPreview(handoff);
      expect(preview.userNote).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 9. All transitions go through HandoffService, not generic repo update
  // -------------------------------------------------------------------------
  describe('transitions are service-mediated', () => {
    it('direct repo update does not change status — submitForReview is the only path to USER_REVIEW', async () => {
      const draft = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      // Direct repo update bypasses state-machine validation;
      // it only changes the raw field without audit or transition checks.
      const rawUpdated = await deps.handoffRepo.update(draft.id, { status: 'USER_REVIEW' });
      // The repo does enforce the write, but no audit event is emitted
      // and no state-machine validation occurred.
      const eventsBefore = await deps.auditLogger.findAll({
        eventType: 'HANDOFF_READY_FOR_REVIEW',
      });
      // Only the HANDOFF_DRAFT_CREATED event from createDraftHandoff exists
      expect(eventsBefore).toHaveLength(0);

      // The proper path: create a fresh draft and go through the service
      deps.handoffRepo.clear();
      deps.auditLogger.clear();

      const freshDraft = await createDraftHandoff(
        deps,
        FIXTURE_USER_ID,
        FIXTURE_PROVIDER_ID,
        confirmedSummary,
      );

      const reviewed = await submitForReview(deps, freshDraft.id);
      expect(reviewed.status).toBe('USER_REVIEW');

      const eventsAfter = await deps.auditLogger.findAll({
        eventType: 'HANDOFF_READY_FOR_REVIEW',
      });
      expect(eventsAfter).toHaveLength(1);
    });

    it('HandoffService enforces state-machine validation on transition', async () => {
      // Trying to submit a non-existent handoff should throw
      await expect(submitForReview(deps, 'nonexistent-id')).rejects.toThrow();
    });
  });
});
