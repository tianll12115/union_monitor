const { test, expect } = require('@playwright/test');

// UDR-018-TC01: page length 15/30/50 slices a stable, complete sequence with
// no loss. The displayed range end is always min(pageSize, total), and
// changing the page length resets to page 1.

async function readyRepo(page, hash = '#ubs/repo/ubs-engine') {
  await page.goto('./' + hash);
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#prRows')).not.toBeEmpty();
}

async function total(page) {
  return Number(await page.locator('#prCount').innerText());
}

test('page length selector shows 15/30/50 and re-slices without loss', async ({ page }) => {
  await readyRepo(page);
  const sel = page.locator('#pageSize');
  await expect(sel).toBeVisible();
  await expect(sel.locator('option')).toHaveText(['15', '30', '50']);
  const n = await total(page);
  expect(n).toBeGreaterThan(0);

  for (const size of [15, 30, 50]) {
    await sel.selectOption(String(size));
    await expect(page.locator('#rowInfo')).toContainText(`1–${Math.min(size, n)}`);
    await expect(page.locator('#rowInfo')).toContainText(`/ ${n} 条`);
  }
});

test('changing page length resets to page 1', async ({ page }) => {
  await readyRepo(page);
  const n = await total(page);
  if (n <= 15) test.skip(true, 'needs more than 15 records to exercise pagination');
  await page.locator('#next').click();
  await expect(page.locator('#pageInfo')).toContainText('2 /');
  await page.locator('#pageSize').selectOption('30');
  await expect(page.locator('#pageInfo')).toContainText('1 /');
});

test('records default to PR and the entity toggle switches to execution batch', async ({ page }) => {
  await readyRepo(page);
  // Default entity is one PR per row (UAR-001).
  await expect(page.locator('#entity')).toHaveValue('prs');
  await expect(page.locator('#recordTitle')).toHaveText('PR 效率明细');
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();
  await expect(page.locator('#prRows tr[data-batch]')).toHaveCount(0);
  // Toggle to the explicit expert batch view: batch rows appear, PR rows disappear.
  await page.locator('#entity').selectOption('batches');
  await expect(page.locator('#recordTitle')).toHaveText('执行批次明细');
  await expect(page.locator('#prRows tr[data-pr]')).toHaveCount(0);
  await expect(page.locator('#prRows tr[data-batch]').first()).toBeVisible();
  // Back to PR.
  await page.locator('#entity').selectOption('prs');
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();
});

// EC-003-AC01: Triton batch records merge into the engineering page — the same
// canonical URL carries the two diagnostic charts and the single records list,
// so reaching the records never requires switching tasks again. The page-length
// 15/30/50 control (UDR-018) remains covered by the UBS side above.
test('triton records collapse into the merged charts + list view', async ({ page }) => {
  await page.goto('./#projects/triton/records');
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#triton-view')).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#projects/triton/engineering');
  // Two diagnostic charts and exactly one records list share the page.
  await expect(page.locator('#triton-view [data-role="chart"]')).toBeVisible();
  await expect(page.locator('#triton-view [data-role="npuChart"]')).toBeVisible();
  await expect(page.locator('#triton-view [data-role="attention"]')).toBeVisible();
  await page.locator('#triton-view [data-role="showAll"]').click();
  await expect(page.locator('#triton-view [data-role="attention"] .group-title')).toContainText('全部批次');
  const n = Number(await page.locator('#triton-view [data-role="attention"] .count').innerText());
  expect(n).toBeGreaterThan(0);
  await expect(page.locator('#triton-view [data-role="attention"] .row').first()).toBeVisible();
});