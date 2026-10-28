const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

/* TA-001..TA-014 整改的确定性契约检查：只断言可在无浏览器环境下可靠成立
   的状态、markup 与纯函数行为；像素级、Escape/冷加载等交由 Chromium 门禁。 */

function harness(initialHash) {
  const nodes = new Map(), downloads = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      selector, innerHTML: '', textContent: '', value: '', hidden: false, style: {}, dataset: {}, clientWidth: 900,
      isConnected: true, children: [{}], classList: { toggle() {}, contains() { return false; } },
      querySelectorAll() { return []; }, querySelector() { return null; }, contains() { return false; },
      setAttribute(name, value) { this[name] = value; }, getBoundingClientRect() { return { x: 0, y: 0, left: 0, width: 900, height: 370 }; },
      focus() {}, setPointerCapture() {}, releasePointerCapture() {},
    });
    return nodes.get(selector);
  };
  const container = node('container');
  container.querySelector = node;
  const location = { hash: initialHash || '#projects/triton/engineering' };
  const history = { replaceState(_s, _t, url) { location.hash = url; } };
  const opened = [];
  const context = {
    ...require('../web/triton-core.js'), Units: require('../web/units.js'), Date, Intl, Blob,
    Router: require('../web/router.js'), location, history,
    openTritonDetail: b => { opened.push(b); },
    Metrics: { async saveCsv(rows, name) { downloads.push({ name, rows }); return { mode: 'saved', name, url: '/exports/' + name }; } },
    URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
    document: { activeElement: null, getElementById: node, createElement() { return { click() {} }; }, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {}, setTimeout() { return 1; }, clearTimeout() {}, setInterval(f) { return f; }, clearInterval() {},
    requestAnimationFrame(f) { return 0; }, cancelAnimationFrame() {},
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/triton-view.js'), 'utf8'), context,
    { filename: require.resolve('../web/triton-view.js') });
  return { view: context.TritonView, container, node, location, opened, downloads };
}

function payload(extra) {
  const batches = Array.from({ length: 3 }, (_, i) => ({
    id: 'batch-' + i, pr: i + 1, title: 'Example', base_branch: 'main', sha: 'abc',
    status: 'success', duration_seconds: 600 + i * 60,
    start_at: '2026-10-10T0' + (i + 1) + ':00:00Z', end_at: '2026-10-10T01:33:20Z', missing: [], workflows: [], npu_jobs: [],
    e2e_sample_eligible: true, pr_url: 'https://github.com/example/repo/pull/' + (i + 1),
  }));
  return { window_start: '2026-10-10T00:00:00Z', window_end: '2026-10-11T00:00:00Z', collected_at: '2026-10-11T00:01:00Z', batches, ...(extra || {}) };
}

test('TA-002: every scatter mark records its true anchor, which equals the dot when not spread', () => {
  const h = harness();
  h.view.render(payload(), h.container);
  const chart = h.node('[data-role="chart"]').innerHTML;
  const marks = chart.match(/<g class="mark-hit"[^>]*>/g) || [];
  assert.equal(marks.length, 3, 'three marks rendered');
  for (const mark of marks) {
    assert.match(mark, /data-anchor-x="[0-9.e-]+"/, 'anchor-x recorded: ' + mark);
    assert.match(mark, /data-anchor-y="[0-9.e-]+"/, 'anchor-y recorded: ' + mark);
  }
  // Non-overlapping marks (distinct start times) are not spread: dot == anchor.
  for (const mark of marks) {
    const dx = mark.match(/data-x="([0-9.e-]+)"/)[1], dy = mark.match(/data-y="([0-9.e-]+)"/)[1];
    const ax = mark.match(/data-anchor-x="([0-9.e-]+)"/)[1], ay = mark.match(/data-anchor-y="([0-9.e-]+)"/)[1];
    assert.equal(dx, ax, 'dot x stays at anchor x');
    assert.equal(dy, ay, 'dot y stays at anchor y');
  }
  assert.doesNotMatch(chart, /class="anchor-tick"/, 'no redundant anchor ticks');
  assert.doesNotMatch(chart, /class="anchor-lead"/, 'no leader line when nothing collides');
});

test('TA-002: overlapping marks retain actual coordinates without a leader line', () => {
  const h = harness();
  const data = payload();
  data.batches[1].start_at = data.batches[0].start_at;
  data.batches[1].duration_seconds = data.batches[0].duration_seconds;
  h.view.render(data, h.container);
  const chart = h.node('[data-role="chart"]').innerHTML;
  assert.doesNotMatch(chart, /class="anchor-lead"/, 'overlap must not invent displacement');
  const marks = chart.match(/<g class="mark-hit"[^>]*>/g) || [];
  assert.equal(marks.length, 3);
  const spread = marks.filter(m => m.includes('data-x') && (m.match(/data-x="([0-9.e-]+)"/)[1] !== m.match(/data-anchor-x="([0-9.e-]+)"/)[1] || m.match(/data-y="([0-9.e-]+)"/)[1] !== m.match(/data-anchor-y="([0-9.e-]+)"/)[1]));
  assert.equal(spread.length, 0, 'all dots remain at actual coordinates');

});

