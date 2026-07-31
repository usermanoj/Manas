import { describe, it, expect } from 'vitest';
import {
  validateCheckInTransition,
  isTerminalCheckInStatus,
  validateContentReviewTransition,
  isTerminalContentReviewStatus,
  validateHandoffTransition,
  isTerminalHandoffStatus,
  canSendHandoff,
  validateCarePlanTransition,
  isTerminalCarePlanStatus,
  canAiModifyCarePlan,
  canApproveCarePlan,
} from '@/domain/state-machines';
import type { CheckInStatus, CheckInAction } from '@/domain/state-machines';
import type { HandoffStatus, HandoffAction, ConsentRecordForGuard } from '@/domain/state-machines';
import type { CarePlanStatus, CarePlanAction } from '@/domain/state-machines';

// ---------------------------------------------------------------------------
// 1. Check-In State Machine
// ---------------------------------------------------------------------------
describe('Check-in State Machine', () => {
  describe('valid transitions', () => {
    const validCases = [
      { from: 'INITIATED' as CheckInStatus, action: 'first_message' as CheckInAction, expected: 'IN_PROGRESS' as CheckInStatus },
      { from: 'IN_PROGRESS' as CheckInStatus, action: 'subsequent_message' as CheckInAction, expected: 'IN_PROGRESS' as CheckInStatus },
      { from: 'IN_PROGRESS' as CheckInStatus, action: 'complete' as CheckInAction, expected: 'COMPLETED' as CheckInStatus },
      { from: 'COMPLETED' as CheckInStatus, action: 'summary_stored' as CheckInAction, expected: 'SUMMARIZED' as CheckInStatus },
    ] as const;

    it.each(validCases)(
      'should transition from $from via $action to $expected',
      ({ from, action, expected }) => {
        const result = validateCheckInTransition(from, action);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.nextStatus).toBe(expected);
        }
      }
    );
  });

  describe('invalid transitions', () => {
    const invalidCases = [
      { from: 'SUMMARIZED' as CheckInStatus, action: 'first_message' as CheckInAction, label: 'SUMMARIZED is terminal' },
      { from: 'COMPLETED' as CheckInStatus, action: 'first_message' as CheckInAction, label: 'COMPLETED cannot go back to IN_PROGRESS' },
      { from: 'INITIATED' as CheckInStatus, action: 'complete' as CheckInAction, label: 'INITIATED cannot skip to COMPLETED' },
      { from: 'SUMMARIZED' as CheckInStatus, action: 'summary_stored' as CheckInAction, label: 'SUMMARIZED cannot re-store summary' },
    ] as const;

    it.each(invalidCases)(
      'should reject transition from $from via $action ($label)',
      ({ from, action }) => {
        const result = validateCheckInTransition(from, action);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      }
    );
  });

  describe('terminal status guard', () => {
    it('should identify SUMMARIZED as the only terminal check-in status', () => {
      expect(isTerminalCheckInStatus('SUMMARIZED')).toBe(true);
      expect(isTerminalCheckInStatus('INITIATED')).toBe(false);
      expect(isTerminalCheckInStatus('IN_PROGRESS')).toBe(false);
      expect(isTerminalCheckInStatus('COMPLETED')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Content Review State Machine
// ---------------------------------------------------------------------------
describe('Content Review State Machine', () => {
  describe('valid transitions', () => {
    it('should transition DRAFT to PENDING_CLINICAL_REVIEW via submit_for_review', () => {
      const result = validateContentReviewTransition('DRAFT', 'submit_for_review');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.nextStatus).toBe('PENDING_CLINICAL_REVIEW');
      }
    });
  });

  describe('invalid transitions (P0 terminal)', () => {
    it('should reject any action from PENDING_CLINICAL_REVIEW (terminal in P0)', () => {
      const result = validateContentReviewTransition('PENDING_CLINICAL_REVIEW', 'submit_for_review');
      expect(result.valid).toBe(false);
    });
  });

  describe('terminal status guard', () => {
    it('should identify PENDING_CLINICAL_REVIEW as terminal in P0 scope', () => {
      expect(isTerminalContentReviewStatus('PENDING_CLINICAL_REVIEW')).toBe(true);
      expect(isTerminalContentReviewStatus('DRAFT')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Handoff / Consent State Machine
// ---------------------------------------------------------------------------
describe('Handoff / Consent State Machine', () => {
  describe('valid happy-path transitions', () => {
    const validCases = [
      { from: 'DRAFT' as HandoffStatus, action: 'submit_for_review' as HandoffAction, expected: 'USER_REVIEW' as HandoffStatus },
      { from: 'USER_REVIEW' as HandoffStatus, action: 'grant_consent' as HandoffAction, expected: 'CONSENTED' as HandoffStatus },
      { from: 'CONSENTED' as HandoffStatus, action: 'send' as HandoffAction, expected: 'SENT' as HandoffStatus },
      { from: 'SENT' as HandoffStatus, action: 'clinician_accept' as HandoffAction, expected: 'CLINICIAN_ACCEPTED' as HandoffStatus },
      { from: 'CLINICIAN_ACCEPTED' as HandoffStatus, action: 'complete' as HandoffAction, expected: 'COMPLETED' as HandoffStatus },
    ] as const;

    it.each(validCases)(
      'should transition from $from via $action to $expected',
      ({ from, action, expected }) => {
        const result = validateHandoffTransition(from, action);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.nextStatus).toBe(expected);
        }
      }
    );
  });

  describe('decline paths', () => {
    const declineCases = [
      { from: 'DRAFT' as HandoffStatus, expected: 'DECLINED' as HandoffStatus },
      { from: 'USER_REVIEW' as HandoffStatus, expected: 'DECLINED' as HandoffStatus },
      { from: 'CONSENTED' as HandoffStatus, expected: 'DECLINED' as HandoffStatus },
      { from: 'SENT' as HandoffStatus, expected: 'DECLINED' as HandoffStatus },
      { from: 'CLINICIAN_ACCEPTED' as HandoffStatus, expected: 'DECLINED' as HandoffStatus },
    ] as const;

    it.each(declineCases)(
      'should allow decline from $from to DECLINED',
      ({ from, expected }) => {
        const result = validateHandoffTransition(from, 'decline');
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.nextStatus).toBe(expected);
        }
      }
    );
  });

  describe('terminal states cannot transition', () => {
    const terminalCases = [
      { status: 'COMPLETED' as HandoffStatus, action: 'send' as HandoffAction },
      { status: 'DECLINED' as HandoffStatus, action: 'send' as HandoffAction },
      { status: 'EXPIRED' as HandoffStatus, action: 'send' as HandoffAction },
    ] as const;

    it.each(terminalCases)(
      'should reject any action ($action) from terminal state $status',
      ({ status, action }) => {
        const result = validateHandoffTransition(status, action);
        expect(result.valid).toBe(false);
      }
    );

    it('should identify COMPLETED, DECLINED, and EXPIRED as terminal', () => {
      expect(isTerminalHandoffStatus('COMPLETED')).toBe(true);
      expect(isTerminalHandoffStatus('DECLINED')).toBe(true);
      expect(isTerminalHandoffStatus('EXPIRED')).toBe(true);
      expect(isTerminalHandoffStatus('DRAFT')).toBe(false);
      expect(isTerminalHandoffStatus('CONSENTED')).toBe(false);
    });
  });

  describe('canSendHandoff guard', () => {
    const futureDate = new Date('2099-01-01T00:00:00Z');
    const pastDate = new Date('2020-01-01T00:00:00Z');
    const now = new Date('2026-07-30T00:00:00Z');

    it('should allow send when CONSENTED with valid GRANTED consent record', () => {
      const consent: ConsentRecordForGuard = { status: 'GRANTED', expiresAt: futureDate };
      const result = canSendHandoff('CONSENTED', consent, now);
      expect(result.allowed).toBe(true);
    });

    it('should block send when status is not CONSENTED', () => {
      const consent: ConsentRecordForGuard = { status: 'GRANTED', expiresAt: futureDate };
      const result = canSendHandoff('DRAFT', consent, now);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toMatch(/CONSENTED/);
      }
    });

    it('should block send when consent is REVOKED', () => {
      const consent: ConsentRecordForGuard = { status: 'REVOKED', expiresAt: futureDate };
      const result = canSendHandoff('CONSENTED', consent, now);
      expect(result.allowed).toBe(false);
    });

    it('should block send when consent has expired', () => {
      const consent: ConsentRecordForGuard = { status: 'GRANTED', expiresAt: pastDate };
      const result = canSendHandoff('CONSENTED', consent, now);
      expect(result.allowed).toBe(false);
    });

    it('should block send when no consent record exists', () => {
      const result = canSendHandoff('CONSENTED', null, now);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Day 3 scope — reachable transitions', () => {
    it('should transition DRAFT → USER_REVIEW via submit_for_review', () => {
      const result = validateHandoffTransition('DRAFT', 'submit_for_review');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.nextStatus).toBe('USER_REVIEW');
      }
    });

    // NOTE: USER_REVIEW → CONSENTED (grant_consent) transition is defined in
    // the state machine but is NOT reachable through the Day 3 API.
    // No consent endpoint exists in Day 3 scope. This transition will be
    // activated when the consent endpoint is built in a later phase.
    it('USER_REVIEW → CONSENTED transition exists in state machine but is not reachable via Day 3 API', () => {
      const result = validateHandoffTransition('USER_REVIEW', 'grant_consent');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.nextStatus).toBe('CONSENTED');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Care-Plan Versioning State Machine
// ---------------------------------------------------------------------------
describe('Care-Plan Versioning State Machine', () => {
  describe('valid approval flow', () => {
    const approvalFlow = [
      { from: 'DRAFT' as CarePlanStatus, action: 'propose' as CarePlanAction, expected: 'PROPOSED' as CarePlanStatus },
      { from: 'PROPOSED' as CarePlanStatus, action: 'approve' as CarePlanAction, expected: 'CLINICIAN_APPROVED' as CarePlanStatus },
      { from: 'CLINICIAN_APPROVED' as CarePlanStatus, action: 'accept' as CarePlanAction, expected: 'USER_ACCEPTED' as CarePlanStatus },
      { from: 'USER_ACCEPTED' as CarePlanStatus, action: 'activate' as CarePlanAction, expected: 'ACTIVE' as CarePlanStatus },
    ] as const;

    it.each(approvalFlow)(
      'should transition from $from via $action to $expected',
      ({ from, action, expected }) => {
        const result = validateCarePlanTransition(from, action);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.nextStatus).toBe(expected);
        }
      }
    );
  });

  describe('version 2 revision flow', () => {
    it('should allow ACTIVE → REVISED → PROPOSED (new version cycle)', () => {
      const r1 = validateCarePlanTransition('ACTIVE', 'revise');
      expect(r1.valid).toBe(true);
      if (r1.valid) {
        expect(r1.nextStatus).toBe('REVISED');
      }

      const r2 = validateCarePlanTransition('REVISED', 'propose');
      expect(r2.valid).toBe(true);
      if (r2.valid) {
        expect(r2.nextStatus).toBe('PROPOSED');
      }
    });
  });

  describe('terminal RETIRED cannot transition', () => {
    it('should reject all actions from RETIRED', () => {
      const actions: CarePlanAction[] = ['propose', 'approve', 'accept', 'activate', 'pause', 'revise', 'complete', 'resume'];
      for (const action of actions) {
        const result = validateCarePlanTransition('RETIRED', action);
        expect(result.valid).toBe(false);
      }
    });

    it('should identify RETIRED as terminal', () => {
      expect(isTerminalCarePlanStatus('RETIRED')).toBe(true);
      expect(isTerminalCarePlanStatus('ACTIVE')).toBe(false);
      expect(isTerminalCarePlanStatus('DRAFT')).toBe(false);
    });
  });

  describe('canAiModifyCarePlan guard', () => {
    it('should block AI modification of ACTIVE care plan', () => {
      const result = canAiModifyCarePlan('ACTIVE');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toMatch(/ACTIVE/);
      }
    });

    it('should allow AI modification of non-ACTIVE care plans', () => {
      expect(canAiModifyCarePlan('DRAFT').allowed).toBe(true);
      expect(canAiModifyCarePlan('PROPOSED').allowed).toBe(true);
      expect(canAiModifyCarePlan('REVISED').allowed).toBe(true);
    });
  });

  describe('canApproveCarePlan guard', () => {
    it('should allow approval only for clinician role', () => {
      const clinicianResult = canApproveCarePlan('clinician');
      expect(clinicianResult.allowed).toBe(true);
    });

    it('should reject approval for non-clinician roles', () => {
      const aiResult = canApproveCarePlan('ai');
      expect(aiResult.allowed).toBe(false);

      const userResult = canApproveCarePlan('user');
      expect(userResult.allowed).toBe(false);

      const adminResult = canApproveCarePlan('admin');
      expect(adminResult.allowed).toBe(false);
    });
  });
});
