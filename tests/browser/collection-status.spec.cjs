const { test, expect } = require('@playwright/test');

// EC-012: the collection-status workbench is retired. The retired #workbench
// collapses to the UBS overview, and collection health is read from the
// repository table (采集状态 column) instead of a separate card deck.

test('the retired workbench collapses to the UBS overview, never a card deck', async ({ page }) => {
  await page.goto('./#workbench');
  await expect(page).toHaveURL(/#projects\/ubs\/overview/);
  await expect(page.locator('#workbench-view')).toBeHidden();
  await expect(page.locator('#ubs-view')).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(0);
});

test('the UBS overview reads repository collection status from the snapshot index', async ({ page }) => {
  await page.goto('./#projects/ubs/overview');
  await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');
  await expect(page.locator('#repositoryRows')).toContainText('采集完成');
});