import { test, expect } from '@playwright/test';

/**
 * Day 4 — Care Plan V2 Revision, Comparison, and Activation E2E Flow
 *
 * Covers creating a V2 revision from an ACTIVE V1 care plan,
 * V1/V2 side-by-side comparison, user acceptance, and audit timeline.
 * Requires: MANAS_PERSISTENCE=memory, MANAS_DEMO_MODE=true, MANAS_AI_PROVIDER=mock
 */
test.describe('Day 4: Care Plan V2 Revision Flow', () => {
  test.use({
    baseURL: 'http://localhost:3000',
  });

  /**
   * Seed an ACTIVE V1 care plan via API:
   * 1. Create SENT handoff
   * 2. Create care plan from handoff
   * 3. Propose → Approve → Accept (→ ACTIVE V1)
   */
  async function seedActiveV1CarePlan(
    request: import('@playwright/test').APIRequestContext,
  ): Promise<{ handoffId: string; carePlanId: string }> {
    // Step 1: Create and send a handoff
    const createHandoffRes = await request.post('/api/handoffs', {
      data: {
        providerId: 'provider-dr-maya-rao',
        structuredSummary: {
          primary_concern: 'Work-related stress and burnout',
          concern_duration: 'months',
          sleep_impact: 'mild',
          daily_functioning_impact: 'mild',
          support_preference: 'professional_support',
          feels_safe: 'yes',
          key_points: ['Feeling overwhelmed with workload'],
        },
        excludedEntries: [],
      },
    });
    expect(createHandoffRes.ok()).toBeTruthy();
    const { id: handoffId } = await createHandoffRes.json();

    await request.post(`/api/handoffs/${handoffId}/submit-for-review`, { data: {} });
    await request.post(`/api/handoffs/${handoffId}/consent-and-send`, {
      data: {
        explicitConsent: true,
        consentVersion: 'consent-v1',
        previewHash: 'sha256-v2-test-hash',
      },
    });

    // Step 2: Create care plan V1
    const createCpRes = await request.post('/api/care-plans', {
      data: {
        handoffId,
        goals: ['Build emotional awareness', 'Develop coping strategies'],
        assignedModuleIds: ['module-pause-reflect'],
        checkInFrequency: 'twice_per_week',
        boundaries: ['AI acts as facilitator only', 'Weekly clinician review'],
      },
    });
    expect(createCpRes.ok()).toBeTruthy();
    const cpData = await createCpRes.json();
    const carePlanId = cpData.carePlan.id as string;

    // Step 3: Propose → Approve → Accept
    await request.post(`/api/care-plans/${carePlanId}/transition`, {
      data: { action: 'propose' },
    });
    await request.post(`/api/care-plans/${carePlanId}/transition`, {
      data: { action: 'approve' },
    });
    await request.post(`/api/care-plans/${carePlanId}/transition`, {
      data: { action: 'accept' },
    });

    return { handoffId, carePlanId };
  }

  test('revises V1 → V2, compares, accepts V2, verifies audit trail', async ({ page, request }) => {
    test.setTimeout(120_000);

    // -----------------------------------------------------------------------
    // 1. Seed an ACTIVE V1 care plan
    // -----------------------------------------------------------------------
    const { handoffId } = await seedActiveV1CarePlan(request);

    // -----------------------------------------------------------------------
    // 2. Navigate to clinician care-plan page (with handoffId for context)
    // -----------------------------------------------------------------------
    await page.goto(`/clinician/care-plan?handoffId=${handoffId}`);

    // Wait for care plan to load
    await expect(page.locator('text=Care Plan Workspace')).toBeVisible({ timeout: 15_000 });

    // Verify the care plan is ACTIVE
    await expect(page.locator('text=ACTIVE')).toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // 3. Click "Revise Plan" button
    // -----------------------------------------------------------------------
    const reviseBtn = page.getByRole('button', { name: /revise plan/i });
    await expect(reviseBtn).toBeVisible({ timeout: 10_000 });
    await reviseBtn.click();

    // Verify revision form appears
    await expect(page.locator('text=Revise Active Plan')).toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // 4. Modify goals in the revision form — add a new goal
    // -----------------------------------------------------------------------
    const addGoalBtn = page.getByRole('button', { name: /add goal/i });
    await addGoalBtn.click();

    // Fill in the new goal title
    const goalInputs = page.locator('input[placeholder="Goal title"]');
    const newGoalInput = goalInputs.last();
    await newGoalInput.fill('Explore support-group participation');

    // Change frequency
    const freqSelect = page.locator('select').last();
    await freqSelect.selectOption('weekly');

    // -----------------------------------------------------------------------
    // 5. Submit revision → V2 created
    // -----------------------------------------------------------------------
    await page.getByRole('button', { name: /create revision/i }).click();

    await expect(page.locator('text=Revision created')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 6. Click "Propose V2"
    // -----------------------------------------------------------------------
    const proposeV2Btn = page.getByRole('button', { name: /propose v2/i });
    await expect(proposeV2Btn).toBeVisible({ timeout: 10_000 });
    await proposeV2Btn.click();

    await expect(page.locator('text=Action "propose" completed successfully')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 7. Click "Approve V2"
    // -----------------------------------------------------------------------
    const approveV2Btn = page.getByRole('button', { name: /approve v2/i });
    await expect(approveV2Btn).toBeVisible({ timeout: 10_000 });
    await approveV2Btn.click();

    await expect(page.locator('text=Action "approve" completed successfully')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 8. Navigate to user care-plan page
    // -----------------------------------------------------------------------
    await page.goto('/care-plan');
    await expect(page.locator('text=My Care Plan')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 9. Verify V1/V2 side-by-side comparison is shown
    // -----------------------------------------------------------------------
    await expect(page.locator('text=Version Comparison')).toBeVisible({ timeout: 15_000 });

    // Verify both versions are visible
    await expect(page.locator('text=Version 1')).toBeVisible();
    await expect(page.locator('text=Version 2')).toBeVisible();

    // -----------------------------------------------------------------------
    // 10. Verify changed fields are highlighted
    // -----------------------------------------------------------------------
    // Frequency should show as changed (green highlight class)
    await expect(page.locator('text=(changed)')).toBeVisible();

    // New goal should show as new
    await expect(page.locator('text=(new)')).toBeVisible();

    // -----------------------------------------------------------------------
    // 11. Click "Accept Revised Plan"
    // -----------------------------------------------------------------------
    const acceptRevisedBtn = page.getByRole('button', { name: /accept revised plan/i });
    await expect(acceptRevisedBtn).toBeVisible({ timeout: 10_000 });
    await acceptRevisedBtn.click();

    await expect(page.locator('text=Care plan accepted and activated')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 12. Verify V2 shows as ACTIVE
    // -----------------------------------------------------------------------
    await expect(page.locator('text=ACTIVE')).toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // 13. Navigate to privacy page → verify audit timeline
    // -----------------------------------------------------------------------
    await page.goto('/privacy');
    await expect(page.locator('text=Privacy')).toBeVisible({ timeout: 15_000 });

    // Verify audit timeline has events
    await expect(page.locator('text=Audit Timeline')).toBeVisible();

    // Verify care plan related events exist
    await expect(page.locator('text=Care plan')).toBeVisible({ timeout: 10_000 });
  });
});
