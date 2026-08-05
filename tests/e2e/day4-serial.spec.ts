import { test, expect } from '@playwright/test';

/**
 * Day 4 — Serial E2E Flow (Consent-and-Send → Care Plan V1 → Care Plan V2)
 *
 * Tests run serially, each building on the state created by the previous test.
 * Requires: MANAS_PERSISTENCE=memory, MANAS_DEMO_MODE=true, MANAS_AI_PROVIDER=mock
 */
test.describe.configure({ mode: 'serial' });

test.describe('Day 4: Full Demo Flow', () => {
  test.use({
    baseURL: 'http://localhost:3000',
  });

  // -------------------------------------------------------------------------
  // Test 1: Check-in → Summary → Handoff → Consent-and-Send
  // -------------------------------------------------------------------------
  test('completes check-in → summary → handoff → consent-and-send', async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Sign in as the seeded demo user so the contact gate is passed
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Welcome back');
    await page.locator('input#email').fill('ananya@example.com');
    await page.locator('input#password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/');

    // 2. Navigate to landing page and start check-in flow
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    await page.getByRole('button', { name: /begin check-in/i }).click();
    await page.waitForURL('**/check-in');

    const beginBtn = page.getByTestId('begin-check-in');
    await expect(beginBtn).toBeVisible();
    await beginBtn.click();

    // 3. Chat-style check-in: send primary concern
    const chatInput = page.getByTestId('chat-input');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill('I have been feeling overwhelmed with work deadlines and unable to sleep well.');

    const chatSendBtn = page.getByTestId('chat-submit');
    await expect(chatSendBtn).toBeEnabled();
    await chatSendBtn.click();

    const aiResponse = page.getByTestId('ai-response');
    await expect(aiResponse).toBeVisible({ timeout: 15_000 });

    // Wait for the loading indicator to disappear before sending the next message.
    await expect(page.getByTestId('ai-response-loading')).toHaveCount(0, { timeout: 15_000 });

    // 4. Answer follow-up question with remaining structured fields
    await chatInput.fill('It has been going on for a few weeks. My sleep is mildly affected, daily routine has mild impact, and I would like professional support. I feel safe.');
    await chatSendBtn.click();
    await expect(page.getByTestId('ai-response').nth(1)).toBeVisible({ timeout: 15_000 });

    // 5. Complete check-in → navigate to /summary
    const completeBtn = page.getByTestId('complete-check-in');
    await expect(completeBtn).toBeEnabled({ timeout: 10_000 });
    await completeBtn.click();
    await page.waitForURL('**/summary**', { timeout: 15_000 });

    // 10. Confirm the summary (no edits needed)
    const draftSummary = page.getByTestId('draft-summary');
    await expect(draftSummary).toBeVisible({ timeout: 15_000 });

    // Phase 3: verify sources and cross-session insight panels
    await expect(page.getByTestId('sources-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('cross-session-insight')).toBeVisible({ timeout: 10_000 });

    const confirmBtn = page.getByTestId('confirm-summary');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    const confirmedSummary = page.getByTestId('confirmed-summary');
    await expect(confirmedSummary).toBeVisible({ timeout: 15_000 });

    // Panels persist on confirmed summary
    await expect(page.getByTestId('sources-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('cross-session-insight')).toBeVisible({ timeout: 10_000 });

    const finalRouting = page.getByTestId('final-routing');
    await expect(finalRouting).toBeVisible();

    // 11. Navigate to /professionals page
    await page.goto('/professionals');
    await expect(page.locator('h1')).toContainText('Professionals', { timeout: 10_000 });

    // 12. Navigate to /handoff page
    await page.goto('/handoff');
    await page.waitForSelector('text=Your Check-in Summary', { timeout: 15_000 });

    // 13. Verify structured summary is displayed
    await expect(page.locator('text=Primary concern')).toBeVisible();
    await expect(page.locator('text=Duration')).toBeVisible();
    await expect(page.locator('text=Sleep impact')).toBeVisible();

    // 14. Verify fictional provider badge
    await expect(page.locator('text=Fictional Provider')).toBeVisible();

    // 15. Verify consent checkbox and wording
    const consentCheckbox = page.locator('#consent-checkbox');
    await expect(consentCheckbox).toBeVisible();

    const consentLabel = page.locator('label[for="consent-checkbox"]');
    await expect(consentLabel).toContainText('I understand and agree to share');
    await expect(consentLabel).toContainText('fictional demonstration workspace');

    // 16. Verify Send button is disabled before consent
    const sendBtn = page.getByRole('button', { name: /send handoff/i });
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();

    // 17. Check consent → Send button becomes enabled
    await consentCheckbox.check();
    await expect(sendBtn).toBeEnabled();

    // 18. Click Send → verify SENT confirmation
    await sendBtn.click();

    // Use exact match to avoid matching "sent" in body text
    const sentBadge = page.getByText('SENT', { exact: true });
    await expect(sentBadge).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=read-only and immutable')).toBeVisible();

    // 19. Verify consent section is hidden after send
    await expect(page.locator('#consent-checkbox')).not.toBeVisible();

    // 20. Navigate back to /handoff → verify still SENT (idempotent)
    await page.goto('/handoff');
    await expect(page.getByText('SENT', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=read-only and immutable')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 2: Clinician inbox → Create care plan V1 → Propose → Approve → Accept
  // (Builds on the SENT handoff created by Test 1)
  // -------------------------------------------------------------------------
  test('creates V1 care plan from SENT handoff through to user acceptance', async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Sign in as the seeded demo clinician
    await page.goto('/professional/login');
    await expect(page.locator('h1')).toContainText('Clinician sign in');
    await page.locator('input#email').fill('maya.rao@manas.demo');
    await page.locator('input#password').fill('clinician123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/clinician');

    // 2. Verify SENT handoff appears in inbox
    await expect(page.locator('h1')).toContainText('Clinician Inbox', { timeout: 15_000 });

    // 2. Verify SENT handoff appears in inbox
    await expect(page.getByText('SENT', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Primary concern:')).toBeVisible();

    // 3. Click "Create Care Plan" → navigates to care-plan workspace
    await page.getByRole('link', { name: /create care plan/i }).click();
    await page.waitForURL('**/clinician/care-plan**', { timeout: 15_000 });

    // 4. Verify handoff summary is displayed (read-only)
    await expect(page.locator('text=Handoff Summary (read-only)')).toBeVisible({ timeout: 15_000 });

    // 5. Verify the care plan creation form is shown
    await expect(page.getByRole('heading', { name: 'Create Care Plan' })).toBeVisible();
    await expect(page.locator('input[placeholder="Goal title"]').first()).toBeVisible();
    await expect(page.locator('text=Check-in Frequency')).toBeVisible();
    await expect(page.locator('text=Boundaries (one per line)')).toBeVisible();

    // 6. Click "Create Care Plan"
    await page.getByRole('button', { name: /^Create Care Plan$/ }).click();
    await expect(page.locator('text=Care plan created successfully')).toBeVisible({ timeout: 15_000 });

    // 7. Verify care plan is in DRAFT — Propose button only renders when DRAFT
    const proposeBtn = page.getByRole('button', { name: /^Propose$/ });
    await expect(proposeBtn).toBeVisible({ timeout: 10_000 });
    await proposeBtn.click();
    await expect(page.locator('text=Action "propose" completed successfully')).toBeVisible({ timeout: 15_000 });

    // 8. Click "Approve"
    const approveBtn = page.getByRole('button', { name: /^Approve$/ });
    await expect(approveBtn).toBeVisible({ timeout: 10_000 });
    await approveBtn.click();
    await expect(page.locator('text=Action "approve" completed successfully')).toBeVisible({ timeout: 15_000 });

    // 9. Navigate to user care-plan page (/care-plan)
    await page.goto('/care-plan');
    await expect(page.locator('text=My Care Plan')).toBeVisible({ timeout: 15_000 });

    // 10. Verify care plan details are displayed (goals, modules, frequency)
    await expect(page.locator('text=Goals:').first()).toBeVisible();
    await expect(page.locator('text=Assigned Modules:').first()).toBeVisible();
    await expect(page.locator('text=Check-in Frequency:').first()).toBeVisible();

    // 11. Click "Accept Plan"
    const acceptBtn = page.getByRole('button', { name: /accept plan/i });
    await expect(acceptBtn).toBeVisible({ timeout: 10_000 });
    await acceptBtn.click();
    await expect(page.locator('text=Care plan accepted and activated')).toBeVisible({ timeout: 15_000 });

    // 12. Verify plan shows as ACTIVE
    await expect(page.getByText('ACTIVE', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Test 3: Revise V1 → V2, compare, accept V2, verify audit trail
  // (Builds on the ACTIVE V1 care plan created by Test 2)
  // -------------------------------------------------------------------------
  test('revises V1 → V2, compares, accepts V2, verifies audit trail', async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Navigate to clinician care-plan page (loads existing ACTIVE care plan)
    await page.goto('/clinician/care-plan');
    await expect(page.locator('text=Care Plan Workspace')).toBeVisible({ timeout: 15_000 });

    // Verify the care plan is ACTIVE
    await expect(page.getByText('ACTIVE', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // 2. Click "Revise Plan" button
    const reviseBtn = page.getByRole('button', { name: /revise plan/i });
    await expect(reviseBtn).toBeVisible({ timeout: 10_000 });
    await reviseBtn.click();

    // Verify revision form appears
    await expect(page.locator('text=Revise Active Plan')).toBeVisible({ timeout: 10_000 });

    // 3. Modify goals in the revision form — add a new goal
    const addGoalBtn = page.getByRole('button', { name: /add goal/i });
    await addGoalBtn.click();

    // Fill in the new goal title
    const goalInputs = page.locator('input[placeholder="Goal title"]');
    const newGoalInput = goalInputs.last();
    await newGoalInput.fill('Explore support-group participation');

    // Change frequency
    const freqSelect = page.locator('select').last();
    await freqSelect.selectOption('weekly');

    // 4. Submit revision → V2 created
    await page.getByRole('button', { name: /create revision/i }).click();
    await expect(page.locator('text=Revision created')).toBeVisible({ timeout: 15_000 });

    // 5. Click "Propose V2"
    const proposeV2Btn = page.getByRole('button', { name: /propose v2/i });
    await expect(proposeV2Btn).toBeVisible({ timeout: 10_000 });
    await proposeV2Btn.click();
    await expect(page.locator('text=Action "propose" completed successfully')).toBeVisible({ timeout: 15_000 });

    // 6. Click "Approve V2"
    const approveV2Btn = page.getByRole('button', { name: /approve v2/i });
    await expect(approveV2Btn).toBeVisible({ timeout: 10_000 });
    await approveV2Btn.click();
    await expect(page.locator('text=Action "approve" completed successfully')).toBeVisible({ timeout: 15_000 });

    // 7. Navigate to user care-plan page
    await page.goto('/care-plan');
    await expect(page.locator('text=My Care Plan')).toBeVisible({ timeout: 15_000 });

    // 8. Verify V1/V2 side-by-side comparison is shown
    await expect(page.locator('text=Version Comparison')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Version 1').first()).toBeVisible();
    await expect(page.locator('text=Version 2').first()).toBeVisible();

    // 9. Verify changed fields are highlighted
    await expect(page.locator('text=(changed)')).toBeVisible();
    await expect(page.locator('text=(new)')).toBeVisible();

    // 10. Click "Accept Revised Plan"
    const acceptRevisedBtn = page.getByRole('button', { name: /accept revised plan/i });
    await expect(acceptRevisedBtn).toBeVisible({ timeout: 10_000 });
    await acceptRevisedBtn.click();
    await expect(page.locator('text=Care plan accepted and activated')).toBeVisible({ timeout: 15_000 });

    // 11. Verify V2 shows as ACTIVE
    await expect(page.getByText('ACTIVE', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // 12. Navigate to privacy page → verify audit timeline
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /privacy/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Audit Timeline')).toBeVisible();
    await expect(page.locator('text=Care plan revision created')).toBeVisible({ timeout: 10_000 });
  });
});
