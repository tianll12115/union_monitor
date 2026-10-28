const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeResult, recordResult, safeLink, jobTiming, workflowTiming, workflowMembers,
  focusJobs, focusKey, parseFocusName, relatedIndex, sameCommitRuns, npuJobRows,
  visiblePrCount, hoverModel, isIntegrationTestsRecord, circleMark,
} = require('../web/triton-core.js');

/* TS28-002/003/005/007 pure contracts: identity, timing, focus tasks, the
   same-commit candidate bucket and the same-PR visible group. */

function job(id, overrides = {}) {
  return {
    id, name: 'job-' + id, status: 'completed', conclusion: 'success',
    created_at: '2026-10-28T00:00:00Z', started_at: '2026-10-28T00:00:10Z',
    completed_at: '2026-10-28T00:10:00Z', ...overrides,
  };
}

function batch(id, overrides = {}) {
  return {
    id, pr: 7, sha: 'a'.repeat(40), title: 'Title ' + id, status: 'success',
    duration_seconds: 600, start_at: '2026-10-28T00:00:00Z', end_at: '2026-10-28T00:10:00Z',
    pr_url: 'https://github.com/triton-lang/triton-ascend/pull/7',
    action_url: 'https://github.com/example/actions/runs/1',
    workflows: [{ id: 100 + id.length, name: 'Integration Tests', attempt: 1, status: 'completed',
      conclusion: 'success', created_at: '2026-10-28T00:00:00Z', jobs_complete: true,
      jobs: [job(1)], url: 'https://github.com/example/actions/runs/1' }],
    npu_jobs: [], ...overrides,
  };
}

test('TS28-007: results normalize without defaulting a completed no-conclusion run to success', () => {
  assert.equal(normalizeResult('success'), 'success');
  assert.equal(normalizeResult('failure'), 'failure');
  assert.equal(normalizeResult('timed_out'), 'failure');
  assert.equal(normalizeResult('action_required'), 'failure');
  assert.equal(normalizeResult('startup_failure'), 'failure');
  assert.equal(normalizeResult('cancelled'), 'cancelled');
  assert.equal(normalizeResult('stale'), 'cancelled');
  assert.equal(normalizeResult('in_progress'), 'running');
  assert.equal(normalizeResult('queued'), 'running');
  assert.equal(normalizeResult('skipped'), 'skipped');
  assert.equal(normalizeResult('mystery'), 'unknown');
  assert.equal(recordResult({ status: 'completed' }), 'unknown');
  assert.equal(recordResult({ status: 'completed', conclusion: 'timed_out' }), 'failure');
  assert.equal(recordResult({ status: 'in_progress' }), 'running');
  assert.equal(recordResult(null), 'unknown');
});

test('TS28-005 AC2: only http(s) links are actionable, never javascript/data or empty values', () => {
  assert.equal(safeLink('https://github.com/x/actions/runs/1'), 'https://github.com/x/actions/runs/1');
  assert.equal(safeLink('http://example.com'), 'http://example.com');
  assert.equal(safeLink('javascript:alert(1)'), null);
  assert.equal(safeLink('data:text/html,<script>'), null);
  assert.equal(safeLink('  '), null);
  assert.equal(safeLink(null), null);
  assert.equal(safeLink(42), null);
});

test('TS28-003: job timing keeps zero/decimals and never clamps an inverted pair to zero', () => {
  const zero = jobTiming({ created_at: '2026-10-28T00:00:00Z', started_at: '2026-10-28T00:00:00Z',
    completed_at: '2026-10-28T00:00:00Z', status: 'completed' }, '2026-10-28T01:00:00Z');
  assert.equal(zero.waitSeconds, 0);
  assert.equal(zero.runSeconds, 0);
  const fraction = jobTiming({ created_at: '2026-10-28T00:00:00Z', started_at: '2026-10-28T00:00:10.250Z',
    completed_at: '2026-10-28T00:10:10.750Z', status: 'completed' }, '2026-10-28T01:00:00Z');
  assert.equal(fraction.waitSeconds, 10.25);
  assert.equal(fraction.runSeconds, 600.5);
  const inverted = jobTiming({ created_at: '2026-10-28T00:00:00Z', started_at: '2026-10-28T00:00:02Z',
    completed_at: '2026-10-28T00:00:01Z', status: 'completed' }, '2026-10-28T01:00:00Z');
  assert.equal(inverted.waitSeconds, 2);
  assert.equal(inverted.runSeconds, null);
  assert.match(inverted.anomaly, /结束早于开始/);
  const pythonFlag = jobTiming({ wait_seconds: 5, run_seconds: 0, run_inverted: true, wait_inverted: true });
  assert.equal(pythonFlag.waitSeconds, null);
  assert.equal(pythonFlag.runSeconds, null);
});

