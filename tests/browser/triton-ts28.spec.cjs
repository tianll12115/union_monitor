const { test, expect } = require('./error-guard');

/* TS28-001..010 product acceptance: rich hover evidence, pin, same-PR
   highlight, color semantics, no bucket median, card geometry, keyboard
   access, scope-carrying export and the legitimate multi-branch URL. */

const ACT = 'https://github.com/triton-lang/triton-ascend';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const SHA_D = 'd'.repeat(40);

function mkBatch(opts) {
  const start = Date.parse(opts.start);
  const duration = opts.duration;
  const jobs = (opts.jobs || []).map(([name, wait, run, conclusion, createOffset], index) => {
    const created = start + (createOffset == null ? 0 : createOffset) * 1000;
    const started = created + wait * 1000;
    const completed = started + run * 1000;
    return {
      id: opts.seed * 100 + index, name, status: 'completed', conclusion: conclusion || 'success',
      created_at: new Date(created).toISOString(), started_at: new Date(started).toISOString(),
      completed_at: new Date(completed).toISOString(),
      url: `${ACT}/actions/runs/${opts.seed * 10}/job/${opts.seed * 100 + index}`,
      wait_seconds: wait, run_seconds: run, failed_steps: [], measurement_error: null,
    };
  });
  const wf = {
    id: opts.seed * 10, name: opts.integration ? 'Integration Tests' : 'Auto labeling',
    attempt: opts.attempt || 1, status: 'completed', conclusion: opts.status,
    created_at: opts.start, updated_at: new Date(start + duration * 1000).toISOString(),
    url: `${ACT}/actions/runs/${opts.seed * 10}/attempts/${opts.attempt || 1}`,
    jobs_complete: opts.jobsComplete !== false, jobs,
    workflow_id: opts.integration ? 241783889 : 315011600,
    path: opts.integration ? '.github/workflows/ci.yml' : '.github/workflows/label.yml',
  };
  const batch = {
    id: `ts28-${opts.seed}`, pr: opts.pr, title: `TS28 fixture ${opts.seed}`,
    pr_url: opts.pr == null ? null : `${ACT}/pull/${opts.pr}`,
    author: 'tester', branch: `feat-${opts.seed}`, base_branch: 'main',
    sha: opts.sha, kind: opts.kind || 'initial',
    start_at: opts.start, end_at: new Date(start + duration * 1000).toISOString(),
    duration_seconds: duration, status: opts.status, complete: true, approximate: false,
    start_source: 'workflow_created', critical_workflow: wf.name, action_url: wf.url, action_name: wf.name,
    workflows: [wf], npu_jobs: [], npu_data_missing: opts.npu == null, npu_queue_seconds: opts.npu,
    is_integration_tests: !!opts.integration,
    e2e_sample_eligible: opts.integration && (opts.status === 'success' || opts.status === 'failure'),
    e2e_exclusion_reason: opts.integration ? null : 'outside_integration_tests',
    missing: [], e2e_metric_version: 2, discovery: { fetch_window_end: '2026-10-25T02:00:00Z' },
  };
  if (opts.npu != null) {
    batch.npu_jobs = [{
      id: opts.seed * 1000, name: `integration-tests-ascend (linux-aarch64-a3-800i-4, py3.10)`,
      status: 'completed', conclusion: opts.status === 'failure' ? 'failure' : 'success',
      created_at: opts.start, started_at: new Date(start + opts.npu * 1000).toISOString(),
      completed_at: new Date(start + opts.npu * 1000 + 60000).toISOString(),
      url: `${ACT}/actions/runs/${opts.seed * 10}/job/${opts.seed * 1000}`,
      runner_name: 'runner', runner_label: null, wait_seconds: opts.npu, run_seconds: 60,
      measurement_error: null, failed_steps: [],
    }];
  }
  return batch;
}

