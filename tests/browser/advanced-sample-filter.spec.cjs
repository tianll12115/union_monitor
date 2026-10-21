const { test, expect } = require('@playwright/test');

// EC-007: the standalone trigger/quality advanced panel is retired; the PR state
// filter and plain search stay in the list area. Old tf/qf params are reported as
// removed instead of being silently applied.

async function readyRepo(page, hash = '#ubs/repo/ubs-engine') {
  await page.goto('./' + hash);
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#prRows')).not.toBeEmpty();
}

function denominatorText(page) {
  return page.locator('#activeConditions strong').innerText();
}

test('retired advanced panel is not rendered and has no hidden filters', async ({ page }) => {
  await readyRepo(page);
  await expect(page.locator('#advancedToggle')).toHaveCount(0);
  await expect(page.locator('#advancedFilters')).toHaveCount(0);
  await expect(page.locator('#triggerFilter')).toHaveCount(0);
  await expect(page.locator('#qualityFilter')).toHaveCount(0);
});

test('state filter changes the analysis denominator and is clearable', async ({ page }) => {
  await readyRepo(page);
  await page.locator('#entity').selectOption('prs');
  await page.locator('#state').selectOption('merged');
  const bar = page.locator('#activeConditions');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('PR 状态＝已合入');
  await expect(bar).toContainText('有效分母');
  const denom = await denominatorText(page);
  const count = await page.locator('#prCount').innerText();
  expect(denom).toContain(count);
  await page.locator('#clearConditions').click();
  await expect(bar).toBeHidden();
  expect(await page.locator('#state').inputValue()).toBe('');
});

test('plain search changes records but not the analysis denominator', async ({ page }) => {
  await readyRepo(page);
  await page.locator('#query').fill('no-match-7c331');
  await expect(page.locator('#activeConditions')).toBeHidden();
  await expect(page.locator('#prRows')).not.toBeEmpty();
});

test('legacy tf/qf params report the retired conditions instead of filtering', async ({ page }) => {
  await page.goto('./#projects/ubs/engineering?repository=ubs-engine&tf=push&qf=incomplete');
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#prRows')).not.toBeEmpty();
  const notice = page.locator('#notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('触发方式');
  await expect(notice).toContainText('数据完整性');
});
