const { test, expect, allowError } = require('./error-guard');

async function ready(page,hash='#ubs'){
  await page.goto('./'+hash);
  await expect(page.locator('#reload')).toBeEnabled();
  if(hash==='#triton')await expect(page.locator('#triton-view [data-role="kE2eN"]')).toHaveText(/n=\d+/);
  if(hash==='#ubs')await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');
}

test('[BASIC-001] published pages initialise without script exceptions',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await ready(page,'#ubs');
  await ready(page,'#triton');
  await page.locator('#reload').click();
  await expect(page.locator('#reload')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('[BASIC-008] community links enter a project and the retired workbench collapses to the overview',async({page})=>{
  await ready(page,'#ubs');
  await page.locator('a[data-nav="triton"]').click();
  await expect(page.locator('#triton-view')).toBeVisible();
  await expect(page.locator('#ubs-view')).toBeHidden();
  await page.locator('a[data-nav="ubs"]').click();
  await expect(page.locator('#ubs-view')).toBeVisible();
  await page.goto('./#workbench');
  await expect(page).toHaveURL(/#projects\/ubs\/overview/);
  await expect(page.locator('#ubs-view')).toBeVisible();
  await expect(page.locator('#workbench-view')).toBeHidden();
});

test('[BASIC-008] Triton branch and window controls expose a real, changeable sample',async({page})=>{
  await ready(page,'#triton');
  // Every chart/KPI derives from the same S: the metric identity is countable.
  await expect(page.locator('#triton-view [data-role="kE2eN"]')).toHaveText(/n=\d+/);
  // The branch control reflects the snapshot's single branch without fabricating others.
  await expect(page.locator('#triton-view [data-role="branchSummary"]')).toContainText('合入分支');
  // A real selection (attention -> all) changes the visible records set.
  await expect(page.locator('#triton-view [data-role="attention"] .group-title')).toContainText('关注批次');
  const beforeCount = await page.locator('#triton-view [data-role="attention"] .count').innerText();
  await page.locator('#triton-view [data-role="showAll"]').click();
  await expect(page.locator('#triton-view [data-role="attention"] .group-title')).toContainText('全部批次');
  const afterCount = await page.locator('#triton-view [data-role="attention"] .count').innerText();
  expect(Number(afterCount)).toBeGreaterThanOrEqual(Number(beforeCount));
});

test('record search changes records while preserving analysis statistics',async({page})=>{
  await ready(page,'#triton');
  const before=await page.locator('#triton-view .kpi-grid').innerText();
  await page.getByRole('searchbox',{name:'搜索关注列表'}).fill('no-record-can-match-this-7c331');
  await expect(page.locator('#triton-view .row')).toHaveCount(0);
  await expect(page.locator('#triton-view [data-role="attention"]')).toContainText('当前没有匹配批次');
  expect(await page.locator('#triton-view .kpi-grid').innerText()).toBe(before);
  await page.getByRole('searchbox',{name:'搜索关注列表'}).fill('');
});

test('CSV download contains the selected records, independent of collapse',async({page})=>{
  await ready(page,'#triton');
  // ADR-007: download reuses the displayed list. Entering "全部批次" makes the
  // visible set the complete search pool, so the export equals the whole payload.
  await page.getByRole('button',{name:'查看全部批次',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出批次 CSV',exact:true}).click();
  const download=await downloadEvent;
  expect(await download.failure()).toBeNull();
  const stream=await download.createReadStream();
  const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const csv=Buffer.concat(chunks).toString('utf8');
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  expect(lines[0]).toMatch(/^"pr","title","sha","base_branch",/);
  const payload=await page.evaluate(async()=>await (await fetch('data/triton.json')).json());
  expect(lines.length-1).toBe(payload.batches.length);
});

test('route changes close bound PR details and browser history restores the active view',async({page})=>{
  await ready(page,'#ubs/repo/ubs-engine');
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();
  await page.locator('#prRows tr[data-pr]').first().click();
  await expect(page.locator('#detail')).toBeVisible();
  // Hash navigation while the native modal is open exercises owned-resource cleanup.
  await page.evaluate(()=>{location.hash='#projects/triton/engineering';});
  await expect(page.locator('#detail')).toBeHidden();
  await expect(page.locator('#triton-view')).toBeVisible();
  await page.locator('a[data-nav="ubs"]').click();
  await expect(page.locator('#ubs-view')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#triton-view')).toBeVisible();
  await expect(page.locator('#ubs-view')).toBeHidden();
  await page.goForward();
  await expect(page.locator('#ubs-view')).toBeVisible();
  await expect(page.locator('#triton-view')).toBeHidden();
});

test('failed snapshot reload keeps valid data and restores the control',async({page})=>{
  await ready(page,'#triton');
  const before=await page.locator('#triton-view .kpi-grid').innerText();
  allowError(page,e=>e.kind==='response'&&e.status===503&&/triton\.json/.test(e.url));
  await page.route('**/data/triton.json*',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.locator('#reload').click();
  await expect(page.locator('[data-role="tritonError"]')).toContainText('503');
  await expect(page.locator('#reload')).toBeEnabled();
  expect(await page.locator('#triton-view .kpi-grid').innerText()).toBe(before);
});

test('mobile retains result and duration in complete batch records',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await ready(page,'#triton');
  await page.getByRole('button',{name:'查看全部批次',exact:true}).click();
  const row=page.locator('#triton-view .row-main').first();
  await expect(row.locator('.status')).toBeVisible();
  await expect(row.locator('.duration')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('[BASIC-011] EC-010-AC01: no page-level horizontal overflow across breakpoints',async({page})=>{
  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:800});
    await ready(page,'#triton');
    await expect(page.locator('#triton-view [data-role="chart"]')).toBeVisible();
    await expect(page.locator('#triton-view [data-role="npuChart"]')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    expect(overflow,`no horizontal overflow at ${width}px`).toBe(false);
    // Key controls (navigation + reload) must remain reachable at every width.
    await expect(page.locator('#reload')).toBeVisible();
    await expect(page.locator('a[data-nav="ubs"]')).toBeVisible();
  }
});

test('keyboard opens a batch into the unified detail modal and Escape closes it',async({page})=>{
  await ready(page,'#triton');
  const point=page.getByRole('button',{name:/E2E 详情/}).first();
  await point.press('Enter');
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#detail [data-role="evidence"]')).toContainText('Triton 门禁批次');
  await page.keyboard.press('Escape');
  await expect(page.locator('#detail')).toBeHidden();
});

test('attention row opens the unified detail modal and closing returns to the dashboard',async({page})=>{
  await ready(page,'#triton');
  await page.getByRole('button',{name:'查看全部批次',exact:true}).click();
  await page.locator('#triton-view .row-main .status').first().click();
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#detail [data-role="evidence"]')).toContainText('Triton 门禁批次');
  await page.locator('#closeDetail').click();
  await expect(page.locator('#detail')).toBeHidden();
  await expect(page.locator('#triton-view .row-main').first()).toBeVisible();
});