function fixture() {
  const filler = Array.from({ length: 18 }, (_, i) => [`filler job ${i}`, 1, 2 + i]);
  const b0 = mkBatch({
    seed: 0, pr: 501, sha: SHA_A, status: 'success', duration: 600, npu: 20, integration: true,
    start: '2026-10-25T01:00:00Z',
    jobs: [['runner-preparation / prepare', 5, 55], ['integration-tests-ascend (linux-aarch64-a3-800i-4, py3.10)', 20, 300],
      ['integration-tests-ascend (linux-aarch64-a3-800i-4, py3.11)', 25, 280],
      ['integration-tests-ascend (linux-amd64-a5-2, py3.12)', 30, 250], ...filler],
  });
  const b1 = mkBatch({ seed: 1, pr: 501, sha: SHA_B, status: 'success', duration: 900, npu: 30, integration: true,
    start: '2026-10-25T01:20:00Z', jobs: [['integration-tests-ascend (linux-aarch64-a3-800i-4, py3.10)', 10, 500]] });
  const b2 = mkBatch({ seed: 2, pr: 501, sha: SHA_A, kind: 'rerun', attempt: 2, status: 'failure', duration: 300,
    npu: 40, integration: true, start: '2026-10-25T01:30:00Z',
    jobs: [['integration-tests-ascend (linux-aarch64-a3-800i-4, py3.10)', 12, 200]] });
  const b3 = mkBatch({ seed: 3, pr: 502, sha: SHA_C, status: 'failure', duration: 1200, npu: 50, integration: true,
    start: '2026-10-25T02:00:00Z',
    jobs: [['integration-tests-ascend (linux-aarch64-a3-800i-4, py3.10)', 0, 0, 'skipped']] });
  const b4 = mkBatch({ seed: 4, pr: 503, sha: SHA_D, status: 'success', duration: 200, npu: 40,
    integration: false, start: '2026-10-25T02:20:00Z', jobs: [] });
  const b5 = mkBatch({ seed: 5, pr: null, sha: 'e'.repeat(40), status: 'failure', duration: 100, npu: null,
    integration: true, start: '2026-10-25T02:40:00Z', jobs: [] });
  b5.e2e_exclusion_reason = 'unresolved_pr_batch_identity';
  b5.e2e_sample_eligible = false;
  const b6 = mkBatch({ seed: 6, pr: 504, sha: 'f'.repeat(40), status: 'cancelled', duration: 400, npu: 10,
    integration: false, start: '2026-10-25T03:00:00Z', jobs: [] });
  const batches = [b0, b1, b2, b3, b4, b5, b6];
  b0.e2e_index = 1; b0.e2e_total = 3;
  b1.e2e_index = 2; b1.e2e_total = 3;
  b2.e2e_index = 3; b2.e2e_total = 3;
  const payload = {
    repo: 'triton-lang/triton-ascend', e2e_metric: 'integration_tests_workflow_e2e', e2e_metric_version: 2,
    window_start: '2026-10-24T00:00:00Z', window_end: '2026-10-26T00:00:00Z',
    collected_at: '2026-10-26T00:00:00Z',
    discovery: { fetch_window_end: '2026-10-25T23:30:00Z', boundary_note: '测试边界说明' },
    batches,
  };
  return payload;
}

const served = new WeakMap();

async function ready(page, query = '', data = fixture()) {
  if (!served.has(page)) {
    served.set(page, data);
    await page.route('**/data/triton.json*', route => route.fulfill({ json: served.get(page) }));
    await page.goto('./#projects/triton/engineering' + query);
  } else {
    served.set(page, data);
    await page.reload();
  }
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('[data-role="kE2eN"], [data-role="tritonEmpty"]').first()).toBeVisible();
  if (data.batches.length) await expect(page.locator('[data-role="kE2eN"]')).toHaveText(/n=/);
  return data;
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

