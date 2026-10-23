'use strict';
/* UAR-001~008 regression tests (2026-10-21 user audit).
   These lock the corrected contracts behind the records list:
   - default entity is one PR per row; the batch view is an explicit expert view
   - the elapsed queue time is read from the real trigger evidence
   - search honors number/title/author/SHA in both entities
   - sorting rebuilds the per-entity options before assigning a value
   - the detail URL round-trips PR + selected batch
   - a records URL rebuilds its complete state from defaults, and clearing
     advanced conditions syncs the URL */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../web/records.js');
const Q = require('../web/query-state.js');
const D = require('../web/detail.js');
const { createApp } = require('./helpers/app-harness.cjs');

function fixture() {
  return {
    meta: {
      repository: 'ubs-engine', branch: 'master',
      start_ms: 1789955185009, end_ms: 1792547185009,
      collected_at: '2026-10-21T00:00:00+08:00',
    },
    prs: [
      {
        number: 100, title: 'Alpha', author: 'alice', state: 'merged',
        created_ms: 1, merged_ms: 2, closed_ms: null, head_sha: 'aaaa1111',
        submission_count: 2, url: 'https://gitcode.com/openeuler/ubs-engine/pulls/100',
        events: [], issues: [], batches: [
          { number: 1, url: 'https://ci/trigger/1', e2e_ms: 800000, eligible: true, status: 'success', request_ms: 100, end_ms: 900000, children: [], issues: [], event_id: null, sha: 'aaaa1111', trigger: { number: 1, queue_ms: 50000 } },
          { number: 2, url: 'https://ci/trigger/2', e2e_ms: 900000, eligible: true, status: 'success', request_ms: 200, end_ms: 1100000, children: [], issues: [], event_id: null, sha: 'bbbb2222', trigger: { number: 2, queue_ms: 60000 } },
        ],
      },
      {
        number: 101, title: 'Beta hw-sgl', author: 'bob', state: 'open',
        created_ms: 3, merged_ms: null, closed_ms: null, head_sha: 'cccc3333',
        submission_count: 1, url: 'https://gitcode.com/openeuler/ubs-engine/pulls/101',
        events: [], issues: [], batches: [
          { number: 3, url: 'https://ci/trigger/3', e2e_ms: null, eligible: false, status: 'incomplete', request_ms: 400, end_ms: null, children: [], issues: ['缺关联'], event_id: null, sha: null, trigger: null },
        ],
      },
    ],
  };
}

function app() {
  const a = createApp();
  a.context.QueryState = Q;
  a.context.Records = R;
  a.context.Detail = D;
  return a;
}

/* Prevent the full single-repo render (which draws SVG charts the DOM double
   does not implement) while still exercising applyProjectRoute's state model. */
function captureRoute(a) {
  a.run('applyRoute=(r)=>globalThis.appliedRoute=r;');
}

function indexExpr() {
  return "repositoryIndex={generated_at:'2026-10-21T00:00:00Z',start_ms:1789955185009,end_ms:1792547185009,schema_version:3,repositories:[{name:'ubs-engine',repository:'openeuler/ubs-engine',snapshot:'repos/ubs-engine.json',status:'success'}]}";
}

test('UAR-004: the public queue field reads the real trigger evidence, not the absent top-level field', () => {
  const rows = R.ubsBatchRecords(fixture());
  const byNumber = Object.fromEntries(rows.map(r => [r.number, r]));
  assert.equal(byNumber[1].queue_ms, 50000, 'trigger.queue_ms=50000 is surfaced');
  assert.equal(byNumber[2].queue_ms, 60000, 'trigger.queue_ms=60000 is surfaced');
  assert.equal(byNumber[3].queue_ms, null, 'no trigger evidence stays unknown, not zero');
});

test('UAR-005: batch records carry number/title/author/sha so public search honors them', () => {
  const rows = R.ubsBatchRecords(fixture());
  const q = text => Q.selectList(rows, text, [r => r.pr, r => r.title, r => r.author, r => r.sha, r => r.number, r => r.batch_id]);
  assert.equal(q('hw-sgl').length, 1, 'title search matches');
  assert.equal(q('alice').length, 2, 'author search matches both executions of PR 100');
  assert.equal(q('bbbb2222').length, 1, 'full SHA search matches its execution');
  assert.equal(q('2').some(r => r.number === 2), true, 'trigger number search matches');
});

