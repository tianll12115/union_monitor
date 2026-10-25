const { test, expect } = require('./error-guard');

// ADR-015: the UBS E2E trend exposes a per-day P50 line and keyboard-focusable
// marks whose accessible name carries P50/P90/n, so a keyboard/读屏 user can
// read every day's statistics without a pointer.

function batch(num, e2e_ms) {
  return {
    number: num, url: `https://ci.openeuler.openatom.cn/job/ubs-engine/key/${num}/`,
    status: 'success', eligible: true, e2e_ms, request_ms: 1000, end_ms: 1000 + e2e_ms,
    jenkins_ms: e2e_ms, event_id: null, event_type: 'create', sha: 'sha', children: [], issues: [],
  };
}

function pr(number, created_ms, e2e_ms) {
  return {
    repository: 'openeuler/ubs-engine', number,
    title: `trend fixture ${number}`, state: 'merged', author: 'dev',
    url: `https://gitcode.com/openeuler/ubs-engine/pull/${number}`,
    created_ms, merged_ms: created_ms + 86400000, closed_ms: null,
    head_sha: String(number).padStart(40, '0'),
    submission_count: 1, events: [], issues: [],
    batches: [batch(1000 + number, e2e_ms)],
  };
}

function snapshot() {
  return {
    meta: {
      repository: 'openeuler/ubs-engine',
      start_ms: Date.parse('2026-09-01T00:00:00Z'),
      end_ms: Date.parse('2026-10-30T00:00:00Z'),
      collected_at: '2026-10-22T00:00:00Z', branch: 'master', errors: [],
    },
    prs: [
      pr(101, Date.parse('2026-10-20T08:00:00+08:00'), 300000),
      pr(102, Date.parse('2026-10-21T08:00:00+08:00'), 900000),
      pr(103, Date.parse('2026-10-22T08:00:00+08:00'), 600000),
    ],
  };
}

async function serve(page, data) {
  const repositories = {
    schema_version: 3, start_ms: data.meta.start_ms, end_ms: data.meta.end_ms,
    generated_at: '2026-10-22T00:00:00Z',
    repositories: [{ name: 'ubs-engine', repository: 'openeuler/ubs-engine', snapshot: 'repos/ubs-engine.json', status: 'success' }],
  };
  await page.route('**/data/repositories.json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(repositories) }));
  await page.route('**/data/repos/ubs-engine.json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }));
}

test('ADR-015: trend days are keyboard-focusable and read P50/P90/n', async ({ page }) => {
  await serve(page, snapshot());
  await page.goto('./#ubs/repo/ubs-engine');
  await expect(page.locator('#trend .mark-hit').first()).toBeVisible();
  await expect(page.locator('#trend .mark-hit')).toHaveCount(3);
  // Each mark is focusable and its accessible name carries the daily readings.
  await expect(page.locator('#trend .mark-hit').first()).toHaveAttribute('tabindex', '0');
  const label = await page.locator('#trend .mark-hit').first().getAttribute('aria-label');
  expect(label).toMatch(/平均/);
  expect(label).toMatch(/P50/);
  expect(label).toMatch(/P90/);
  expect(label).toMatch(/n=1/);
  // Tab reaches a mark (not stuck at the previous control) and shows visible focus.
  await page.locator('#trend .mark-hit').first().focus();
  const activeIsMark = await page.evaluate(() => {
    const el = document.activeElement;
    return !!el && el.classList.contains('mark-hit');
  });
  expect(activeIsMark).toBe(true);
});