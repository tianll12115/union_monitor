const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// ADR-012: the Triton state (branches, window, search, chart filters, open
// detail) round-trips through the URL so a copied link reconstructs it.
function urlHarness(initialHash) {
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
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/triton-view.js'), 'utf8'), context,
    {filename: require.resolve('../web/triton-view.js')});
  return { view: context.TritonView, container, node, location, opened };
}

function sample() {
  const batches = Array.from({ length: 6 }, (_, i) => ({
    id: 'batch-' + i, pr: i + 1, title: 'Example', base_branch: 'main', sha: 'abc',
    status: i === 5 ? 'failure' : 'success', duration_seconds: i === 5 ? 2000 : 600,
    start_at: '2026-10-10T01:00:00Z', end_at: '2026-10-10T01:33:20Z', missing: [], workflows: [], npu_jobs: [],
    e2e_sample_eligible: true, pr_url: 'https://github.com/example/repo/pull/' + (i + 1),
  }));
  return { window_start: '2026-10-10T00:00:00Z', window_end: '2026-10-11T00:00:00Z', collected_at: '2026-10-11T00:01:00Z', batches };
}

test('ADR-012: a deep link reconstructs branches/search/filters/window and echoes them back', () => {
  const from = Date.parse('2026-10-10T00:00:00Z'), to = Date.parse('2026-10-11T00:00:00Z');
  const h = urlHarness(`#projects/triton/engineering?branch=main&q=Example&filter=failure&npu=running&from=${from}&to=${to}`);
  h.view.render(sample(), h.container);
  assert.equal(h.node('[data-role="search"]').value, 'Example');
  assert.equal(h.node('[data-role="branchSummary"]').textContent, '合入分支：已选 1 项');
  assert.match(h.location.hash, /branch=main/);
  assert.match(h.location.hash, /q=Example/);
  assert.match(h.location.hash, /filter=failure/);
  assert.match(h.location.hash, /npu=running/);
  assert.match(h.location.hash, new RegExp(`from=${from}`));
  assert.match(h.location.hash, new RegExp(`to=${to}`));
});

test('ADR-012: filter changes are mirrored into the URL as the state changes', () => {
  const h = urlHarness('#projects/triton/engineering');
  h.view.render(sample(), h.container);
  assert.match(h.location.hash, /from=/);
  h.node('[data-role="search"]').value = 'Example';
  h.node('[data-role="search"]').oninput();
  assert.match(h.location.hash, /q=Example/);
});

test('ADR-012: the open detail batch is shareable via URL and cleared on close', () => {
  const h = urlHarness('#projects/triton/engineering');
  h.view.render(sample(), h.container);
  h.view.setDetailBatch('batch-3');
  assert.match(h.location.hash, /batch=batch-3/);
  h.view.clearDetailBatch();
  assert.doesNotMatch(h.location.hash, /batch=/);
});

test('ADR-012: a batch deep link is preserved through the mount sync', () => {
  const h = urlHarness('#projects/triton/engineering?batch=batch-3');
  h.view.render(sample(), h.container);
  assert.match(h.location.hash, /batch=batch-3/);
});

test('warm hash navigation replaces an empty branch selection with the new URL state', () => {
  const h = urlHarness('#projects/triton/engineering?branch=absent');
  const data = sample();
  h.view.render(data, h.container);
  assert.equal(h.node('[data-role="kE2eN"]').textContent, 'n=0');
  h.location.hash = '#projects/triton/engineering?branch=main&filter=failure';
  h.view.render(data, h.container);
  assert.match(h.node('[data-role="kE2eN"]').textContent, /^n=6/);
  const chart = h.node('[data-role="chart"]').innerHTML;
  assert.equal((chart.match(/class="mark-hit"/g) || []).length, 1);
  assert.match(h.location.hash, /branch=main/);
});

test('warm navigation to a plain Triton URL resets omitted filters and search', () => {
  const h = urlHarness('#projects/triton/engineering?branch=absent&q=old&filter=failure');
  const data = sample();
  h.view.render(data, h.container);
  h.location.hash = '#projects/triton/engineering';
  h.view.render(data, h.container);
  assert.match(h.node('[data-role="kE2eN"]').textContent, /^n=6/);
  assert.equal(h.node('[data-role="search"]').value, '');
  assert.equal((h.node('[data-role="chart"]').innerHTML.match(/class="mark-hit"/g) || []).length, 6);
});

test('closing the old detail during navigation must not overwrite the destination hash', () => {
  const h = urlHarness('#projects/triton/engineering?branch=absent');
  h.view.render(sample(), h.container);
  h.view.setDetailBatch('batch-1');
  h.location.hash = '#projects/triton/engineering?branch=main';
  h.view.clearDetailBatch();
  assert.equal(h.location.hash, '#projects/triton/engineering?branch=main');
});