test('TS28-003 AC4: skipped jobs are not applicable; running/queued values are observed-only', () => {
  const skipped = jobTiming({ conclusion: 'skipped', status: 'completed' }, '2026-10-28T01:00:00Z');
  assert.equal(skipped.applicable, false);
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.waitSeconds, null);
  assert.equal(skipped.runSeconds, null);
  const running = jobTiming({ status: 'in_progress', conclusion: null, created_at: '2026-10-28T00:00:00Z',
    started_at: '2026-10-28T00:00:10Z', completed_at: null }, '2026-10-28T00:05:10Z');
  assert.equal(running.runSeconds, null);
  assert.equal(running.observedSeconds, 300);
  assert.equal(running.observedKind, 'run_observed_until_as_of');
  const queued = jobTiming({ status: 'queued', conclusion: null, created_at: '2026-10-28T00:00:00Z' },
    '2026-10-28T00:00:30Z');
  assert.equal(queued.observedSeconds, 30);
  assert.equal(queued.observedKind, 'queue_observed_until_as_of');
  const legacy = jobTiming({ status: 'completed', conclusion: 'success', wait_seconds: 4, run_seconds: 7 });
  assert.equal(legacy.waitSeconds, 4);
  assert.equal(legacy.runSeconds, 7);
  assert.equal(legacy.waitKind, 'source_provided');
});

test('TS28-002: workflow timing reads the collector contract or derives it from retained job times', () => {
  const contract = workflowTiming({ first_job_wait_seconds: 10, execution_span_seconds: 590,
    timing_complete: true, timing_missing_reason: null, jobs: [job(1)] });
  assert.equal(contract.firstJobWaitSeconds, 10);
  assert.equal(contract.executionSpanSeconds, 590);
  assert.equal(contract.missingReason, null);
  const derived = workflowTiming({ created_at: '2026-10-28T00:00:00Z', attempt: 1, jobs_complete: true,
    jobs: [job(1), job(2, { started_at: '2026-10-28T00:00:20Z', completed_at: '2026-10-28T00:12:00Z' })] });
  assert.equal(derived.firstJobWaitSeconds, 10);
  assert.equal(derived.executionSpanSeconds, 710);
  assert.equal(derived.complete, true);
  const noJobs = workflowTiming({ created_at: '2026-10-28T00:00:00Z', attempt: 1, jobs: [] });
  assert.equal(noJobs.executionSpanSeconds, null);
  assert.match(noJobs.missingReason, /无有效 job 明细/);
  const incomplete = workflowTiming({ created_at: '2026-10-28T00:00:00Z', attempt: 1,
    jobs_complete: false, jobs: [job(1)] });
  assert.equal(incomplete.executionSpanSeconds, null);
  assert.match(incomplete.missingReason, /分页不完整/);
  const rerun = workflowTiming({ created_at: '2026-10-28T00:00:00Z', attempt: 2, jobs_complete: true,
    jobs: [job(1)] });
  assert.equal(rerun.firstJobWaitSeconds, null);
  assert.match(rerun.missingReason, /重跑前置排队起点未知/);
  const enumerated = workflowTiming({ attempt: 2, attempt_source: 'enumerated', jobs_complete: true,
    jobs: [job(1, { created_at: '2026-10-28T00:00:00Z' })] });
  assert.equal(enumerated.firstJobWaitSeconds, 10);
  assert.equal(enumerated.originSource, 'first_job_created');
});

