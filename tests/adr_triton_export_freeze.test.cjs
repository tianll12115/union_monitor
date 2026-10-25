const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// ADR-013: the Triton export freezes rows + scope + qualification before the
// first await, so a filter change mid-request cannot split CSV from its audit.
function harness() {
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
  let releaseSave;
  const context = {
    ...require('../web/triton-core.js'), Units: require('../web/units.js'), Date, Intl, Blob,
    Metrics: {
      saveCsv(rows, name) { downloads.push({ name, rows }); return new Promise(res => { releaseSave = () => res({ mode: 'saved', name, url: '/exports/' + name }); }); },
    },
    URL: { createObjectURL(blob) { downloads.push({ blob }); return 'blob:x'; }, revokeObjectURL() {} },
    document: { activeElement: null, getElementById: node, createElement() { return { click() {} }; }, addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {}, setTimeout() { return 1; }, clearTimeout() {}, setInterval(f) { return f; }, clearInterval() {},
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/triton-view.js'), 'utf8'), context);
  return { view: context.TritonView, container, node, downloads, resolve: () => releaseSave() };
}

function sample() {
  const batches = Array.from({ length: 4 }, (_, i) => ({
    id: 'batch-' + i, pr: i + 1, title: 'Example', base_branch: 'main', sha: 'abc',
    status: i === 3 ? 'failure' : 'success', duration_seconds: i === 3 ? 2000 : 600,
    start_at: '2026-10-10T01:00:00Z', end_at: '2026-10-10T01:33:20Z', missing: [], workflows: [], npu_jobs: [],
    e2e_sample_eligible: true, pr_url: 'https://github.com/example/repo/pull/' + (i + 1),
  }));
  return { window_start: '2026-10-10T00:00:00Z', window_end: '2026-10-11T00:00:00Z', collected_at: '2026-10-11T00:01:00Z', batches };
}

test('ADR-013: the qualification sidecar is frozen before the export await', async () => {
  const h = harness();
  h.view.render(sample(), h.container);
  h.node('[data-role="search"]').value = 'Example';
  const pending = h.node('[data-role="exportBatches"]').onclick();
  // mid-request filter change (the bug used to leak this into the sidecar)
  h.node('[data-role="search"]').value = 'Changed';
  h.node('[data-role="search"]').oninput();
  h.resolve();
  await pending;
  const csvRows = h.downloads[0].rows;
  const qual = JSON.parse(await h.downloads[1].blob.text());
  assert.equal(qual.analysis_scope.query, 'Example', 'scope must reflect the frozen start, not the mid-request change');
  assert.equal(qual.analysis_scope.branches.length, 0);
  assert.equal(csvRows.length, qual.batches.length + 1, 'CSV body and sidecar batches describe the same set');
});