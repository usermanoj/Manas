import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@/domain/repositories';
import { InMemoryAuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';
import type { CheckInSession, SafetyAssessment } from '@/domain/repositories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_USER_ID = 'profile-ananya-sharma';

interface TestContext {
  sessionRepo: InMemoryRepository<CheckInSession>;
  safetyAssessmentRepo: InMemoryRepository<SafetyAssessment>;
  auditLogger: InMemoryAuditLogger;
}

function createTestContext(): TestContext {
  const sessionRepo = new InMemoryRepository<CheckInSession>();
  const safetyAssessmentRepo = new InMemoryRepository<SafetyAssessment>();
  const auditLogger = new InMemoryAuditLogger();

  return {
    sessionRepo,
    safetyAssessmentRepo,
    auditLogger,
  };
}

/**
 * Simulates the DELETE handler logic from
 * src/app/api/privacy/check-ins/[id]/route.ts
 * Testing domain logic directly (not HTTP).
 */
async function deleteSession(
  ctx: TestContext,
  sessionId: string,
): Promise<{ deleted: boolean; status: number; deletedAssessmentCount?: number }> {
  const { sessionRepo, safetyAssessmentRepo, auditLogger } = ctx;

  const session = await sessionRepo.findById(sessionId);
  if (!session) {
    return { deleted: false, status: 404 };
  }

  // Delete associated safety assessments
  const assessments = await safetyAssessmentRepo.findAll({ sessionId } as never);
  for (const assessment of assessments) {
    await safetyAssessmentRepo.delete(assessment.id);
  }

  // Delete the session itself
  await sessionRepo.delete(sessionId);

  // Log audit event
  await auditLogger.log({
    requestId: `privacy-delete-${Date.now()}`,
    userId: DEMO_USER_ID,
    actor: 'user',
    eventType: AuditEventType.SESSION_DELETED,
    details: {
      deletedSessionId: sessionId,
      deletedAssessmentCount: assessments.length,
    },
  });

  return { deleted: true, status: 200, deletedAssessmentCount: assessments.length };
}

/** Create a sample check-in session for testing. */
function createSampleSession(id: string): CheckInSession {
  return {
    id,
    userId: 'guest',
    status: 'COMPLETED',
    mode: 'GUEST',
    language: 'en',
    startedAt: new Date(),
    structuredAnswers: {
      primary_concern: 'Work stress',
      concern_duration: 'weeks',
      sleep_impact: 'mild',
      daily_functioning_impact: 'none',
      support_preference: 'general_reflection',
      feels_safe: 'yes',
      key_points: ['Feeling stressed'],
    },
  } as unknown as CheckInSession;
}

/** Create a sample safety assessment associated with a session. */
function createSampleAssessment(id: string, sessionId: string): SafetyAssessment {
  return {
    id,
    sessionId,
    userId: 'guest',
    routingState: 'GENERAL_WELLBEING',
    triggeredRules: [],
    preGenResult: {},
    postGenResult: {},
    policyVersion: 'safety-v1',
    createdAt: new Date(),
  } as unknown as SafetyAssessment;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Privacy Deletion Integration Flow', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  // -------------------------------------------------------------------------
  // 1. Create session → verify exists → delete → verify gone
  // -------------------------------------------------------------------------
  describe('basic session deletion', () => {
    it('should create a session, delete it, and verify it no longer exists', async () => {
      const { sessionRepo } = ctx;

      // Create a session
      const session = createSampleSession('session-delete-001');
      await sessionRepo.create(session);

      // Verify it exists
      const found = await sessionRepo.findById('session-delete-001');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('session-delete-001');

      // Delete via handler logic
      const result = await deleteSession(ctx, 'session-delete-001');
      expect(result.deleted).toBe(true);
      expect(result.status).toBe(200);

      // Verify it's gone
      const afterDelete = await sessionRepo.findById('session-delete-001');
      expect(afterDelete).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Delete session with associated safety assessments
  // -------------------------------------------------------------------------
  describe('cascade deletion of associated safety assessments', () => {
    it('should delete both the session and its associated safety assessments', async () => {
      const { sessionRepo, safetyAssessmentRepo } = ctx;

      // Create session
      const session = createSampleSession('session-cascade-001');
      await sessionRepo.create(session);

      // Create two associated safety assessments
      const assessment1 = createSampleAssessment('assessment-001', 'session-cascade-001');
      const assessment2 = createSampleAssessment('assessment-002', 'session-cascade-001');
      await safetyAssessmentRepo.create(assessment1);
      await safetyAssessmentRepo.create(assessment2);

      // Verify assessments exist
      const assessmentsBefore = await safetyAssessmentRepo.findAll({
        sessionId: 'session-cascade-001',
      } as never);
      expect(assessmentsBefore.length).toBe(2);

      // Delete session
      const result = await deleteSession(ctx, 'session-cascade-001');
      expect(result.deleted).toBe(true);
      expect(result.deletedAssessmentCount).toBe(2);

      // Verify session is gone
      const sessionAfter = await sessionRepo.findById('session-cascade-001');
      expect(sessionAfter).toBeNull();

      // Verify assessments are gone
      const assessmentsAfter = await safetyAssessmentRepo.findAll({
        sessionId: 'session-cascade-001',
      } as never);
      expect(assessmentsAfter.length).toBe(0);
    });

    it('should delete session even if it has no associated assessments', async () => {
      const { sessionRepo, safetyAssessmentRepo } = ctx;

      // Create session without assessments
      const session = createSampleSession('session-no-assessments');
      await sessionRepo.create(session);

      // Verify no assessments
      const assessments = await safetyAssessmentRepo.findAll({
        sessionId: 'session-no-assessments',
      } as never);
      expect(assessments.length).toBe(0);

      // Delete
      const result = await deleteSession(ctx, 'session-no-assessments');
      expect(result.deleted).toBe(true);
      expect(result.deletedAssessmentCount).toBe(0);

      // Session gone
      const afterDelete = await sessionRepo.findById('session-no-assessments');
      expect(afterDelete).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Delete non-existent session → 404-like behavior
  // -------------------------------------------------------------------------
  describe('delete non-existent session', () => {
    it('should return 404 status when deleting a session that does not exist', async () => {
      const result = await deleteSession(ctx, 'non-existent-session-id');

      expect(result.deleted).toBe(false);
      expect(result.status).toBe(404);
    });

    it('should not create any audit event for non-existent session deletion', async () => {
      const { auditLogger } = ctx;

      await deleteSession(ctx, 'non-existent-session-id');

      const events = await auditLogger.findAll();
      expect(events.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Verify SESSION_DELETED audit event on successful deletion
  // -------------------------------------------------------------------------
  describe('audit event: SESSION_DELETED', () => {
    it('should log a SESSION_DELETED audit event with correct details on successful deletion', async () => {
      const { sessionRepo, auditLogger } = ctx;

      // Create and delete a session
      const session = createSampleSession('session-audit-001');
      await sessionRepo.create(session);

      await deleteSession(ctx, 'session-audit-001');

      // Verify audit event
      const events = await auditLogger.findAll();
      expect(events.length).toBe(1);

      const event = events[0];
      expect(event.eventType).toBe(AuditEventType.SESSION_DELETED);
      expect(event.userId).toBe(DEMO_USER_ID);
      expect(event.actor).toBe('user');
      expect(event.details).toMatchObject({
        deletedSessionId: 'session-audit-001',
        deletedAssessmentCount: 0,
      });
    });

    it('should include correct deletedAssessmentCount when assessments are deleted', async () => {
      const { sessionRepo, safetyAssessmentRepo, auditLogger } = ctx;

      // Create session and 3 assessments
      const session = createSampleSession('session-audit-002');
      await sessionRepo.create(session);
      await safetyAssessmentRepo.create(
        createSampleAssessment('audit-assessment-1', 'session-audit-002'),
      );
      await safetyAssessmentRepo.create(
        createSampleAssessment('audit-assessment-2', 'session-audit-002'),
      );
      await safetyAssessmentRepo.create(
        createSampleAssessment('audit-assessment-3', 'session-audit-002'),
      );

      await deleteSession(ctx, 'session-audit-002');

      // Verify audit event
      const events = await auditLogger.findAll({
        eventType: AuditEventType.SESSION_DELETED,
      });
      expect(events.length).toBe(1);
      expect(events[0].details).toMatchObject({
        deletedSessionId: 'session-audit-002',
        deletedAssessmentCount: 3,
      });
    });
  });
});