test('TS28-003: focus jobs detect A3/A5 matrices, dedupe by job id and include non-default partitions', () => {
  const names = [
    'integration-tests-ascend / integration-tests-ascend (linux-aarch64-a3-800i-4, py3.10)',
    'integration-tests-ascend / integration-tests-ascend (linux-aarch64-a3-800i-4, py3.11)',
    'integration-tests-ascend / integration-tests-ascend (linux-amd64-a5-2, py3.12)',
    'integration-tests-ascend / integration-tests-ascend (linux-aarch64-a3-800i-4, py3.12)',
    'runner-preparation / prepare',
  ];
  const jobs = names.map((name, i) => job(100 + i, { name }));
  const b = batch('focus', { workflows: [{ id: 9, attempt: 1, name: 'Integration Tests', jobs_complete: true, jobs }],
    focus_jobs: [{ id: 101, key: 'a3-py311', name: names[1], status: 'completed', conclusion: 'success',
      created_at: '2026-10-28T00:00:00Z', started_at: '2026-10-28T00:00:10Z', completed_at: '2026-10-28T00:10:00Z' }] });
  const result = focusJobs(b);
  assert.deepEqual(result.rows.map(row => row.key), ['a3-py310', 'a3-py311', 'a5-py312', 'a3-py312']);
  assert.equal(result.rows.filter(row => row.key === 'a3-py311').length, 1, 'same job id is never duplicated');
  assert.deepEqual(result.missing, []);
  const parsed = parseFocusName('linux-amd64-a5-2, py3.12');
  assert.deepEqual(parsed, { arch: 'amd64', chip: 'a5', python: '3.12' });
  assert.equal(focusKey(parsed), 'a5-py312');
  assert.equal(parseFocusName('windows-latest, py3.10'), null);
});

test('TS28-003 AC4: missing focus tasks explain skipped, failed detail and not-found separately', () => {
  const skipped = focusJobs(batch('skipped', { workflows: [{ id: 1, attempt: 1, name: 'Integration Tests',
    jobs_complete: true, jobs: [job(1, { name: 'x (linux-aarch64-a3-800i-4, py3.10)', conclusion: 'skipped' })] }] }));
  assert.equal(skipped.missing.find(item => item.key === 'a3-py310').reason, '已跳过（未触发）');
  const failed = focusJobs(batch('failed', { workflows: [{ id: 1, attempt: 1, name: 'Integration Tests',
    jobs_complete: false, jobs: [] }] }));
  assert.equal(failed.missing[0].reason, '明细采集失败');
  const other = focusJobs(batch('aux', { is_integration_tests: false, workflows: [] }));
  assert.equal(other.missing[0].reason, '本记录非 Integration Tests，E2E 不适用');
  const absent = focusJobs(batch('absent', { workflows: [{ id: 1, attempt: 1, name: 'Integration Tests',
    jobs_complete: true, jobs: [job(1, { name: 'runner-preparation / prepare' })] }] }));
  assert.equal(absent.missing[0].reason, '没有找到匹配任务');
});

test('TS28-002 AC2: same-commit bucket needs verified PR + full SHA and never includes the current identity', () => {
  const current = batch('current');
  const sameCommitRerun = batch('rerun', { pr: 7, sha: 'a'.repeat(40), status: 'failure',
    workflows: [{ id: 200, attempt: 2, name: 'Integration Tests', attempt_source: 'enumerated',
      jobs: [job(9)], url: 'https://github.com/example/actions/runs/200' }] });
  const otherPr = batch('otherpr', { pr: 8, sha: 'a'.repeat(40) });
  const otherSha = batch('othersha', { pr: 7, sha: 'b'.repeat(40) });
  const index = relatedIndex([current, sameCommitRerun, otherPr, otherSha]);
  const rows = sameCommitRuns(current, index);
  assert.deepEqual(rows.map(row => row.batchId), ['rerun']);
  assert.equal(rows[0].relationship, 'same_commit_unproven');
  assert.equal(rows[0].excludedFromE2e, true);
  assert.equal(rows[0].attempt, 2);
  assert.deepEqual(sameCommitRuns({ pr: null, sha: 'a'.repeat(40) }, index), []);
  assert.deepEqual(sameCommitRuns({ pr: 7, sha: null }, index), []);
  const direct = sameCommitRuns(current, [current, sameCommitRerun, otherPr, otherSha]);
  assert.deepEqual(direct.map(row => row.batchId), ['rerun']);
});

