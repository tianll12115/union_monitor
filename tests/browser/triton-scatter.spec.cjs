const {test, expect} = require('./error-guard');

function fixture() {
  return {
    window_start: '2026-10-23T00:00:00Z', window_end: '2026-10-26T00:00:00Z',
    collected_at: '2026-10-26T00:00:00Z',
    batches: [0, 60, 600].map((value, i) => ({
      id: `scatter-${i}`, pr: 100 + i, title: `scatter batch ${i}`, sha: `abcdef${i}`,
      base_branch: 'main', status: i === 2 ? 'failure' : 'success',
      start_at: `2026-10-25T0${i + 1}:00:00Z`, duration_seconds: value,
      end_at: new Date(Date.parse(`2026-10-25T0${i + 1}:00:00Z`) + value * 1000).toISOString(),
      npu_queue_seconds: value / 10, approximate: false, missing: [],
      action_url: `https://github.com/triton-lang/triton-ascend/actions/runs/${i + 1}`,
      pr_url: `https://github.com/triton-lang/triton-ascend/pull/${100 + i}`,
      workflows: [{name: `Workflow ${i}`, id: i + 1, attempt: 1,
        url: `https://github.com/triton-lang/triton-ascend/actions/runs/${i + 1}`,
        jobs: [{name: `Job ${i}`, wait_seconds: value / 10, run_seconds: value}]}],
      npu_jobs: [{name: `NPU ${i}`, wait_seconds: value / 10, status: 'completed', conclusion: 'success',
        url: `https://github.com/triton-lang/triton-ascend/actions/jobs/${i + 1}`}],
    })),
  };
}

async function ready(page, query = '', data = fixture()) {
  await page.route('**/data/triton.json*', route => route.fulfill({json: data}));
  await page.goto('./#projects/triton/engineering' + query);
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('[data-role="kE2eN"]')).toHaveText(/n=/);
  return data;
}

test('[TRITON-001] every scatter point opens visible matching evidence by pointer', async ({page}) => {
  const data = await ready(page);
  for (const role of ['chart', 'npuChart']) {
    await expect(page.locator(`[data-role="${role}"] .mark-hit`)).toHaveCount(3);
    for (let i = 0; i < data.batches.length; i++) {
      const b = data.batches[i];
      const mark = page.locator(`[data-role="${role}"] .mark-hit[data-i="${i}"]`);
      await mark.click();
      if (role === 'chart') {
        const dialog = page.locator('#detail');
        await expect(dialog.locator('.detail-title')).toContainText(`PR #${b.pr}`);
        await expect(dialog.locator('.wf-name')).toContainText(`Workflow ${i}`);
        await expect(dialog.locator('.jobs')).toContainText(`Job ${i}`);
        await expect(dialog.locator('.detail-footer')).toContainText((b.duration_seconds / 60).toFixed(2) + ' min');
        await expect(dialog.locator('.wf-name a')).toHaveAttribute('href', b.workflows[0].url);
        await expect(dialog.locator('.detail-title')).toBeInViewport();
        await page.locator('#closeDetail').click();
        await expect(dialog).toBeHidden();
      } else {
        const tip = page.locator('[data-role="tip"]');
        await expect(tip).toBeVisible();
        await expect(tip).toContainText(`PR #${b.pr}`);
        await expect(tip.locator('.tip-job')).toContainText(`NPU ${i}`);
        await expect(tip.locator('.tip-job a')).toHaveAttribute('href', b.npu_jobs[0].url);
        await expect(tip.locator('.tip-head')).toContainText((b.npu_queue_seconds / 60).toFixed(2) + ' min');
        await expect(tip.locator('.tip-head')).toBeInViewport();
        await tip.locator('.tip-close').click();
        await expect(tip).toBeHidden();
      }
    }
  }
});