test('UAR-003: ISO start_at strings normalize to epoch ms instead of sorting as unknown', () => {
  const rows = [
    { start_at: '2026-10-20T00:00:00Z', batch_id: 'iso' },
    { start_at: 1000, batch_id: 'num' },
    { start_at: null, batch_id: 'missing' },
  ];
  const asc = R.sortRecords(rows, 'start', 'asc');
  assert.deepEqual(asc.map(r => r.batch_id), ['num', 'iso', 'missing'], 'ISO is a finite ms, missing stays last');
});

test('UAR-001: the records entry defaults to one PR per row', () => {
  const a = app();
  captureRoute(a);
  assert.equal(a.run('entity'), 'prs', 'module default entity is PR');
  a.run("entity='prs';renderEntityChrome()");
  assert.equal(a.element('entity').value, 'prs');
  assert.equal(a.element('recordTitle').textContent, 'PR 效率明细');
  a.run("applyProjectRoute({project:'ubs',task:'records',query:{}})");
  assert.equal(a.run('entity'), 'prs', 'a bare records URL stays on the PR default');
});

test('UAR-003: switching entity rebuilds sort options before assigning a sort value', () => {
  const a = app();
  captureRoute(a);
  a.run(indexExpr());
  a.run("applyProjectRoute({project:'ubs',task:'records',query:{entity:'prs',sort:'batches'}})");
  assert.equal(a.element('sort').value, 'batches', 'a PR-sort value survives the entity switch (CP-03)');
  a.run("applyProjectRoute({project:'ubs',task:'records',query:{entity:'batches',sort:'queue'}})");
  assert.equal(a.element('sort').value, 'queue', 'a batch-sort value survives the reverse switch');
});

test('UAR-008: a bare records URL rebuilds full state from defaults, not prior residue', () => {
  const a = app();
  captureRoute(a);
  a.run(indexExpr());
  a.run("applyProjectRoute({project:'ubs',task:'records',query:{q:'needle',state:'merged',ps:'50',page:'3'}})");
  assert.equal(a.element('query').value, 'needle');
  assert.equal(a.element('state').value, 'merged');
  assert.equal(a.run('pageSize'), 50);
  assert.equal(a.run('page'), 3);
  a.run("applyProjectRoute({project:'ubs',task:'records',query:{}})");
  assert.equal(a.element('query').value, '', 'search resets');
  assert.equal(a.element('state').value, '', 'state resets');
  assert.equal(a.run('pageSize'), 15, 'page size resets');
  assert.equal(a.run('page'), 1, 'page resets');
});

test('UAR-008: clearing the state filter rewrites the URL', () => {
  const a = app();
  a.element('state').value = 'merged';
  a.element('state').selectedOptions = [{ textContent: '已合入' }];
  a.context.location.hash = '#projects/ubs/records?state=merged';
  a.run('render=()=>{};globalThis.syncCalls=0;syncRecordsUrl=()=>globalThis.syncCalls++;renderActiveConditions([])');
  a.element('clearConditions').onclick();
  assert.equal(a.element('state').value, '', 'state cleared');
  assert.equal(a.context.syncCalls, 1, 'the clear action syncs the share URL exactly once');
});

test('EC-007: legacy tf/qf conditions report the retired advanced panel instead of filtering', () => {
  const a = app();
  captureRoute(a);
  a.run(indexExpr());
  a.run("applyProjectRoute({project:'ubs',task:'records',query:{tf:'push',qf:'incomplete'}})");
  const notice = a.element('notice');
  assert.equal(notice.hidden, false, 'a notice is shown');
  assert.match(notice.textContent, /触发方式/, 'trigger condition named as removed');
  assert.match(notice.textContent, /数据完整性/, 'quality condition named as removed');
  assert.match(notice.textContent, /未按这些条件筛选/, 'explicitly not applied');
});

test('UAR-006/UAR-007: the detail binds and round-trips the selected batch identity', () => {
  const a = app();
  const snap = fixture();
  a.run('snapshot=' + JSON.stringify(snap));
  a.run(indexExpr());
  a.run("currentRepository='ubs-engine';view='ubs-repo';entity='prs'");
  a.run("openDetail(100,'https://ci/trigger/1',false)");
  assert.equal(a.run('detailChoice.batch.url'), 'https://ci/trigger/1', 'the explicit entry batch is selected');
  assert.equal(a.run('recordsState().batch'), 'https://ci/trigger/1', 'the URL state carries the selected batch');
  const urlWithBatch = a.run('recordsUrl()');
  assert.ok(urlWithBatch.includes('pr=100'), 'URL carries pr');
  const parsed = a.run(`Router.parseRoute(${JSON.stringify(urlWithBatch)})`);
  assert.equal(parsed.query.batch, 'https://ci/trigger/1');
});