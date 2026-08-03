import { test, expect } from '@playwright/test';

test.describe('Check-in E2E Flow', () => {
  test.use({
    baseURL: 'http://localhost:3000',
  });

  test('completes chat-style check-in to confirmed summary flow', async ({ page }) => {
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

    // Wait for the chat interface to appear
    const chatInput = page.getByTestId('chat-input');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // 4. Send a primary concern message
    // -----------------------------------------------------------------------
    await chatInput.fill('I have been feeling overwhelmed with work deadlines and unable to sleep well.');

    const sendBtn = page.getByTestId('chat-submit');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // -----------------------------------------------------------------------
    // 5. Wait for AI response to appear with techniques or symptoms
    // -----------------------------------------------------------------------
    const aiResponse = page.getByTestId('ai-response');
    await expect(aiResponse).toBeVisible({ timeout: 15_000 });
    await expect(aiResponse).not.toBeEmpty();

    // -----------------------------------------------------------------------
    // 6. Answer a follow-up question to complete structured fields
    // -----------------------------------------------------------------------
    await chatInput.fill('It has been going on for a few weeks. My sleep is mildly affected, daily routine has mild impact, and I am looking for self-reflection exercises. I feel safe.');
    await sendBtn.click();

    // Wait for the second AI response
    await expect(page.getByTestId('ai-response').nth(1)).toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 7. Complete the check-in → should navigate to /summary
    // -----------------------------------------------------------------------
    const completeBtn = page.getByTestId('complete-check-in');
    await expect(completeBtn).toBeEnabled({ timeout: 10_000 });
    await completeBtn.click();

    // Wait for navigation to /summary
    await page.waitForURL('**/summary**', { timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 12. On /summary: Verify draft summary is displayed
    // -----------------------------------------------------------------------
    const draftSummary = page.getByTestId('draft-summary');
    await expect(draftSummary).toBeVisible({ timeout: 15_000 });

    // Verify sources / citations panel (Phase 3 enhancement)
    const sourcesPanel = page.getByTestId('sources-panel');
    await expect(sourcesPanel).toBeVisible({ timeout: 10_000 });

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

    // Sources panel remains visible on confirmed summary
    await expect(page.getByTestId('sources-panel')).toBeVisible({ timeout: 10_000 });

    // Verify the routing result is displayed
    const finalRouting = page.getByTestId('final-routing');
    await expect(finalRouting).toBeVisible();

    // Verify the routing state contains text
    const routingState = page.getByTestId('routing-state');
    await expect(routingState).toBeVisible();
    await expect(routingState).not.toBeEmpty();
  });
});