test('TS28-005 AC2: the same-PR visible count is per batch, not per chart duplicate', () => {
  const rows = [batch('one'), batch('two', { pr: 7 }), batch('three', { pr: 9 })];
  assert.equal(visiblePrCount(rows, 7), 2);
  assert.equal(visiblePrCount(rows, 9), 1);
  assert.equal(visiblePrCount(rows, null), 0);
});

test('TS28-001: the hover model exposes identity, links, reliable members, focus, related and boundary', () => {
  const current = batch('current');
  const rerun = batch('rerun', { workflows: [{ id: 300, attempt: 2, name: 'Integration Tests', jobs: [] }] });
  const model = hoverModel(current, {
    metric: 'e2e', batches: [current, rerun], index: relatedIndex([current, rerun]),
    collectedAt: '2026-10-28T02:00:00Z', discoveryCutoff: '2026-10-28T01:30:00Z',
    windowStart: '2026-10-27T00:00:00Z', windowEnd: '2026-10-28T02:00:00Z', visibleSamePr: 2,
  });
  assert.equal(model.pr, 7);
  assert.equal(model.prKnown, true);
  assert.equal(model.runId, 107);
  assert.equal(model.attempt, 1);
  assert.equal(model.durationSeconds, 600);
  assert.equal(model.links.pr, 'https://github.com/triton-lang/triton-ascend/pull/7');
  assert.equal(model.links.actions, 'https://github.com/example/actions/runs/1');
  assert.equal(model.reliable.members.length, 1);
  assert.equal(model.reliable.members[0].relationship, 'current_run');
  assert.equal(model.related.count, 1);
  assert.equal(model.related.rows[0].excludedFromE2e, true);
  assert.equal(model.boundary.visibleSamePr, 2);
  assert.equal(model.boundary.discoveryCutoff, '2026-10-28T01:30:00Z');
  assert.equal(model.npuApplicable, true);
  assert.equal(model.focus.rows.length, 0);
  assert.equal(model.focus.missing.length, 3);
});

test('TS28-001 AC1: unknown PR never invents a PR link; unsafe URLs are dropped', () => {
  const unknown = batch('unknown', { pr: null, pr_url: 'javascript:alert(1)', action_url: 'javascript:alert(2)',
    workflows: [{ id: 5, attempt: 1, name: 'Integration Tests', jobs: [], url: 'data:text/html,x' }],
    e2e_exclusion_reason: 'unresolved_pr_batch_identity' });
  const model = hoverModel(unknown, { metric: 'e2e', batches: [unknown], collectedAt: '2026-10-28T02:00:00Z' });
  assert.equal(model.prKnown, false);
  assert.equal(model.links.pr, null);
  assert.equal(model.links.actions, null);
  assert.equal(model.exclusionReason, 'unresolved_pr_batch_identity');
  assert.match(model.boundary.associationNote, /未可靠关联 PR/);
  assert.equal(model.related.count, 0);
});

test('TS28-002/003: an auxiliary record reports E2E not applicable while NPU rows stay independent', () => {
  const aux = batch('aux', { is_integration_tests: false, e2e_exclusion_reason: 'outside_integration_tests',
    npu_jobs: [{ id: 1, name: 'npu', status: 'completed', conclusion: 'success',
      created_at: '2026-10-28T00:00:00Z', started_at: '2026-10-28T00:00:20Z',
      completed_at: '2026-10-28T00:01:00Z' }] });
  const model = hoverModel(aux, { metric: 'npu', batches: [aux], collectedAt: '2026-10-28T02:00:00Z' });
  assert.equal(model.npuApplicable, false);
  assert.match(model.npuNotApplicableReason, /E2E 不适用/);
  assert.equal(model.npu.queueSeconds, 20);
  assert.equal(model.npu.jobs.length, 1);
  assert.equal(isIntegrationTestsRecord(aux), false);
  assert.equal(isIntegrationTestsRecord(batch('legacy')), true);
});

test('TS28-005 AC1: every mark starts at 3.5 CSS px with no state-dependent base radius', () => {
  for (const status of ['success', 'failure', 'cancelled', 'running']) {
    const html = circleMark({ status, pr: 1 }, 10, 20, 3, '#000', 'e2e');
    assert.match(html, /<circle class="dot" r="3.5"/);
    assert.doesNotMatch(html, /r="4\.2"|r="3\.2"/);
  }
});