test('[TRITON-005] long workflow jobs stay inside the dialog and reopening starts at its visible heading', async ({page}) => {
  const data = fixture();
  // Production shape: seven workflows and long NPU names plus failed steps.
  for (const batch of [data.batches[0], data.batches[2]]) {
    batch.workflows = Array.from({length:7}, (_, i) => ({
      id: i + 1, name: `Integration Tests workflow ${i}`, attempt: 1,
      url: `https://github.com/triton-lang/triton-ascend/actions/runs/${i + 1}`,
      created_at: batch.start_at, updated_at: batch.end_at,
      jobs: Array.from({length:3}, (_, j) => ({
        name: `integration-tests-ascend / integration-tests-ascend (linux-aarch64-a3-800i-4, py3.1${j})`,
        wait_seconds: 30, run_seconds: 600, conclusion:'failure',
        failed_steps: ['Run compiler unit and MLIR tests', 'generate ttadapter'],
      })),
    }));
  }
  await ready(page, '', data);
  const dialog = page.locator('#detail');
  for (const width of [2560, 1440, 390]) {
    await page.setViewportSize({width, height:900});
    await page.locator('[data-role="chart"] .mark-hit[data-i="0"]').click();
    await expect(dialog.locator('.detail-title')).toBeInViewport();
    const layout = await dialog.evaluate(e => {
      const box = e.getBoundingClientRect();
      return {overflow:e.scrollWidth > e.clientWidth,
        jobs:[...e.querySelectorAll('.workflow .jobs')].map(j => {
          const r = j.getBoundingClientRect();
          return {width:r.width, inside:r.left >= box.left && r.right <= box.right};
        })};
    });
    expect(layout.overflow, `dialog must not overflow at ${width}px`).toBe(false);
    expect(layout.jobs).toHaveLength(7);
    for (const job of layout.jobs) {
      expect(job.width, `job evidence needs readable width at ${width}px`).toBeGreaterThan(200);
      expect(job.inside).toBe(true);
    }
    await dialog.evaluate(e => {e.scrollTop=e.scrollHeight;});
    expect(await dialog.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
    await page.locator('#closeDetail').click();
    await page.locator('[data-role="chart"] .mark-hit[data-i="2"]').click();
    await expect(dialog.locator('.detail-title')).toContainText('PR #102');
    await expect(dialog.locator('.detail-title')).toBeInViewport();
    expect(await dialog.evaluate(e => e.scrollTop)).toBe(0);
    await page.locator('#closeDetail').click();
  }
});

test('[TRITON-002] narrow-screen keyboard activation displays evidence and Escape closes it', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  await ready(page);
  for (const role of ['chart', 'npuChart']) {
    const mark = page.locator(`[data-role="${role}"] .mark-hit[data-i="0"]`);
    await mark.press('Enter');
    const detail = role === 'chart' ? page.locator('#detail') : page.locator('[data-role="tip"]');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('PR #100');
    await expect(detail).toContainText('0.00 min');
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
  }
});

test('[TRITON-003] warm navigation recovers empty charts and preserves a new batch destination', async ({page}) => {
  await ready(page, '?branch=absent&q=old');
  await expect(page.locator('[data-role="chart"] .mark-hit')).toHaveCount(0);
  await page.goto('./#projects/triton/engineering?branch=main&filter=failure');
  await expect(page.locator('[data-role="chart"] .mark-hit')).toHaveCount(1);
  await expect(page.locator('[data-role="kE2eN"]')).toContainText('n=3');
  await page.locator('[data-role="chart"] .mark-hit').click();
  await expect(page.locator('#detail .detail-title')).toContainText('PR #102');
  // Navigate with the modal still open: cleanup must not clobber this URL.
  await page.evaluate(() => {location.hash = '#projects/triton/engineering?batch=scatter-0';});
  await expect(page.locator('#detail .detail-title')).toContainText('PR #100');
  await page.locator('#closeDetail').click();
  await expect(page).not.toHaveURL(/batch=/);
  await expect(page.locator('[data-role="chart"] .mark-hit')).toHaveCount(3);
  await page.goto('./#projects/triton/engineering');
  await expect(page.locator('[data-role="search"]')).toHaveValue('');
  await expect(page.locator('[data-role="chart"] .mark-hit')).toHaveCount(3);
});

test('[TRITON-004] chart identity, KPI quantiles and filtered samples reconcile independently', async ({page}) => {
  await ready(page);
  await expect(page.locator('[data-role="kE2eP50"]')).toHaveText('P50 1.00 min');
  await expect(page.locator('[data-role="kE2eP90"]')).toHaveText('8.20 min');
  await expect(page.locator('[data-role="kNpuP50"]')).toHaveText('P50 0.10 min');
  await expect(page.locator('[data-role="kNpuP90"]')).toHaveText('0.82 min');
  await page.locator('[data-filter="failure"]').click();
  await expect(page.locator('[data-role="chart"] .mark-hit')).toHaveCount(1);
  await expect(page.locator('[data-role="e2eStats"]')).toContainText('10.00 min');
  await expect(page.locator('[data-role="kE2eP90"]')).toHaveText('8.20 min');
  await page.locator('[data-filter="running"]').click();
  await expect(page.locator('[data-role="chart"] .mark-hit')).toHaveCount(0);
  await expect(page.locator('[data-role="e2eStats"]')).toContainText('暂无已完成的有效样本');
  await page.locator('[data-npu-filter="failure"]').click();
  await expect(page.locator('[data-role="npuChart"] .mark-hit')).toHaveCount(1);
  await expect(page.locator('[data-role="npuStats"]')).toContainText('1.00 min');
});