test('auxiliary workflow duration cannot distort Integration Tests axis or plotted samples', () => {
  const h=harness(),data=payload();
  data.batches[2].duration_seconds=172949;
  data.batches[2].e2e_sample_eligible=false;
  data.batches[2].e2e_exclusion_reason='outside_integration_tests';
  h.view.render(data,h.container);
  const chart=h.node('[data-role="chart"]').innerHTML;
  assert.doesNotMatch(chart,/data-i="2"/);
  assert.match(chart,/>12\.32 min<\/text>/);
  assert.doesNotMatch(h.container.innerHTML,/E2E 从提交事件/);
});

test('TA-005: the boundary line discloses window, discovery cutoff and collection time', () => {
  const h = harness();
  const data = payload({ discovery: { fetch_window_end: '2026-10-10T23:00:00Z', boundary_note: '创建时间发现回溯 14 天，不宣称全量' } });
  h.view.render(data, h.container);
  const boundary = h.node('[data-role="boundary"]').textContent;
  assert.match(boundary, /统计窗口/);
  assert.match(boundary, /创建发现截至/);
  assert.match(boundary, /采集完成/);
  assert.match(boundary, /14 天/);
});

test('TA-009: the unknown-time pool honours branch and search, not just the time window', () => {
  const h = harness();
  const data = payload();
  data.batches.push({ id: 'unknown-main', pr: 9, title: 'Matches needle', base_branch: 'main', sha: 'x',
    status: 'failure', start_at: null, end_at: '2026-10-10T02:00:00Z', duration_seconds: null, missing: ['未可靠关联 PR'],
    e2e_sample_eligible: false, action_url: 'https://github.com/example/runs/9', workflows: [], npu_jobs: [] });
  data.batches.push({ id: 'unknown-dev', pr: 10, title: 'Other', base_branch: 'dev', sha: 'y',
    status: 'failure', start_at: null, end_at: '2026-10-10T03:00:00Z', duration_seconds: null, missing: ['未可靠关联 PR'],
    e2e_sample_eligible: false, action_url: 'https://github.com/example/runs/10', workflows: [], npu_jobs: [] });
  h.view.render(data, h.container);
  assert.match(h.node('[data-role="unknownTime"]').textContent, /时间未知\(2\)/);
  // Restrict to branch=main + search=needle: only the main unknown survives.
  h.location.hash = '#projects/triton/engineering?branch=main&q=needle&unknown=1';
  h.view.render(data, h.container);
  const list = h.node('[data-role="attention"]').innerHTML;
  assert.match(list, /unknown-main/);
  assert.doesNotMatch(list, /unknown-dev/);
});

test('TA-010: a legal zero keeps source/window/collection context and a zero-row export', () => {
  const h = harness();
  h.view.render(payload({ batches: [] }), h.container);
  const html = h.container.innerHTML;
  assert.match(html, /data-state="empty"/);
  assert.match(html, /合法零数据/);
  assert.match(html, /统计窗口/);
  assert.match(html, /采集完成/);
  assert.match(html, /data-role="exportBatches"/, 'zero-row export entry is present');
});

test('TA-010: an invalid window and a missing payload are distinct error states', () => {
  const h = harness();
  h.view.render({ window_start: '2026-10-11T00:00:00Z', window_end: '2026-10-10T00:00:00Z', batches: [{ id: 'x' }] }, h.container);
  assert.match(h.container.innerHTML, /data-state="invalid"/);
  assert.match(h.container.innerHTML, /时间窗无效/);
  h.view.render({ batches: 'not-an-array' }, h.container);
  assert.match(h.container.innerHTML, /data-state="invalid"/);
  assert.match(h.container.innerHTML, /缺失或格式无效/);
});

test('TA-013: the two reference lines carry readable names, not bare dashed lines', () => {
  const h = harness();
  h.view.render(payload(), h.container);
  const chart = h.node('[data-role="chart"]').innerHTML;
  assert.match(chart, /图内 P90/);
  const legend = h.node('container').innerHTML;
  assert.match(legend, /图内 P90/);
  assert.match(legend, /六小时桶中位数/);
});

test('TA-011: the navigator reverse-mapping is the pure navTimeAt contract (shared inset)', () => {
  const { navTimeAt } = require('../web/triton-core.js');
  assert.equal(navTimeAt(4, 0, 100, 0, 1000, { l: 4, r: 4 }), 0);
  assert.equal(navTimeAt(96, 0, 100, 0, 1000, { l: 4, r: 4 }), 1000);
  assert.equal(navTimeAt(50, 0, 100, 0, 1000, { l: 4, r: 4 }), 500);
  assert.equal(navTimeAt(0, 0, 0, 0, 1000, { l: 4, r: 4 }), 0, 'degenerate width returns the domain start');
});