test('[TS28-001] E2E hover shows PR, run, SHA, reliable timing, focus tasks, same-commit bucket and boundary', async ({ page }) => {
  await ready(page);
  const tip = page.locator('[data-role="tip"]');
  await page.locator('[data-role="chart"] .mark-hit[data-i="0"]').hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator('.tip-title')).toContainText('PR #501');
  await expect(tip).toContainText('TS28 fixture 0');
  await expect(tip.locator('.tip-sha')).toHaveText(SHA_A);
  await expect(tip).toContainText('run 0');
  await expect(tip).toContainText('attempt 1');
  await expect(tip).toContainText('触发');
  await expect(tip.locator('.tip-result.success').first()).toBeVisible();
  await expect(tip).toContainText('本次可靠关联的运行（1 个');
  await expect(tip).toContainText('首任务等待 0.02 min（1.00 s）');
  await expect(tip).toContainText('执行跨度 5.32 min（319.00 s）');
  await expect(tip).toContainText('重点测试任务（本次可靠集合）');
  await expect(tip).toContainText('A3 · py3.10');
  await expect(tip).toContainText('A3 · py3.11');
  await expect(tip).toContainText('A5 · py3.12');
  await expect(tip).toContainText('排队 0.33 min（20.00 s）');
  await expect(tip).toContainText('同提交其他运行（1 个，不能证明同次触发，不计 E2E）');
  await expect(tip).toContainText('不计 E2E');
  await expect(tip).toContainText('关联依据');
  await expect(tip).toContainText('发现截止 2026/10/26 07:30:00');
  await expect(tip).toContainText('采集完成 2026/10/26 08:00:00');
  const hrefs = await tip.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThanOrEqual(2);
  for (const href of hrefs) expect(href).toMatch(/^https:\/\//);
  await expect(tip.locator('.tip-wf summary').first()).toContainText('run 0 · attempt 1');
  await tip.locator('.tip-wf summary').first().click();
  await expect(tip.locator('.tip-wf .tip-job')).toHaveCount(22);
  await expect(tip.locator('.tip-wf .tip-job').first()).toContainText('runner-preparation');
  // Escape is the explicit close path; pointer-leave is covered in TS28-002.
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden({ timeout: 2000 });
});

test('[TS28-002] same-PR points grow to 7px in both charts without moving or recoloring; leaving restores 3.5px', async ({ page }) => {
  await ready(page);
  const e2e = page.locator('[data-role="chart"] .mark-hit');
  const npu = page.locator('[data-role="npuChart"] .mark-hit');
  const before = await e2e.evaluateAll(ms => ms.map(m => ({ x: m.dataset.x, y: m.dataset.y, transform: m.getAttribute('transform') })));
  const fill = await page.locator('[data-role="chart"] .mark-hit[data-i="0"] .dot').evaluate(d => getComputedStyle(d).fill);
  await page.locator('[data-role="chart"] .mark-hit[data-i="0"]').hover();
  await expect(page.locator('[data-role="tip"]')).toBeVisible();
  const radii = await e2e.evaluateAll(ms => ms.map(m => ({ i: m.dataset.i, r: m.querySelector('.dot').getAttribute('r') })));
  const highlighted = radii.filter(row => row.r === '7').map(row => row.i).sort();
  expect(highlighted).toEqual(['0', '1', '2']);
  const npuRadii = await npu.evaluateAll(ms => ms.map(m => ({ i: m.dataset.i, r: m.querySelector('.dot').getAttribute('r') })));
  expect(npuRadii.filter(row => row.r === '7').map(row => row.i).sort()).toEqual(['0', '1', '2']);
  expect(npuRadii.filter(row => row.r === '3.5').length).toBeGreaterThan(0);
  const after = await e2e.evaluateAll(ms => ms.map(m => ({ x: m.dataset.x, y: m.dataset.y, transform: m.getAttribute('transform') })));
  expect(after).toEqual(before);
  expect(await page.locator('[data-role="chart"] .mark-hit[data-i="0"] .dot').evaluate(d => getComputedStyle(d).fill)).toBe(fill);
  await page.mouse.move(5, 5);
  await expect(page.locator('[data-role="tip"]')).toBeHidden({ timeout: 2000 });
  const restored = await e2e.evaluateAll(ms => ms.map(m => m.querySelector('.dot').getAttribute('r')));
  expect(new Set(restored)).toEqual(new Set(['3.5']));
  // Unresolved PR has no group: only the hovered point grows and no PR link is invented.
  await page.locator('[data-role="chart"] .mark-hit[data-i="5"]').hover();
  const tip = page.locator('[data-role="tip"]');
  await expect(tip).toContainText('未关联 PR');
  await expect(tip.locator('a[href*="/pull/"]')).toHaveCount(0);
  const selfOnly = await e2e.evaluateAll(ms => ms.filter(m => m.querySelector('.dot').getAttribute('r') === '7').map(m => m.dataset.i));
  expect(selfOnly).toEqual(['5']);
});

