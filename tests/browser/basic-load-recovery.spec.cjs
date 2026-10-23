const { test, expect, allowError } = require('./error-guard');

// BASIC-009 / PSG-005: dual-community first-read and re-read failures are
// surfaced as real failure states (never a fabricated "success"), prior data
// identity is retained, the other community stays usable, and reload recovers.
// Only the SPECIFIC injected failure is allow-listed; any unrelated error —
// pageerror, console.error, request failure, or a key JSON/JS/CSS 4xx/5xx —
// still fails the test via the shared error guard.
//
// NOTE: a hash-only page.goto is a same-document navigation — it does NOT re-run
// load(). Recovery therefore uses page.reload() (or the app's own #reload button)
// so data is actually re-fetched.

async function readyTriton(page) {
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#triton-view [data-role="kE2eN"]')).toHaveText(/n=\d+/);
}

test('[BASIC-009] UBS and Triton first-read 503 show real failures, no fake success, and reload recovers', async ({ page }) => {
  // Allow exactly the two injected 503 data reads; everything else stays guarded.
  allowError(page, e => e.kind === 'response' && e.status === 503 && /repositories\.json|triton\.json/.test(e.url));

  let fail = true;
  await page.route('**/data/repositories.json*', route => fail ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue());
  await page.route('**/data/triton.json*', route => fail ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue());

  // First-read failure for UBS: a visible error, an empty repository table, and
  // no fabricated success rows.
  await page.goto('./#ubs');
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#loading')).toBeVisible();
  await expect(page.locator('#loading')).toContainText('无法读取看板');
  await expect(page.locator('#repositoryRows tr')).toHaveCount(0);
  await expect(page.locator('#ubs-view')).not.toContainText('采集完成');

  // First-read failure for Triton: error text, no KPI fabricated.
  await page.goto('./#projects/triton/engineering');
  await expect(page.locator('#triton-view')).toContainText('读取失败');
  await expect(page.locator('#triton-view [data-role="kE2eN"]')).toHaveCount(0);

  // Recovery after the fault is lifted: full reload re-reads both communities.
  fail = false;
  await page.goto('./#ubs');
  await page.reload();
  await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');
  await expect(page.locator('#loading')).toBeHidden();
  await page.goto('./#projects/triton/engineering');
  await readyTriton(page);
});

test('[BASIC-009] UBS and Triton first-read bad JSON or timeout never fabricate success, and the other community stays usable', async ({ page }) => {
  let repoFails = true;
  await page.route('**/data/repositories.json*', route => repoFails
    ? route.fulfill({ status: 200, contentType: 'application/json', body: 'not-json{' })
    : route.continue());

  // UBS bad JSON first-read → visible failure, no fabricated success.
  await page.goto('./#ubs');
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#loading')).toBeVisible();
  await expect(page.locator('#repositoryRows tr')).toHaveCount(0);

  // Triton is unaffected by the UBS failure: its real sample still renders.
  await page.goto('./#projects/triton/engineering');
  await readyTriton(page);

  // Triton timeout: abort the payload and reload; the failure is visible, the
  // KPI is never fabricated.
  await page.route('**/data/triton.json*', route => route.abort('timedout'));
  allowError(page, e => e.kind === 'requestfailed' && /triton\.json/.test(e.url));
  await page.reload();
  await expect(page.locator('#triton-view')).toContainText('读取失败');
  await expect(page.locator('#triton-view [data-role="kE2eN"]')).toHaveCount(0);

  // Recovery for both communities after both faults are lifted.
  repoFails = false;
  await page.unroute('**/data/triton.json*');
  await page.reload();
  await readyTriton(page);
  await page.goto('./#ubs');
  await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');
});

test('[BASIC-009] a failed re-read keeps the prior identity and the reload control stays available', async ({ page }) => {
  // Successful first read for both communities.
  await page.goto('./#ubs');
  await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');
  const ubsBefore = await page.locator('#repositoryRows').innerText();

  await page.goto('./#projects/triton/engineering');
  await readyTriton(page);
  const kpiBefore = await page.locator('#triton-view [data-role="kE2eN"]').innerText();

  // Re-read failure: route only Triton to 503 and use the app's reload control.
  await page.route('**/data/triton.json*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  allowError(page, e => e.kind === 'response' && e.status === 503 && /triton\.json/.test(e.url));
  await page.locator('#reload').click();
  await expect(page.locator('#triton-view [data-role="tritonError"]')).toContainText('重新读取失败');
  await expect(page.locator('#triton-view [data-role="tritonError"]')).toContainText('上一次成功读取');
  expect(await page.locator('#triton-view [data-role="kE2eN"]').innerText()).toBe(kpiBefore);

  // UBS re-read failure: old rows stay visible with an explanatory message.
  await page.unroute('**/data/triton.json*');
  await page.route('**/data/repositories.json*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  allowError(page, e => e.kind === 'response' && e.status === 503 && /repositories\.json/.test(e.url));
  await page.goto('./#ubs');
  await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');
  const ubsAfter = await page.locator('#repositoryRows').innerText();
  expect(ubsAfter).toBe(ubsBefore);
  await page.locator('#reload').click();
  await expect(page.locator('#loading')).toContainText('重新加载快照失败');
  await expect(page.locator('#repositoryRows')).toContainText('ubs-engine');

  // The reload control is never permanently disabled.
  await expect(page.locator('#reload')).toBeEnabled();
});