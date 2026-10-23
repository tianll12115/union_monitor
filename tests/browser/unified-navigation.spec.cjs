const { test, expect } = require('./error-guard');

// EC-001/EC-009: two-community sidebar navigation (UBSCore overview, Triton
// engineering). There is no project selector and no fixed seven-task bar; the
// retired #workbench collapses to the UBS overview instead of opening a deck.

async function readyOverview(page) {
  await page.goto('./#projects/ubs/overview');
  await expect(page.locator('#sideTasks')).toBeVisible();
}

test('[BASIC-001] the sidebar shows exactly two community entries and no workbench or project selector', async ({ page }) => {
  await readyOverview(page);
  await expect(page.locator('#sideTasks a')).toHaveCount(2);
  await expect(page.locator('#sideTasks')).toContainText('UBSCore');
  await expect(page.locator('#sideTasks')).toContainText('Triton-Ascend');
  await expect(page.locator('#sideProjectSelector')).toHaveCount(0);
  await expect(page.locator('a[data-nav="workbench"]')).toHaveCount(0);
});

test('the two community links carry their canonical entries and tooltips', async ({ page }) => {
  await readyOverview(page);
  await expect(page.locator('#sideTasks a[data-nav="ubs"]'))
    .toHaveAttribute('href', '#projects/ubs/overview');
  await expect(page.locator('#sideTasks a[data-nav="ubs"]'))
    .toHaveAttribute('title', 'UBSCore');
  await expect(page.locator('#sideTasks a[data-nav="triton"]'))
    .toHaveAttribute('href', '#projects/triton/engineering');
  await expect(page.locator('#sideTasks a[data-nav="triton"]'))
    .toHaveAttribute('title', 'Triton-Ascend');
});

test('[BASIC-002] clicking the Triton community opens the merged engineering view and marks it active', async ({ page }) => {
  await readyOverview(page);
  await page.locator('#sideTasks a[data-nav="triton"]').click();
  await expect(page.locator('#triton-view')).toBeVisible();
  await expect(page.locator('#ubs-view')).toBeHidden();
  await expect(page.locator('#sideTasks a[data-nav="triton"]')).toHaveClass(/active/);
});

test('clicking UBSCore returns to the overview and marks it active', async ({ page }) => {
  await page.goto('./#projects/triton/engineering');
  await expect(page.locator('#triton-view')).toBeVisible();
  await page.locator('#sideTasks a[data-nav="ubs"]').click();
  await expect(page.locator('#ubs-view')).toBeVisible();
  await expect(page.locator('#sideTasks a[data-nav="ubs"]')).toHaveClass(/active/);
});

test('the retired workbench collapses to the UBS overview', async ({ page }) => {
  await page.goto('./#workbench');
  await expect(page).toHaveURL(/#projects\/ubs\/overview/);
  await expect(page.locator('#workbench-view')).toBeHidden();
  await expect(page.locator('#ubs-view')).toBeVisible();
});

test('an unsupported task explains the reason instead of faking a view', async ({ page }) => {
  await page.goto('./#projects/triton/quality');
  await expect(page.locator('#project-task-view')).toBeVisible();
  await expect(page.locator('#project-task-view')).toContainText('未提供');
  await expect(page.locator('#triton-view')).toBeHidden();
});