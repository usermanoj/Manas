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

  test('completes Day 3 extended journey', async ({ page }) => {
    // Extended journey timeout
    test.setTimeout(120_000);

    // -----------------------------------------------------------------------
    // 1. Landing page
    // -----------------------------------------------------------------------
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // -----------------------------------------------------------------------
    // 2. Navigate to /check-in and begin the flow
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
    await concernInput.fill('Work stress and sleep issues');

    const submitBtn = page.getByTestId('primary-concern-submit');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for AI response
    const aiResponse = page.getByTestId('ai-response');
    await expect(aiResponse).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 4. Step 2: Duration
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 2 of 6');

    await expect(page.getByTestId('option-duration-weeks')).toBeVisible();
    await page.getByTestId('option-duration-weeks').click();

    // -----------------------------------------------------------------------
    // 5. Step 3: Sleep impact
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 3 of 6');

    await expect(page.getByTestId('option-sleep_impact-mild')).toBeVisible();
    await page.getByTestId('option-sleep_impact-mild').click();

    // -----------------------------------------------------------------------
    // 6. Step 4: Daily functioning
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 4 of 6');

    await expect(page.getByTestId('option-daily_functioning_impact-mild')).toBeVisible();
    await page.getByTestId('option-daily_functioning_impact-mild').click();

    // -----------------------------------------------------------------------
    // 7. Step 5: Support preference
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 5 of 6');

    await expect(page.getByTestId('option-support_preference-professional_support')).toBeVisible();
    await page.getByTestId('option-support_preference-professional_support').click();

    // -----------------------------------------------------------------------
    // 8. Step 6: Safety
    // -----------------------------------------------------------------------
    await page.getByTestId('next-step').click();
    await expect(progress).toContainText('Step 6 of 6');

    await expect(page.getByTestId('option-safety_response-yes')).toBeVisible();
    await page.getByTestId('option-safety_response-yes').click();

    // -----------------------------------------------------------------------
    // 9. Complete check-in -> /summary
    // -----------------------------------------------------------------------
    const completeBtn = page.getByTestId('complete-check-in');
    await expect(completeBtn).toBeEnabled();
    await completeBtn.click();

    await page.waitForURL('**/summary**', { timeout: 15_000 });

    const draftSummary = page.getByTestId('draft-summary');
    await expect(draftSummary).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 10. Edit and confirm summary
    // -----------------------------------------------------------------------
    const sleepField = page.getByTestId('field-sleep_impact');
    await expect(sleepField).toBeVisible();
    await sleepField.getByLabel('No impact').click();

    const confirmBtn = page.getByTestId('confirm-summary');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // -----------------------------------------------------------------------
    // 11. Verify confirmed summary and routing result
    // -----------------------------------------------------------------------
    const confirmedSummary = page.getByTestId('confirmed-summary');
    await expect(confirmedSummary).toBeVisible({ timeout: 15_000 });

    const finalRouting = page.getByTestId('final-routing');
    await expect(finalRouting).toBeVisible();

    const routingState = page.getByTestId('routing-state');
    await expect(routingState).toBeVisible();
    await expect(routingState).not.toBeEmpty();

    // -----------------------------------------------------------------------
    // 12. Set sessionStorage for gated pages before navigating
    // -----------------------------------------------------------------------
    const confirmedSummaryData = JSON.stringify({
      primary_concern: 'Work stress and sleep issues',
      concern_duration: 'weeks',
      sleep_impact: 'none',
      daily_functioning_impact: 'mild',
      support_preference: 'professional_support',
      feels_safe: 'yes',
      key_points: ['Difficulty sleeping', 'Work-related stress'],
    });
    await page.evaluate((data) => {
      sessionStorage.setItem('manas-confirmed-summary', data);
    }, confirmedSummaryData);

    // -----------------------------------------------------------------------
    // 13. Pause and Reflect module (skip it)
    // -----------------------------------------------------------------------
    await page.goto('/module/pause-reflect');
    await page.waitForURL('**/module/pause-reflect');

    // Wait for the wizard to load (progress bar with step count)
    await expect(page.getByText('1 / 3')).toBeVisible({ timeout: 10_000 });

    // Click Skip to bypass the module
    const skipBtn = page.getByTestId('skip-module');
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();

    // Wait for the done state
    const moduleDone = page.getByTestId('module-done');
    await expect(moduleDone).toBeVisible({ timeout: 10_000 });
    await expect(moduleDone).toContainText('Exercise Skipped');

    // Click "Continue to Professionals"
    const continueProfessionals = page.getByTestId('continue-professionals');
    await expect(continueProfessionals).toBeVisible();
    await continueProfessionals.click();

    // -----------------------------------------------------------------------
    // 14. Professionals page
    // -----------------------------------------------------------------------
    await page.waitForURL('**/professionals');

    // Wait for provider cards to load
    await expect(page.getByText('Dr. Maya Rao')).toBeVisible({ timeout: 15_000 });

    // Test client-side filter: select a focus area via the filter section
    const filtersSection = page.locator('h3', { hasText: 'Filters' }).locator('..');
    const anxietyFilter = filtersSection.locator('label').filter({ hasText: /^anxiety$/ });
    await expect(anxietyFilter).toBeVisible({ timeout: 5_000 });
    await anxietyFilter.click();

    // Verify filtered count text appears
    await expect(page.getByText(/Showing \d+ of \d+ profiles/)).toBeVisible({ timeout: 5_000 });

    // Clear the filter to see all providers again
    await anxietyFilter.click();

    // View details for Dr. Maya Rao
    const viewDetailsBtn = page.locator('button', { hasText: 'View details' }).first();
    await expect(viewDetailsBtn).toBeVisible();
    await viewDetailsBtn.click();

    // Wait for detail modal
    const detailModal = page.locator('[role="dialog"]');
    await expect(detailModal).toBeVisible({ timeout: 5_000 });
    await expect(detailModal).toContainText('Dr. Maya Rao');

    // Select provider from detail modal
    const selectInDetail = detailModal.getByRole('button', { name: 'Select this provider' });
    await expect(selectInDetail).toBeVisible();
    await selectInDetail.click();

    // -----------------------------------------------------------------------
    // 15. Handoff page - multi-step wizard
    // -----------------------------------------------------------------------
    await page.waitForURL('**/handoff');

    // Step: review_provider - verify provider name is shown
    await expect(page.getByRole('heading', { name: 'Review Provider' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Dr. Maya Rao' })).toBeVisible();

    // Click Continue to advance to edit_fields
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step: edit_fields
    await expect(page.getByRole('heading', { name: 'Edit Fields' })).toBeVisible({ timeout: 5_000 });
    // Edit primary concern
    const primaryConcernInput = page.locator('input[type="text"]').first();
    await expect(primaryConcernInput).toBeVisible();
    await primaryConcernInput.fill('Updated: Work stress and insomnia');

    // Click Continue to advance to exclude_fields
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step: exclude_fields - "feels_safe" is excluded by default
    await expect(page.getByRole('heading', { name: 'Choose What to Share' })).toBeVisible({ timeout: 5_000 });
    // The "Safety response" checkbox should be unchecked (excluded by default)
    // Let's also exclude "key_points" by clicking on it
    await page.getByText('Key points').click();

    // Click Continue to advance to add_note
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step: add_note
    await expect(page.getByRole('heading', { name: 'Add a Note' })).toBeVisible({ timeout: 5_000 });
    const noteTextarea = page.locator('textarea');
    await expect(noteTextarea).toBeVisible();
    await noteTextarea.fill('Please focus on sleep hygiene strategies.');

    // Click Continue to advance to preview
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step: preview
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible({ timeout: 5_000 });
    // Verify excluded fields show as "Excluded"
    await expect(page.getByText('Key points').locator('..').getByText('Excluded')).toBeVisible({ timeout: 5_000 });

    // Click Continue to advance to save_draft
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step: save_draft
    await expect(page.getByRole('heading', { name: 'Save Draft' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Provider:').locator('span').filter({ hasText: 'Dr. Maya Rao' })).toBeVisible();

    // Click Save Draft — after saving, the page auto-advances to 'submitted' step
    const saveDraftBtn = page.getByRole('button', { name: 'Save Draft' });
    await expect(saveDraftBtn).toBeEnabled();
    await saveDraftBtn.click();

    // -----------------------------------------------------------------------
    // 16. Verify handoff submitted state
    // -----------------------------------------------------------------------
    // After saving draft, the wizard advances to 'submitted' which shows confirmation
    await expect(page.getByRole('heading', { name: 'Handoff Ready for Review' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/submitted for review/i)).toBeVisible();
  });
});
