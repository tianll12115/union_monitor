const { test, expect } = require('./error-guard');

// BASIC-003: submission-time sorting follows the latest code submission
// (create / push), never creation time or reruns. A fixed opposite-clock
// fixture (§6) is injected via page.route so the expected order can be
// recomputed independently from the same inputs — never derived from the
// production sort function. The legacy `sort=created` URL alias must normalize
// the select to `submitted` rather than silently falling back to E2E.
const HOUR = 3600000, MIN = 60000;

function ev(id, kind, time_ms, source = null) {
  const e = { id, kind, time_ms };
  if (source) e.source = source;
  return e;
}

function batch(num) {
  return {
    number: num,
    url: `https://ci.openeuler.openatom.cn/job/ubs-engine/key/${num}/`,
    status: 'success', eligible: true, e2e_ms: 1800000, request_ms: 1000,
    end_ms: 1801000, jenkins_ms: 1700000, event_id: null, event_type: 'create',
    sha: 'sha', children: [], issues: [],
  };
}

function makePr(number, events, created_ms) {
  const batches = [batch(1000 + number)];
  if (events.length) batches[0].event_id = events[0].id;
  return {
    repository: 'openeuler/ubs-engine', number,
    title: `submission fixture PR ${number}`, state: 'merged', author: 'dev',
    url: `https://gitcode.com/openeuler/ubs-engine/pull/${number}`,
    created_ms, merged_ms: created_ms + 86400000, closed_ms: null,
    head_sha: String(number).padStart(40, '0'),
    submission_count: events.filter(e => e.kind !== 'retest').length,
    events, batches, issues: [],
  };
}

function buildSnapshot() {
  const prs = [];
  // §6 opposite-clock sample (Shanghai times): the newest code submission is a
  // push/creation that is not the creation order, plus a retest that must be
  // ignored and a created-time-less PR that must sort last.
  const t = (s) => Date.parse(s);
  prs.push(makePr(101, [
    ev('c101', 'create', t('2026-10-20T08:00:00+08:00'), 'PR.created_at'),
    ev('p101', 'push', t('2026-10-22T08:30:00+08:00'), 'operate_logs'),
    ev('r101', 'retest', t('2026-10-22T08:59:00+08:00'), 'comments'),
  ], t('2026-10-19T08:00:00+08:00')));
  prs.push(makePr(102, [
    ev('c102', 'create', t('2026-10-22T08:45:00+08:00'), 'PR.created_at'),
  ], t('2026-10-21T08:00:00+08:00')));
  prs.push(makePr(103, [
    ev('c103', 'create', t('2026-10-19T08:00:00+08:00'), 'PR.created_at'),
    ev('p103', 'push', t('2026-10-22T08:55:00+08:00'), 'operate_logs'),
  ], t('2026-10-18T08:00:00+08:00')));
  prs.push(makePr(104, [
    ev('c104', 'create', t('2026-10-18T08:00:00+08:00'), 'PR.created_at'),
    ev('p104', 'push', t('2026-10-22T08:55:00+08:00'), 'operate_logs'),
  ], t('2026-10-17T08:00:00+08:00')));
  prs.push(makePr(105, [], t('2026-10-22T08:00:00+08:00')));

  // 30 more records so the sample always exceeds one and two pages (>=31).
  const base = t('2026-10-01T00:00:00Z');
  for (let i = 106; i <= 135; i++) {
    const created = base + i * HOUR;
    const events = [ev(`c${i}`, 'create', created, 'PR.created_at')];
    if (i % 3 === 0) events.push(ev(`p${i}`, 'push', created + 30 * MIN, 'operate_logs'));
    prs.push(makePr(i, events, created));
  }
  return prs;
}

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

function fixture(prs) {
  return {
    repositories: {
      schema_version: 3, start_ms: Date.parse('2026-09-01T00:00:00Z'),
      end_ms: Date.parse('2026-10-30T00:00:00Z'), generated_at: '2026-10-22T00:00:00Z',
      repositories: [{ name: 'ubs-engine', repository: 'openeuler/ubs-engine', snapshot: 'repos/ubs-engine.json', status: 'success' }],
    },
    snapshot: {
      meta: { repository: 'openeuler/ubs-engine', start_ms: Date.parse('2026-09-01T00:00:00Z'), end_ms: Date.parse('2026-10-30T00:00:00Z'), collected_at: '2026-10-22T00:00:00Z', branch: 'master', errors: [] },
      prs,
    },
  };
}

async function serve(page, prs) {
  const data = fixture(prs);
  await page.route('**/data/repositories.json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data.repositories) }));
  await page.route('**/data/repos/ubs-engine.json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data.snapshot) }));
  return data;
}

async function currentPageRows(page) {
  return page.locator('#prRows tr[data-pr]').evaluateAll(rows => rows.map(r => Number(r.getAttribute('data-pr'))));
}

async function readAllPages(page) {
  const seen = [];
  for (;;) {
    seen.push(...await currentPageRows(page));
    const next = page.locator('#next');
    if (await next.isDisabled()) break;
    await next.click();
    await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();
  }
  return seen;
}

test('[BASIC-003] submitted sort follows code-submission time and the legacy sort=created alias normalizes', async ({ page }) => {
  const prs = buildSnapshot();
  await serve(page, prs);
  await page.goto('./#projects/ubs/engineering?repository=ubs-engine&sort=created');
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();
  // Legacy alias normalizes the select to the new submitted semantics instead
  // of falling back to the default E2E ordering.
  await expect(page.locator('#sort')).toHaveValue('submitted');
  await expect(page.locator('#sort option')).toHaveText(['代表 E2E 从长到短', '批次数从多到少', '提交时间从新到旧']);

  // The §6 opposite-clock sample must reorder by push/creation, not creation.
  await page.locator('#sort').selectOption('submitted');
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();
  const firstPage = await currentPageRows(page);
  expect(firstPage.slice(0, 4)).toEqual([104, 103, 102, 101]);

  const full = await readAllPages(page);
  expect(full).toEqual(expectedSubmittedOrder(prs));
  // The created-time-less PR must end the sequence.
  expect(full[full.length - 1]).toBe(105);
});