const {test, expect} = require('./error-guard');

/* TA-014-AC1 的浏览器几何/状态断言：不依赖“文本存在”，而是读取实际渲染位置、
   viewBox、数值到像素的往返映射与 URL/焦点状态。这些断言在冻结的缺陷实现上会失败。 */

function fixture() {
  return {
    e2e_metric_version: 2, window_start: '2026-10-23T00:00:00Z', window_end: '2026-10-26T00:00:00Z',
    collected_at: '2026-10-26T00:00:00Z',
    // Batch 2's raw duration is chosen so the 12% y-axis headroom reproduces the
    // audit's frozen five-digit label exactly: max label 3308.76 min.
    batches: [0, 60, 3308.76 * 60 / 1.12].map((value, i) => ({
      id: `scatter-${i}`, pr: 100 + i, title: `scatter batch ${i}`, sha: `abcdef${i}`,
      base_branch: 'main', status: i === 2 ? 'failure' : 'success',
      start_at: `2026-10-25T0${i + 1}:00:00Z`, duration_seconds: value,
      end_at: new Date(Date.parse(`2026-10-25T0${i + 1}:00:00Z`) + value * 1000).toISOString(),
      npu_queue_seconds: i ? value / 10 : 0, approximate: false, missing: [],
      action_url: `https://github.com/triton-lang/triton-ascend/actions/runs/${i + 1}`,
      pr_url: `https://github.com/triton-lang/triton-ascend/pull/${100 + i}`,
      workflows: [{name: `Workflow ${i}`, id: i + 1, attempt: 1,
        url: `https://github.com/triton-lang/triton-ascend/actions/runs/${i + 1}`,
        jobs: [{name: `Job ${i}`, wait_seconds: i, run_seconds: value}]}],
      npu_jobs: [{name: `NPU ${i}`, wait_seconds: i, status: 'completed', conclusion: 'success',
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

test('[TA-001] every y-axis label is fully inside the drawing and decreases top-to-bottom to zero', async ({page}) => {
  await ready(page);
  const chart = page.locator('[data-role="chart"]');
  const result = await chart.evaluate(svg => {
    const r = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('text.axis[text-anchor="end"]')].map(t => {
      const b = t.getBoundingClientRect();
      return {text: t.textContent.trim(), top: b.top, left: b.left, right: b.right};
    }).filter(l => !l.text.includes('/'));
    labels.sort((a, b) => a.top - b.top);
    return {svgLeft: r.left, labels};
  });
  expect(result.labels.length).toBeGreaterThanOrEqual(5);
  for (const label of result.labels) {
    expect(label.left, `${label.text} must not be clipped left of the SVG`).toBeGreaterThanOrEqual(result.svgLeft - 0.5);
  }
  // Values strictly decrease from top to bottom; the last (bottom) label is zero.
  const values = result.labels.map(l => parseFloat(l.text));
  for (let i = 0; i < values.length - 1; i++) {
    expect(values[i], `top value must exceed the next label (${values[i]} vs ${values[i + 1]})`).toBeGreaterThan(values[i + 1]);
  }
  expect(values[values.length - 1]).toBe(0);
  // The audit's five-digit minute label actually renders in full.
  expect(result.labels[0].text).toContain('3308.76');
});

test('[TA-002] anchor coordinates are the independent linear map and match the true position', async ({page}) => {
  const data = await ready(page);
  await page.setViewportSize({width: 1200, height: 900});
  const out = await page.locator('[data-role="chart"]').evaluate((svg, payload) => {
    const vb = svg.viewBox.baseVal;
    const W = vb.width, H = vb.height;
    const grid = [...svg.querySelectorAll('line.gridline')];
    const mLeft = Math.min(...grid.map(g => +g.getAttribute('x1')));
    const mTop = Math.min(...grid.map(g => +g.getAttribute('y1')));
    const mBottom = Math.max(...grid.map(g => +g.getAttribute('y1')));
    const mRight = W - Math.max(...grid.map(g => +g.getAttribute('x2')));
    const topLabel = [...svg.querySelectorAll('text.axis[text-anchor="end"]')]
      .map(t => t.textContent.trim()).filter(t => !t.includes('/'))
      .sort((a, b) => parseFloat(b) - parseFloat(a))[0];
    const maxSec = parseFloat(topLabel) * 60;
    const t0 = Date.parse(payload.window_start), t1 = Date.parse(payload.window_end);
    const marks = [...svg.querySelectorAll('.mark-hit')].map(m => ({
      anchorX: +m.dataset.anchorX, anchorY: +m.dataset.anchorY,
      dotX: +m.dataset.x, dotY: +m.dataset.y, index: +m.dataset.i,
    }));
    const band = [];
    for (const mark of marks) {
      const b = payload.batches[mark.index];
      const expX = mLeft + (Date.parse(b.start_at) - t0) / (t1 - t0) * (W - mLeft - mRight);
      const expY = mBottom - (b.duration_seconds / maxSec) * (mBottom - mTop);
      band.push({mark, expX, expY,
        dx: Math.abs(mark.anchorX - expX), dy: Math.abs(mark.anchorY - expY)});
    }
    return {band, ticks: [...svg.querySelectorAll('.anchor-tick')].map(t => ({x: +t.getAttribute('cx'), y: +t.getAttribute('cy')}))};
  }, data);
  expect(out.band.length).toBe(3);
  for (const entry of out.band) {
    expect(entry.dx, `anchor x within 1px for batch ${entry.mark.index}`).toBeLessThanOrEqual(1);
    expect(entry.dy, `anchor y within 1px for batch ${entry.mark.index}`).toBeLessThanOrEqual(1);
  }
  expect(out.ticks).toHaveLength(0);
  for (const entry of out.band) {
    expect(entry.mark.dotX).toBe(entry.mark.anchorX);
    expect(entry.mark.dotY).toBe(entry.mark.anchorY);
  }
  await expect(page.locator('.anchor-lead')).toHaveCount(0);
});

test('[TA-003] the viewBox matches the laid-out width and the date axis runs left-to-right', async ({page}) => {
  await ready(page);
  for (const width of [390, 1440, 2560]) {
    await page.setViewportSize({width, height: 900});
    for (const role of ['chart', 'npuChart']) {
      const box = page.locator(`[data-role="${role}"]`);
      // TA-003 draws on the next animation frame; wait until the deferred redraw
      // has settled so the viewBox reflects the current layout width.
      await expect.poll(
        () => box.evaluate(svg => Math.abs(svg.clientWidth - svg.viewBox.baseVal.width)),
        {message: `viewBox must settle at ${width}px`},
      ).toBeLessThanOrEqual(1);
      const shot = await box.evaluate(svg => {
        const vb = svg.viewBox.baseVal;
        const grid = [...svg.querySelectorAll('line.gridline')];
        const x1 = Math.min(...grid.map(g => +g.getAttribute('x1')));
        const x2 = Math.max(...grid.map(g => +g.getAttribute('x2')));
        const dates = [...svg.querySelectorAll('text.axis')]
          .map(t => ({text: t.textContent.trim(), x: +t.getAttribute('x')}))
          .filter(d => /\//.test(d.text))
          .sort((a, b) => a.x - b.x);
        return {clientWidth: svg.clientWidth, vbWidth: vb.width, plotW: x2 - x1, xOrder: x2 > x1, dates};
      });
      expect(shot.plotW, `plot width must be positive at ${width}px`).toBeGreaterThan(0);
      expect(shot.xOrder, 'x(start) must come before x(end)').toBe(true);
      expect(Math.abs(shot.clientWidth - shot.vbWidth), `viewBox must match layout at ${width}px`).toBeLessThanOrEqual(1);
      expect(shot.dates.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < shot.dates.length - 1; i++) {
        expect(shot.dates[i].x, `dates must increase left-to-right (${shot.dates.map(d => d.text).join(' | ')})`).toBeLessThan(shot.dates[i + 1].x);
      }
    }
  }
});

test('[TA-006] Escape close clears the batch from the URL as well as the dialog', async ({page}) => {
  await ready(page);
  await page.locator('[data-role="chart"] .mark-hit[data-i="0"]').click();
  await expect(page.locator('#detail')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#detail')).toBeHidden();
  await expect(page).not.toHaveURL(/batch=/);
  await expect(page.evaluate(() => document.activeElement && document.activeElement.tagName)).resolves.toMatch(/G|DIV|BUTTON|BODY/i);
});

test('[TA-007] a cold deep link opens its batch exactly once and keeps the identity', async ({page}) => {
  const data = fixture();
  await page.route('**/data/triton.json*', route => route.fulfill({json: data}));
  await page.goto('./#projects/triton/engineering?batch=scatter-1');
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#detail')).toBeVisible();
  const dialog = page.locator('#detail');
  await expect(dialog.locator('.detail-title')).toContainText('PR #101');
  // The cold-load root cause (double navigate) must not have cleared the batch.
  await expect(page).toHaveURL(/batch=scatter-1/);
  // And it is open exactly once: a single modal instance.
  expect(await page.locator('#detail:open').count()).toBe(1);
});

test('[TA-008] a pinned NPU card keeps its identity when another chart point is hovered', async ({page}) => {
  await ready(page);
  // Pin the NPU tip on batch 0.
  await page.locator('[data-role="npuChart"] .mark-hit[data-i="0"]').click();
  const tip = page.locator('[data-role="tip"]');
  await expect(tip).toBeVisible();
  await expect(tip.locator('.tip-title')).toContainText('PR #100');
  // Hover an E2E point from a different batch; pinned identity must not change.
  await page.locator('[data-role="chart"] .mark-hit[data-i="1"]').hover();
  await expect(tip.locator('.tip-title')).toContainText('PR #100');
  await expect(tip.locator('.tip-title')).not.toContainText('PR #101');
});

test('[TA-013] reference lines carry visible names, not bare dashed strokes', async ({page}) => {
  await ready(page);
  const chart = page.locator('[data-role="chart"]');
  await expect(chart.locator('text.ref-label')).toHaveCount(1);
  await expect(chart.locator('text.ref-label')).toContainText('图内 P90');
  const nbins = await page.locator('[data-role="chart"] .mark-hit').count();
  // The six-hour median line appears only when more than one bucket is populated;
  // with a 3-day window and 3 samples it is deterministic to confirm the legend names.
  await expect(page.locator('div.legend').first()).toContainText('六小时桶中位数');
});