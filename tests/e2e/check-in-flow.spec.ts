import { test, expect } from '@playwright/test';

test.describe('Check-in E2E Flow', () => {
  test.use({
    baseURL: 'http://localhost:3000',
  });

  test('completes full check-in to confirmed summary flow', async ({ page }) => {
    // Set longer timeout for the full flow (API calls + navigation)
    test.setTimeout(60_000);

    // -----------------------------------------------------------------------
    // 1. Navigate to landing page
    // -----------------------------------------------------------------------
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // -----------------------------------------------------------------------
    // 2. Click CTA to navigate to /check-in
    // -----------------------------------------------------------------------
    await page.getByRole('link', { name: /begin check-in/i }).click();
    await page.waitForURL('**/check-in');

    // -----------------------------------------------------------------------
    // 3. On /check-in: Click "Begin Check-In" to start the session
    // -----------------------------------------------------------------------
    const beginBtn = page.getByTestId('begin-check-in');
    await expect(beginBtn).toBeVisible();
    await beginBtn.click();

    // Wait for step 1 to appear (progress bar shows Step 1)
    const progress = page.getByTestId('step-progress');
    await expect(progress).toBeVisible({ timeout: 10_000 });
    await expect(progress).toContainText('Step 1 of 6');

    // -----------------------------------------------------------------------
    // 4. Step 1: Type a primary concern and submit
    // -----------------------------------------------------------------------
    const concernInput = page.getByTestId('primary-concern-input');
    await expect(concernInput).toBeVisible();
    await concernInput.fill('I have been feeling overwhelmed with work deadlines and unable to sleep well.');

    const submitBtn = page.getByTestId('primary-concern-submit');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // -----------------------------------------------------------------------
    // 5. Wait for AI response to appear
    // -----------------------------------------------------------------------
    // The mock provider should respond quickly.
    // Wait for the AI response bubble to appear, then for Next to be enabled.
    const aiResponse = page.getByTestId('ai-response');
    await expect(aiResponse).toBeVisible({ timeout: 15_000 });

    const nextBtn = page.getByTestId('next-step');
    await expect(nextBtn).toBeEnabled();

    // -----------------------------------------------------------------------
    // 6. Step 2: Select "A few weeks" duration
    // -----------------------------------------------------------------------
    await nextBtn.click();
    await expect(progress).toContainText('Step 2 of 6');

    const durationOption = page.getByTestId('option-duration-weeks');
    await expect(durationOption).toBeVisible();
    await durationOption.click();

    // -----------------------------------------------------------------------
    // 7. Step 3: Select "Mild impact" sleep
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 3 of 6');

    const sleepOption = page.getByTestId('option-sleep_impact-mild');
    await expect(sleepOption).toBeVisible();
    await sleepOption.click();

    // -----------------------------------------------------------------------
    // 8. Step 4: Select "Mild impact" functioning
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 4 of 6');

    const functioningOption = page.getByTestId('option-daily_functioning_impact-mild');
    await expect(functioningOption).toBeVisible();
    await functioningOption.click();

    // -----------------------------------------------------------------------
    // 9. Step 5: Select "Professional support"
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 5 of 6');

    const supportOption = page.getByTestId('option-support_preference-professional_support');
    await expect(supportOption).toBeVisible();
    await supportOption.click();

    // -----------------------------------------------------------------------
    // 10. Step 6: Select "Yes" for safety
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 6 of 6');

    const safetyOption = page.getByTestId('option-safety_response-yes');
    await expect(safetyOption).toBeVisible();
    await safetyOption.click();

    // -----------------------------------------------------------------------
    // 11. Complete the check-in → should navigate to /summary
    // -----------------------------------------------------------------------
    const completeBtn = page.getByTestId('complete-check-in');
    await expect(completeBtn).toBeEnabled();
    await completeBtn.click();

    // Wait for navigation to /summary
    await page.waitForURL('**/summary**', { timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 12. On /summary: Verify draft summary is displayed
    // -----------------------------------------------------------------------
    const draftSummary = page.getByTestId('draft-summary');
    await expect(draftSummary).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 13. Optionally edit a field — change sleep impact to "No impact"
    // -----------------------------------------------------------------------
    const sleepField = page.getByTestId('field-sleep_impact');
    await expect(sleepField).toBeVisible();
    // Select "No impact" radio within the sleep impact field
    await sleepField.getByLabel('No impact').click();

    // -----------------------------------------------------------------------
    // 14. Click "Confirm Summary"
    // -----------------------------------------------------------------------
    const confirmBtn = page.getByTestId('confirm-summary');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // -----------------------------------------------------------------------
    // 15. Verify confirmed summary and final routing result
    // -----------------------------------------------------------------------
    const confirmedSummary = page.getByTestId('confirmed-summary');
    await expect(confirmedSummary).toBeVisible({ timeout: 15_000 });

    // Verify the routing result is displayed
    const finalRouting = page.getByTestId('final-routing');
    await expect(finalRouting).toBeVisible();

    // Verify the routing state contains text
    const routingState = page.getByTestId('routing-state');
    await expect(routingState).toBeVisible();
    await expect(routingState).not.toBeEmpty();
  });
});
