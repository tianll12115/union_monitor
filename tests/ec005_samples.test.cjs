'use strict';
/* EC-005: independent E2E / NPU sample qualification and P50 derivation.
   The arithmetic is pinned to the fixed acceptance sample in
   docs/requirements/2026-10-21-engineering-capability-dashboard.md §7. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../web/core.js');
const T = require('../web/triton-core.js');

function ubsPr(id, batches) {
  return { number: id, title: 'P' + id, author: 'a', state: 'merged', created_ms: 1, merged_ms: 2, closed_ms: null, head_sha: 's', submission_count: 1, url: 'https://x', events: [], issues: [], batches };
}
function ubsBatch(id, e2e_ms, eligible, status) {
  return { number: id, url: 'trigger/' + id, e2e_ms, eligible, status, request_ms: 1, end_ms: 2, children: [], issues: [], event_id: null };
}

test('EC-005-AC01: UBS representative E2E derives P50 and P90 from per-PR longest eligible batch', () => {
  const prs = [
    ubsPr(1, [ubsBatch(1, 10000, true, 'success'), ubsBatch(2, 30000, true, 'failure')]),
    ubsPr(2, [ubsBatch(3, 20000, true, 'success')]),
    ubsPr(3, [ubsBatch(4, null, false, 'failure'), ubsBatch(5, null, false, 'running'), ubsBatch(6, null, false, 'incomplete')]),
  ];
  const agg = M.statsWithP50(prs.map(p => M.metrics(p.batches).e2e_ms));
  assert.equal(agg.n, 2, 'e2e_valid = 2 of 3 PRs');
  assert.equal(agg.p50, 25000, 'P50 = 25000 ms');
  assert.equal(agg.p90, 29000, 'P90 = 29000 ms');
  assert.equal(agg.mean, 25000);
});

function tritonBatch(o) {
  return Object.assign({ id: o.id, pr: o.pr, status: o.status, duration_seconds: o.duration_seconds, npu_data_missing: o.npu_data_missing === true, npu_queue_seconds: o.npu_queue_seconds }, o.e2e_sample_eligible === undefined ? {} : { e2e_sample_eligible: o.e2e_sample_eligible });
}

test('EC-005-AC02: Triton E2E and NPU samples are independent with distinct P50/P90', () => {
  const rows = [
    tritonBatch({ id: 'T1', pr: 1, status: 'success', e2e_sample_eligible: true, duration_seconds: 0, npu_data_missing: false, npu_queue_seconds: 0 }),
    tritonBatch({ id: 'T2', pr: 2, status: 'failure', e2e_sample_eligible: true, duration_seconds: 120, npu_data_missing: false, npu_queue_seconds: 180 }),
    tritonBatch({ id: 'T3', pr: 2, status: 'cancelled', e2e_sample_eligible: false, duration_seconds: 60, npu_data_missing: false, npu_queue_seconds: 30 }),
    tritonBatch({ id: 'T4', pr: 3, status: 'running', e2e_sample_eligible: false, duration_seconds: null, npu_data_missing: true, npu_queue_seconds: null }),
    tritonBatch({ id: 'T5', pr: null, status: 'success', e2e_sample_eligible: false, duration_seconds: 600, npu_data_missing: false, npu_queue_seconds: 60 }),
  ];
  const e2e = T.chartStats(rows, 'e2e');
  assert.equal(e2e.count, 2, 'e2e_valid = 2');
  assert.equal(e2e.p50, 60, 'E2E P50 = 60s');
  assert.equal(e2e.p90, 108, 'E2E P90 = 108s');
  const npu = T.chartStats(rows, 'npu');
  assert.equal(npu.count, 3, 'npu_valid = 3 (unknown-PR T5 keeps its NPU evidence)');
  assert.equal(npu.p50, 60, 'NPU P50 = 60s');
  assert.equal(npu.p90, 156, 'NPU P90 = 156s');
});

test('EC-005-AC02: making only T2 NPU missing changes NPU but not E2E', () => {
  const rows = [
    tritonBatch({ id: 'T1', pr: 1, status: 'success', e2e_sample_eligible: true, duration_seconds: 0, npu_data_missing: false, npu_queue_seconds: 0 }),
    tritonBatch({ id: 'T2', pr: 2, status: 'failure', e2e_sample_eligible: true, duration_seconds: 120, npu_data_missing: true, npu_queue_seconds: 180 }),
    tritonBatch({ id: 'T5', pr: null, status: 'success', e2e_sample_eligible: false, duration_seconds: 600, npu_data_missing: false, npu_queue_seconds: 60 }),
  ];
  const e2e = T.chartStats(rows, 'e2e');
  assert.equal(e2e.p50, 60, 'E2E unchanged when NPU is missing');
  assert.equal(e2e.p90, 108);
  const npu = T.chartStats(rows, 'npu');
  assert.equal(npu.count, 2, 'npu_valid = 2');
  assert.equal(npu.p50, 30, 'NPU P50 = 30s');
  assert.equal(npu.p90, 54, 'NPU P90 = 54s');
});

test('EC-005-AC03: nulling only the raw E2E duration must not erase valid NPU evidence', () => {
  const rows = [
    tritonBatch({ id: 'T1', pr: 1, status: 'success', e2e_sample_eligible: true, duration_seconds: 0, npu_data_missing: false, npu_queue_seconds: 0 }),
    tritonBatch({ id: 'T2', pr: 2, status: 'failure', e2e_sample_eligible: true, duration_seconds: null, npu_data_missing: false, npu_queue_seconds: 180 }),
    tritonBatch({ id: 'T5', pr: null, status: 'success', e2e_sample_eligible: false, duration_seconds: 600, npu_data_missing: false, npu_queue_seconds: 60 }),
  ];
  const e2e = T.chartStats(rows, 'e2e');
  assert.equal(e2e.count, 1, 'only T1 remains an E2E sample');
  assert.equal(e2e.p50, 0, 'the legal 0 second sample survives');
  const npu = T.chartStats(rows, 'npu');
  assert.equal(npu.count, 3, 'NPU keeps all three valid samples');
  assert.equal(npu.p50, 60, 'NPU P50 = 60s');
  assert.equal(npu.p90, 156, 'NPU P90 = 156s');
});
