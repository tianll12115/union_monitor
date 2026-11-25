const { test, expect, allowError } = require('./error-guard');

test('filters are contextual and clearing them can be undone', async ({ page }) => {
  await page.goto('./#ubs');
  await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');
  await expect(page.locator('#query')).toBeHidden();
  await expect(page.locator('#reset')).toBeHidden();
  await page.locator('#repositoryRows a').filter({ hasText: 'ubs-engine' }).click();

  const search = page.getByRole('searchbox', { name: '搜索 PR' });
  await search.fill('no-match-usability');
  await page.locator('#state').selectOption('merged');
  const reset = page.locator('#reset');
  await expect(reset).toHaveText('清除筛选');
  await reset.click();
  await expect(reset).toBeFocused();
  await expect(reset).toHaveText('撤销清除');
  await expect(search).toBeEmpty();
  await expect(page.locator('#state')).toHaveValue('');
  await reset.click();
  await expect(search).toHaveValue('no-match-usability');
  await expect(page.locator('#state')).toHaveValue('merged');
  await expect(page.locator('#prCount')).toHaveText('0');

  await reset.click();
  await page.goBack();
  await expect(search).toHaveValue('no-match-usability');
  await expect(reset).toHaveText('清除筛选');
  await page.locator('#backRepositories').click();
  await expect(page.locator('#reset')).toBeHidden();
  await expect(page.locator('#state')).toHaveValue('');
});

test('refresh reports progress and leaves detail opened while data was loading intact', async ({ page }) => {
  await page.goto('./#ubs/repo/ubs-engine');
  const record = page.locator('#prRows .pr-title').first();
  await expect(record).toBeVisible();

  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/data/repositories.json*', async route => {
    await held;
    await route.continue();
  });

  await page.locator('#reload').click();
  await expect(page.locator('#reload')).toBeDisabled();
  await expect(page.locator('#refreshStatus')).toHaveText('正在刷新快照…');
  await record.click();
  const dialog = page.getByRole('dialog', { name: '记录详情' });
  const close = dialog.getByRole('button', { name: '关闭详情' });
  await expect(close).toBeFocused();
  release();
  await expect(page.locator('#refreshStatus')).toHaveText('快照已刷新');
  await expect(close).toBeFocused();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(record).toBeFocused();
});

test('overview links restore their filter after switching communities', async ({ page }) => {
  await page.goto('./#projects/triton/engineering');
  await expect(page.locator('#triton-view [data-role="search"]')).toBeVisible();
  await page.goto('./#projects/ubs/overview?state=merged');
  await expect(page.locator('#state')).toHaveValue('merged');
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page).not.toHaveURL(/state=/);
  await page.goBack();
  await expect(page.locator('#state')).toHaveValue('merged');
  await expect(page.getByRole('button', { name: '清除筛选' })).toBeVisible();
});

test('a failed refresh stays visible after closing a detail', async ({ page }) => {
  await page.goto('./#ubs/repo/ubs-engine');
  const record = page.locator('#prRows .pr-title').first();
  await expect(record).toBeVisible();

  allowError(page, event => event.kind === 'response' && event.status === 503 && event.url.includes('repositories.json'));
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/data/repositories.json*', async route => {
    await held;
    await route.fulfill({ status: 503, body: 'unavailable' });
  });

  await page.locator('#reload').click();
  await record.click();
  release();
  await expect(page.locator('#refreshStatus')).toContainText('刷新遇到问题');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('#loading')).toContainText('数据未更新');
  await expect(page.locator('#loading')).toBeVisible();
  await expect(record).toBeVisible();
});
