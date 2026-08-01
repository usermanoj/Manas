import { test, expect } from '@playwright/test';

/**
 * Day 4 — Care Plan V1 Creation and Activation E2E Flow
 *
 * Covers the clinician creating a care plan from a SENT handoff,
 * proposing it, approving it, and the user accepting it.
 * Requires: MANAS_PERSISTENCE=memory, MANAS_DEMO_MODE=true, MANAS_AI_PROVIDER=mock
 */
test.describe('Day 4: Care Plan V1 Flow', () => {
  test.use({
    baseURL: 'http://localhost:3000',
  });

  /**
   * Seed a SENT handoff via API so the clinician inbox has data.
   */
  async function seedSentHandoff(request: import('@playwright/test').APIRequestContext): Promise<string> {
    // Step 1: Create a DRAFT handoff
    const createRes = await request.post('/api/handoffs', {
      data: {
        providerId: 'provider-dr-maya-rao',
        structuredSummary: {
          primary_concern: 'Work-related stress and burnout',
          concern_duration: 'months',
          sleep_impact: 'mild',
          daily_functioning_impact: 'mild',
          support_preference: 'professional_support',
          feels_safe: 'yes',
          key_points: [
            'Feeling overwhelmed with workload',
            'Difficulty switching off in the evenings',
          ],
        },
        excludedEntries: ['Personal relationship details'],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    const handoffId = created.id as string;

    // Step 2: Submit for review (DRAFT → USER_REVIEW)
    const submitRes = await request.post(`/api/handoffs/${handoffId}/submit-for-review`, {
      data: {},
    });
    expect(submitRes.ok()).toBeTruthy();

    // Step 3: Consent and send (USER_REVIEW → SENT)
    const sendRes = await request.post(`/api/handoffs/${handoffId}/consent-and-send`, {
      data: {
        explicitConsent: true,
        consentVersion: 'consent-v1',
        previewHash: 'sha256-test-seed-hash',
      },
    });
    expect(sendRes.ok()).toBeTruthy();

    return handoffId;
  }

  test('creates V1 care plan from SENT handoff through to user acceptance', async ({ page, request }) => {
    test.setTimeout(120_000);

    // -----------------------------------------------------------------------
    // 1. Seed a SENT handoff
    // -----------------------------------------------------------------------
    await seedSentHandoff(request);

    // -----------------------------------------------------------------------
    // 2. Navigate to clinician inbox
    // -----------------------------------------------------------------------
    await page.goto('/clinician');

    // Verify fictional-workspace banner
    await expect(page.locator('text=Fictional clinician workspace')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 3. Verify SENT handoff appears in inbox
    // -----------------------------------------------------------------------
    await expect(page.locator('text=SENT')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Primary concern:')).toBeVisible();

    // -----------------------------------------------------------------------
    // 4. Click "Create Care Plan" → navigates to care-plan workspace
    // -----------------------------------------------------------------------
    await page.getByRole('link', { name: /create care plan/i }).click();
    await page.waitForURL('**/clinician/care-plan**', { timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 5. Verify handoff summary is displayed (read-only)
    // -----------------------------------------------------------------------
    await expect(page.locator('text=Handoff Summary (read-only)')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 6. Verify the care plan creation form is shown
    // -----------------------------------------------------------------------
    await expect(page.locator('text=Create Care Plan')).toBeVisible();

    // Goals are pre-filled — verify they're visible
    await expect(page.locator('input[placeholder="Goal title"]').first()).toBeVisible();

    // Frequency dropdown should be visible
    await expect(page.locator('text=Check-in Frequency')).toBeVisible();

    // Boundaries textarea should be visible
    await expect(page.locator('text=Boundaries (one per line)')).toBeVisible();

    // -----------------------------------------------------------------------
    // 7. Click "Create Care Plan"
    // -----------------------------------------------------------------------
    await page.getByRole('button', { name: /^Create Care Plan$/ }).click();

    // Wait for success message
    await expect(page.locator('text=Care plan created successfully')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 8. Verify care plan is in DRAFT — click "Propose"
    // -----------------------------------------------------------------------
    await expect(page.locator('text=DRAFT')).toBeVisible();

    const proposeBtn = page.getByRole('button', { name: /^Propose$/ });
    await expect(proposeBtn).toBeVisible();
    await proposeBtn.click();

    await expect(page.locator('text=Action "propose" completed successfully')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 9. Click "Approve"
    // -----------------------------------------------------------------------
    const approveBtn = page.getByRole('button', { name: /^Approve$/ });
    await expect(approveBtn).toBeVisible({ timeout: 10_000 });
    await approveBtn.click();

    await expect(page.locator('text=Action "approve" completed successfully')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 10. Navigate to user care-plan page (/care-plan)
    // -----------------------------------------------------------------------
    await page.goto('/care-plan');

    // Wait for care plan details to load
    await expect(page.locator('text=My Care Plan')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 11. Verify "Demo Care-Plan Twin" banner is visible
    // -----------------------------------------------------------------------
    await expect(page.locator('text=Demo Care-Plan Twin')).toBeVisible();

    // -----------------------------------------------------------------------
    // 12. Verify care plan details are displayed (goals, modules, frequency)
    // -----------------------------------------------------------------------
    await expect(page.locator('text=Goals:')).toBeVisible();
    await expect(page.locator('text=Assigned Modules:')).toBeVisible();
    await expect(page.locator('text=Check-in Frequency:')).toBeVisible();

    // -----------------------------------------------------------------------
    // 13. Click "Accept Plan"
    // -----------------------------------------------------------------------
    const acceptBtn = page.getByRole('button', { name: /accept plan/i });
    await expect(acceptBtn).toBeVisible({ timeout: 10_000 });
    await acceptBtn.click();

    // Wait for success message
    await expect(page.locator('text=Care plan accepted and activated')).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 14. Verify plan shows as ACTIVE
    // -----------------------------------------------------------------------
    await expect(page.locator('text=ACTIVE')).toBeVisible({ timeout: 10_000 });
  });
});
