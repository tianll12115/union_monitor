const { test, expect } = require('./error-guard');

// ADR-020: at a 390px viewport the in-chart selection stats (selection-stat
// units) must stay fully readable — no horizontal clipping and no unit overlap.
test.use({ viewport: { width: 390, height: 844 } });

function tritonFixture() {
  return {
    collected_at: '2026-10-12T00:00:00Z',
    window_start: '2026-10-09T00:00:00Z',
    window_end: '2026-10-12T00:00:00Z',
    batches: [
      { id: 'run-1', pr: 100, title: 'PR 100 title', status: 'success',
        duration_seconds: 300, npu_queue_seconds: 10,
        start_at: '2026-10-11T10:00:00Z', end_at: '2026-10-11T10:05:00Z',
        sha: 'deadbeef', kind: 'push', base_branch: 'main', start_source: 'trigger_event',
        approximate: false, e2e_index: 1, e2e_total: 1,
        action_url: 'https://github.com/triton-lang/triton-ascend/actions/runs/1',
        pr_url: 'https://github.com/triton-lang/triton-ascend/pull/100',
        missing: [], workflows: [], focus_jobs: [] },
      { id: 'run-2', pr: 101, title: 'PR 101 title', status: 'failure',
        duration_seconds: 900, npu_queue_seconds: 40,
        start_at: '2026-10-11T09:00:00Z', end_at: '2026-10-11T09:15:00Z',
        sha: 'cafebabe', kind: 'push', base_branch: 'main', start_source: 'workflow_created',
        approximate: false, e2e_index: 1, e2e_total: 1,
        action_url: 'https://github.com/triton-lang/triton-ascend/actions/runs/2',
        pr_url: 'https://github.com/triton-lang/triton-ascend/pull/101',
        missing: [], workflows: [], focus_jobs: [] },
    ],
  };
}

test('ADR-020: 390px in-chart stats are fully visible without clipping or overlap', async ({ page }) => {
  await page.route('**/data/triton.json*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tritonFixture()) }));
  await page.goto('./#projects/triton/engineering');
  await expect(page.locator('[data-role="e2eStats"] .selection-stat').first()).toBeVisible();

  const result = await page.evaluate(() => {
    const units = Array.from(document.querySelectorAll(
      '[data-role="e2eStats"] .selection-stat, [data-role="npuStats"] .selection-stat'));
    const vw = document.documentElement.clientWidth;
    const boxes = units.map(u => ({ el: u.getBoundingClientRect(), fits: u.scrollWidth <= u.clientWidth + 1 }));
    const withinViewport = boxes.every(b => b.el.left >= -0.5 && b.el.right <= vw + 0.5);
    let overlap = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].el, b = boxes[j].el;
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (x > 1 && y > 1) overlap = true;
      }
    }
    return { count: boxes.length, allFit: boxes.every(b => b.fits), withinViewport, overlap };
  });

  expect(result.count).toBeGreaterThan(0);
  expect(result.allFit, 'no stat unit may clip horizontally').toBe(true);
  expect(result.withinViewport, 'no stat unit may spill past the viewport').toBe(true);
  expect(result.overlap, 'stat units must not overlap each other').toBe(false);
});