test('[TS28-005] resize keeps the same visible PR group and no stale highlight survives a filter', async ({ page }) => {
  await ready(page);
  await page.locator('[data-role="chart"] .mark-hit[data-i="0"]').hover();
  await expect(page.locator('[data-role="tip"]')).toBeVisible();
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.waitForTimeout(120);
  const radii = await page.locator('[data-role="chart"] .mark-hit').evaluateAll(ms =>
    ms.map(m => ({ i: m.dataset.i, r: m.querySelector('.dot').getAttribute('r') })).filter(row => row.r === '7').map(row => row.i).sort());
  expect(radii).toEqual(['0', '1', '2']);
  await page.locator('[data-filter="failure"]').click();
  await expect(page.locator('[data-role="tip"]')).toBeHidden();
  const isPr = await page.locator('.mark-hit.is-pr, .mark-hit.is-pr-source').count();
  expect(isPr).toBe(0);
  const remaining = await page.locator('[data-role="chart"] .mark-hit .dot').evaluateAll(ds => ds.map(d => d.getAttribute('r')));
  expect(new Set(remaining)).toEqual(new Set(['3.5']));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.locator('[data-role="chart"] .mark-hit .dot').first().evaluate(d => getComputedStyle(d).transitionDuration);
  expect(parseFloat(reduced)).toBeLessThan(0.001);
});

test('[TS28-004] success is green, failure red, cancelled amber even while highlighted', async ({ page }) => {
  await ready(page);
  const color = async i => page.locator(`[data-role="chart"] .mark-hit[data-i="${i}"] .dot`).evaluate(d => getComputedStyle(d).fill);
  expect(await color(0)).toBe('rgb(37, 114, 75)');
  expect(await color(3)).toBe('rgb(191, 64, 56)');
  const cancelled = page.locator('[data-role="npuChart"] .mark-hit[data-i="6"] .dot');
  expect(await cancelled.evaluate(d => getComputedStyle(d).fill)).toBe('rgb(160, 106, 21)');
  await page.locator('[data-role="chart"] .mark-hit[data-i="0"]').hover();
  await expect(page.locator('[data-role="tip"]')).toBeVisible();
  expect(await color(0)).toBe('rgb(37, 114, 75)');
  expect(await color(3)).toBe('rgb(191, 64, 56)');
});

test('[TS28-003] NPU card distinguishes auxiliary records, lists NPU jobs and explains missing focus tasks', async ({ page }) => {
  await ready(page);
  const tip = page.locator('[data-role="tip"]');
  await page.locator('[data-role="npuChart"] .mark-hit[data-i="4"]').click();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('本记录非 Integration Tests，E2E 不适用');
  await expect(tip.locator('.tip-npu')).toContainText('NPU Jobs');
  await expect(tip.locator('.tip-npu .tip-job')).toContainText('排队 0.67 min（40.00 s）');
  await expect(tip.locator('.tip-npu .tip-job a')).toHaveAttribute('href', new RegExp('/actions/runs/40/job/4000$'));
  await expect(tip.locator('.tip-head')).toContainText('最长排队 0.67 min（40.00 s）');
  await expect(tip).toContainText('同提交其他运行（0 个');
  // The skipped A3 job is reported as skipped, not as a zero-second run.
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await page.locator('[data-role="chart"] .mark-hit[data-i="3"]').hover();
  await expect(tip).toContainText('未找到 A3 · py3.10：已跳过（未触发）');
  await expect(tip).toContainText('未找到 A3 · py3.11：没有找到匹配任务');
});

