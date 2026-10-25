const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./helpers/app-harness.cjs');

const VALID = {
  window_start: '2026-10-10T00:00:00Z', window_end: '2026-10-11T00:00:00Z',
  collected_at: '2026-10-11T00:01:00Z',
  batches: [{ id: 'b1', pr: 1, status: 'success', duration_seconds: 60, start_at: '2026-10-10T01:00:00Z' }],
};
const BAD_WINDOW = {
  window_start: '2026-10-11T00:00:00Z', window_end: '2026-10-10T00:00:00Z',
  collected_at: '2026-10-11T00:01:00Z', batches: [],
};
const LEGAL_EMPTY = {
  window_start: '2026-10-10T00:00:00Z', window_end: '2026-10-11T00:00:00Z',
  collected_at: '2026-10-11T00:01:00Z', batches: [],
};

function harness(sequence) {
  return createApp({
    fetch: async (url) => {
      if (url.includes('triton.json')) {
        const next = sequence.length > 1 ? sequence.shift() : sequence[0];
        return { ok: true, json: async () => next };
      }
      if (url.includes('repositories.json')) {
        return { ok: true, json: async () => ({ generated_at: 'x', start_ms: 1, end_ms: 2, repositories: [] }) };
      }
      if (url.includes('catalog.json') || url.includes('release.json')) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    },
    setTimeout() { return 1; }, clearTimeout() {},
  });
}

async function settle(app) {
  await app.run('load()');
  for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

test('ADR-011: a bad Triton window is rejected and the previous payload is retained', async () => {
  const app = harness([VALID, BAD_WINDOW]);
  await settle(app);
  assert.equal(app.run('tritonStatus'), 'ok');
  assert.equal(app.run('window.tritonPayload.window_end'), '2026-10-11T00:00:00Z');
  assert.equal(app.run('window.tritonPayload.batches.length'), 1);
  await settle(app);
  assert.equal(app.run('tritonStatus'), 'failed');
  assert.equal(app.run('window.tritonPayload.window_end'), '2026-10-11T00:00:00Z', 'previous valid payload retained');
  assert.equal(app.run('window.tritonPayload.batches.length'), 1, 'bad-window data did not overwrite');
  assert.match(app.run('tritonError'), /时间窗无效/);
});

test('ADR-011: a legal empty window goes through the full shell as legal zero data', async () => {
  const app = harness([LEGAL_EMPTY]);
  await settle(app);
  assert.equal(app.run('tritonStatus'), 'ok');
  assert.equal(app.run('window.tritonPayload.batches.length'), 0);
});