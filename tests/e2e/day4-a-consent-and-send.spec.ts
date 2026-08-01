import { test, expect } from '@playwright/test';

/**
 * Day 4 — Consent-and-Send E2E Flow
 *
 * Covers the full path from check-in through handoff consent-and-send.
 * Requires: MANAS_PERSISTENCE=memory, MANAS_DEMO_MODE=true, MANAS_AI_PROVIDER=mock
 */
test.describe('Day 4: Consent-and-Send Flow', () => {
  test.use({
    baseURL: 'http://localhost:3000',
  });

  test('completes check-in → summary → handoff → consent-and-send', async ({ page }) => {
    test.setTimeout(120_000);

    // -----------------------------------------------------------------------
    // 1. Navigate to landing page
    // -----------------------------------------------------------------------
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // -----------------------------------------------------------------------
    // 2. Start check-in flow
    // -----------------------------------------------------------------------
    await page.getByRole('link', { name: /begin check-in/i }).click();
    await page.waitForURL('**/check-in');

    const beginBtn = page.getByTestId('begin-check-in');
    await expect(beginBtn).toBeVisible();
    await beginBtn.click();

    const progress = page.getByTestId('step-progress');
    await expect(progress).toBeVisible({ timeout: 10_000 });
    await expect(progress).toContainText('Step 1 of 6');

    // -----------------------------------------------------------------------
    // 3. Step 1: Primary concern
    // -----------------------------------------------------------------------
    const concernInput = page.getByTestId('primary-concern-input');
    await expect(concernInput).toBeVisible();
    await concernInput.fill('I have been feeling overwhelmed with work deadlines and unable to sleep well.');

    const submitBtn = page.getByTestId('primary-concern-submit');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for AI response
    const aiResponse = page.getByTestId('ai-response');
    await expect(aiResponse).toBeVisible({ timeout: 15_000 });

    const nextBtn = page.getByTestId('next-step');
    await expect(nextBtn).toBeEnabled();

    // -----------------------------------------------------------------------
    // 4. Step 2: Duration — "A few weeks"
    // -----------------------------------------------------------------------
    await nextBtn.click();
    await expect(progress).toContainText('Step 2 of 6');

    await page.getByTestId('option-duration-weeks').click();

    // -----------------------------------------------------------------------
    // 5. Step 3: Sleep impact — "Mild impact"
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 3 of 6');

    await page.getByTestId('option-sleep_impact-mild').click();

    // -----------------------------------------------------------------------
    // 6. Step 4: Daily functioning — "Mild impact"
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 4 of 6');

    await page.getByTestId('option-daily_functioning_impact-mild').click();

    // -----------------------------------------------------------------------
    // 7. Step 5: Support preference — "Professional support"
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 5 of 6');

    await page.getByTestId('option-support_preference-professional_support').click();

    // -----------------------------------------------------------------------
    // 8. Step 6: Safety — "Yes"
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 6 of 6');

    await page.getByTestId('option-safety_response-yes').click();

    // -----------------------------------------------------------------------
    // 9. Complete check-in → navigate to /summary
    // -----------------------------------------------------------------------
    const completeBtn = page.getByTestId('complete-check-in');
    await expect(completeBtn).toBeEnabled();
    await completeBtn.click();

    await page.waitForURL('**/summary**', { timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 10. Confirm the summary (no edits needed)
    // -----------------------------------------------------------------------
    const draftSummary = page.getByTestId('draft-summary');
    await expect(draftSummary).toBeVisible({ timeout: 15_000 });

    const confirmBtn = page.getByTestId('confirm-summary');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Wait for confirmed summary
    const confirmedSummary = page.getByTestId('confirmed-summary');
    await expect(confirmedSummary).toBeVisible({ timeout: 15_000 });

    // Verify routing result is displayed
    const finalRouting = page.getByTestId('final-routing');
    await expect(finalRouting).toBeVisible();

    // -----------------------------------------------------------------------
    // 11. Navigate to /professionals page
    // -----------------------------------------------------------------------
    await page.goto('/professionals');
    await expect(page.locator('h1')).toContainText('Professionals', { timeout: 10_000 });

    // -----------------------------------------------------------------------
    // 12. Navigate to /handoff page
    // -----------------------------------------------------------------------
    await page.goto('/handoff');

    // Wait for the handoff to load (it auto-creates a DRAFT)
    await page.waitForSelector('text=Your Check-in Summary', { timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 13. Verify structured summary is displayed
    // -----------------------------------------------------------------------
    await expect(page.locator('text=Primary concern')).toBeVisible();
    await expect(page.locator('text=Duration')).toBeVisible();
    await expect(page.locator('text=Sleep impact')).toBeVisible();

    // -----------------------------------------------------------------------
    // 14. Verify fictional provider badge
    // -----------------------------------------------------------------------
    await expect(page.locator('text=Fictional Provider')).toBeVisible();

    // -----------------------------------------------------------------------
    // 15. Verify consent checkbox and wording
    // -----------------------------------------------------------------------
    const consentCheckbox = page.locator('#consent-checkbox');
    await expect(consentCheckbox).toBeVisible();

    // Verify consent label mentions the provider and fictional workspace
    const consentLabel = page.locator('label[for="consent-checkbox"]');
    await expect(consentLabel).toContainText('I understand and agree to share');
    await expect(consentLabel).toContainText('fictional demonstration workspace');

    // -----------------------------------------------------------------------
    // 16. Verify Send button is disabled before consent
    // -----------------------------------------------------------------------
    const sendBtn = page.getByRole('button', { name: /send handoff/i });
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();

    // -----------------------------------------------------------------------
    // 17. Check consent → Send button becomes enabled
    // -----------------------------------------------------------------------
    await consentCheckbox.check();
    await expect(sendBtn).toBeEnabled();

    // -----------------------------------------------------------------------
    // 18. Click Send → verify confirmation message
    // -----------------------------------------------------------------------
    await sendBtn.click();

    // Wait for SENT confirmation
    const sentBadge = page.locator('text=SENT');
    await expect(sentBadge).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('text=read-only and immutable')).toBeVisible();

    // -----------------------------------------------------------------------
    // 19. Verify consent section is hidden after send
    // -----------------------------------------------------------------------
    await expect(page.locator('#consent-checkbox')).not.toBeVisible();

    // -----------------------------------------------------------------------
    // 20. Navigate back to /handoff → verify still SENT (idempotent)
    // -----------------------------------------------------------------------
    await page.goto('/handoff');
    await page.waitForSelector('text=SENT', { timeout: 15_000 });
    await expect(page.locator('text=read-only and immutable')).toBeVisible();
  });
});