test('[TS28-003 AC2] pin survives hovering another point, switches only on explicit click, Escape closes it', async ({ page }) => {
  await ready(page);
  const tip = page.locator('[data-role="tip"]');
  const npu = page.locator('[data-role="npuChart"] .mark-hit[data-i="0"]');
  await npu.click();
  await expect(tip).toBeVisible();
  await expect(tip).toHaveClass(/pinned/);
  await expect(tip.locator('.tip-title')).toContainText('PR #501');
  await page.locator('[data-role="chart"] .mark-hit[data-i="3"]').hover();
  await expect(tip.locator('.tip-title')).toContainText('PR #501');
  const highlight = await page.locator('[data-role="chart"] .mark-hit .dot').evaluateAll(ds => ds.map(d => d.getAttribute('r')));
  expect(highlight.filter(r => r === '7').length).toBe(3);
  await page.locator('[data-role="npuChart"] .mark-hit[data-i="3"]').click();
  await expect(tip.locator('.tip-title')).toContainText('PR #502');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  expect(await page.locator('.mark-hit.is-pr, .mark-hit.is-pr-source').count()).toBe(0);
  await expect(page.locator('[data-role="npuChart"] .mark-hit[data-i="3"]')).toBeFocused();
});

test('[TS28-001 AC5] keyboard focus opens the same card, Escape closes it and restores focus', async ({ page }) => {
  await ready(page);
  const mark = page.locator('[data-role="chart"] .mark-hit[data-i="0"]');
  await mark.focus();
  const tip = page.locator('[data-role="tip"]');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('PR #501');
  await expect(tip).toContainText('A3 · py3.10');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(mark).toBeFocused();
  await expect(page.locator('[role="region"][aria-label="运行与任务详情"]')).toHaveCount(1);
});

test('[TS28-001 AC4] card stays inside 390/768/1440 viewports, never covers its mark and scrolls internally', async ({ page }) => {
  await ready(page);
  const tip = page.locator('[data-role="tip"]');
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const mark = page.locator('[data-role="chart"] .mark-hit[data-i="0"]');
    await mark.hover();
    await expect(tip).toBeVisible();
    await tip.locator('.tip-wf summary').first().click();
    const geometry = await page.evaluate(() => {
      const tipEl = document.querySelector('[data-role="tip"]');
      const markEl = document.querySelector('[data-role="chart"] .mark-hit[data-i="0"]');
      const a = tipEl.getBoundingClientRect(), b = markEl.getBoundingClientRect();
      const jobsEl = tipEl.querySelector('.tip-wf .tip-jobs');
      return { tip: { left: a.left, top: a.top, right: a.right, bottom: a.bottom, width: a.width, height: a.height },
        mark: { left: b.left, top: b.top, right: b.right, bottom: b.bottom },
        vw: innerWidth, vh: innerHeight,
        scroll: tipEl.scrollHeight > tipEl.clientHeight + 1
          || (jobsEl && jobsEl.scrollHeight > jobsEl.clientHeight + 1) };
    });
    expect(geometry.tip.width).toBeLessThanOrEqual(geometry.vw - 24 + 0.5);
    expect(geometry.tip.height).toBeLessThanOrEqual(geometry.vh - 24 + 0.5);
    expect(geometry.tip.left).toBeGreaterThanOrEqual(11.5);
    expect(geometry.tip.top).toBeGreaterThanOrEqual(11.5);
    expect(geometry.tip.right).toBeLessThanOrEqual(geometry.vw - 11.5);
    expect(geometry.tip.bottom).toBeLessThanOrEqual(geometry.vh - 11.5);
    const overlaps = geometry.tip.left < geometry.mark.right && geometry.tip.right > geometry.mark.left
      && geometry.tip.top < geometry.mark.bottom && geometry.tip.bottom > geometry.mark.top;
    expect(overlaps, `card must not cover the mark at ${viewport.width}x${viewport.height}`).toBe(false);
    expect(geometry.scroll, 'the complete job list scrolls inside the card').toBe(true);
  }
});

