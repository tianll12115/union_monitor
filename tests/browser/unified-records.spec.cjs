const { test, expect } = require('./error-guard');

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

// Independent oracle for the submission-time order — recomputed from the served
// snapshot, never from the production sort function. Unknown (no create/push)
// sorts last; ties by PR number desc.
function oracleSubmission(p) {
  if (p.submission_time_profile === 'ubs-latest-code-submission-v1') {
    const v = p.latest_submission_ms;
    return (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : null;
  }
  if (p.submission_events_status === 'partial' || p.submission_events_status === 'unknown') return null;
  if ((p.issues || []).some(s => String(s).includes('操作日志采集失败'))) return null;
  let best = null;
  for (const e of (p.events || [])) {
    if (e.kind !== 'create' && e.kind !== 'push') continue;
    const v = e.time_ms;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && (best === null || v > best)) best = v;
  }
  return best;
}

function expectedSubmittedOrder(prs) {
  const values = prs.map(p => ({ p, s: oracleSubmission(p) }));
  values.sort((a, b) => {
    const as = a.s, bs = b.s;
    if (as === null && bs === null) return b.p.number - a.p.number;
    if (as === null) return 1;
    if (bs === null) return -1;
    if (as !== bs) return bs - as;
    return b.p.number - a.p.number;
  });
  return values.map(x => x.p.number);
}

test('[BASIC-004] the full >=31-PR submitted sequence survives 15/30/50 pagination with no skip or duplicate', async ({ page }) => {
  await readyRepo(page);
  const payload = await page.evaluate(async () => await (await fetch('data/repos/ubs-engine.json')).json());
  const prs = payload.prs;
  expect(prs.length).toBeGreaterThanOrEqual(31);
  const expected = expectedSubmittedOrder(prs);

  await page.locator('#sort').selectOption('submitted');
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();

  for (const size of [15, 30, 50]) {
    await page.locator('#pageSize').selectOption(String(size));
    await expect(page.locator('#pageInfo')).toContainText('1 /');
    const seen = [];
    for (;;) {
      const ids = await page.locator('#prRows tr[data-pr]').evaluateAll(rows => rows.map(r => Number(r.getAttribute('data-pr'))));
      seen.push(...ids);
      const next = page.locator('#next');
      if (await next.isDisabled()) break;
      await next.click();
      await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();
    }
    expect(seen.length, `full sequence length at page size ${size}`).toBe(prs.length);
    expect(new Set(seen).size, `no duplicates at page size ${size}`).toBe(seen.length);
    expect(seen, `submitted order at page size ${size}`).toEqual(expected);
  }
});

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

// EC-008-AC03: the merged view exposes a same-page "时间未知" entry for records
// with an unknown start time but known source identity.
test('triton merged view exposes the 时间未知 entry inline', async ({ page }) => {
  await page.goto('./#projects/triton/engineering');
  await expect(page.locator('#triton-view')).toBeVisible();
  const entry = page.locator('#triton-view [data-role="unknownTime"]');
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('时间未知');
  await entry.click();
  await expect(page.locator('#triton-view [data-role="attention"] .group-title')).toContainText('时间未知');
  await expect(page.locator('#triton-view [data-role="attention"]')).toContainText('当前没有起点未知且带来源身份的批次');
  await entry.click();
  await expect(page.locator('#triton-view [data-role="attention"] .group-title')).toContainText('关注批次');
});