/* Localhost saves the CSV through /api/export (mode "saved") while remote/CI
   origins download it; either way the qualification sidecar is a browser
   download carrying the same scope. */
async function captureTritonExport(page) {
  const downloads = [], posts = [];
  const onDownload = d => downloads.push(d);
  const onRequest = r => {
    if (r.method() === 'POST' && /\/api\/export$/.test(r.url())) posts.push(r.postDataJSON());
  };
  page.on('download', onDownload);
  page.on('request', onRequest);
  await page.locator('[data-role="exportBatches"]').click();
  await expect.poll(() => downloads.some(d => /qualifications/.test(d.suggestedFilename()))
    || posts.some(p => p.kind === 'sidecar'), { timeout: 10000 }).toBe(true);
  await expect.poll(() => downloads.some(d => /\.csv$/.test(d.suggestedFilename()))
    || posts.some(p => !p.kind), { timeout: 10000 }).toBe(true);
  page.off('download', onDownload);
  page.off('request', onRequest);
  const sidecar = downloads.find(d => /qualifications/.test(d.suggestedFilename()));
  const csvDownload = downloads.find(d => /\.csv$/.test(d.suggestedFilename()));
  const csvPost = posts.find(p => !p.kind);
  return {
    metadata: sidecar ? JSON.parse(await readDownload(sidecar)) : JSON.parse(posts.find(p => p.kind === 'sidecar').content),
    csv: csvDownload ? await readDownload(csvDownload) : csvPost.csv,
  };
}

test('[TS28-008] both exports carry the same metric/scope and a zero-row export is auditable', async ({ page }) => {
  const data = await ready(page);
  const first = await captureTritonExport(page);
  expect(first.metadata.metric).toBe('integration_tests_workflow_e2e');
  expect(first.metadata.metric_version).toBe(2);
  expect(first.metadata.scope.metric).toBe('integration_tests_workflow_e2e');
  expect(first.metadata.scope.selection_start).toBeTruthy();
  expect(first.metadata.scope.selection_end).toBeTruthy();
  expect(first.metadata.scope.discovery_fetch_window_end).toBe('2026-10-25T23:30:00Z');
  expect(first.metadata.scope.collected_at).toBe('2026-10-26T00:00:00Z');
  expect(first.metadata.scope.boundary_note).toBe('测试边界说明');
  expect(first.metadata.scope.unknown_time_included).toBe(false);
  expect(first.csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).length - 1).toBe(first.metadata.batches.length);
  expect(first.metadata.batches.length).toBeLessThanOrEqual(data.batches.length);

  const empty = fixture();
  empty.batches = [];
  await ready(page, '', empty);
  await expect(page.locator('[data-role="tritonEmpty"]')).toBeVisible();
  const second = await captureTritonExport(page);
  expect(second.metadata.batches).toEqual([]);
  expect(second.metadata.scope.metric).toBe('integration_tests_workflow_e2e');
  expect(second.metadata.scope.unknown_time_included).toBe(false);
  expect(second.metadata.scope.selection_start).toBeTruthy();
  expect(second.csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).length).toBe(1);
});

test('[TS28-008 AC1] a legitimate multi-branch URL keeps both branches and is not reported as a duplicate value', async ({ page }) => {
  await ready(page, '?branch=main&branch=dev');
  await expect(page.locator('#notice')).not.toContainText('仅保留首个值');
  await expect(page.locator('[data-role="branchSummary"]')).toContainText('已选 2 项');
  await expect(page.locator('.branch-option input:checked')).toHaveCount(2);
});
