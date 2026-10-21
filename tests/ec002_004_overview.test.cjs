const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('./helpers/app-harness.cjs');

// EC-004: UBS shows a single representative-E2E card (P90 primary, P50 + n),
// never a PR-count / x86 / ARM / DT score card.
function batch(number, e2e_ms, status = 'success', extra = {}) {
  return {
    number, url: `t/${number}`, eligible: true, e2e_ms, status,
    cancelled: false, children: [], event_id: `e${number}`, request_ms: 1000,
    result: status === 'success' ? 'SUCCESS' : 'FAILURE',
    ...extra,
  };
}
function pr(number, e2e_ms, batches) {
  return {
    number, title: `PR ${number}`, state: 'merged', created_ms: 500, merged_ms: 4000,
    author: 'a', url: `u/${number}`, events: [], issues: [], submission_count: 1, head_sha: 's',
    batches,
  };
}

test('EC-004: kpiHTML renders one representative-E2E card with P90/P50/n, no score cards', () => {
  const app = createApp();
  const html = app.run("kpiHTML([{number:1,batches:[{number:1,url:'t/1',eligible:true,e2e_ms:25000,status:'success',children:[],result:'SUCCESS'}]},{number:2,batches:[{number:2,url:'t/2',eligible:true,e2e_ms:29000,status:'success',children:[],result:'SUCCESS'}]}])");
  assert.match(html, /data-metric="ubs_representative_e2e"/);
  assert.match(html, /代表门禁 E2E/);
  assert.match(html, /P90 · 分钟/);
  assert.match(html, /P50 0\.45/); // P50 of [25000,29000] = 27000 ms -> 0.45 min
  assert.match(html, /有效 2\/2 PR/);
  assert.doesNotMatch(html, /PR 数量/);
  assert.doesNotMatch(html, /x86 构建/);
  assert.doesNotMatch(html, /ARM 构建/);
  assert.doesNotMatch(html, /DT 测试/);
});

test('EC-002/EC-004: repo table pools P90/P50 and shows status counts, no x86/ARM/DT width', () => {
  const app = createApp();
  app.run(`
    repositoryIndex={generated_at:'2026-10-01T00:00:00Z',start_ms:1000,end_ms:9000,
      repositories:[{name:'ubs-engine',repository:'openeuler/ubs-engine',status:'success',snapshot:'repos/ubs-engine.json'}]};
    repositorySnapshots={'ubs-engine':{meta:{start_ms:1000,end_ms:9000,collected_at:'2026-10-01T00:00:00Z',repository:'openeuler/ubs-engine',branch:'master'},prs:[
      {number:1,title:'PR 1',state:'merged',created_ms:500,merged_ms:4000,author:'a',url:'u/1',events:[],issues:[],submission_count:1,head_sha:'s',
        batches:[{number:1,url:'t/1',eligible:true,e2e_ms:25000,status:'success',children:[],result:'SUCCESS',cancelled:false},
                 {number:2,url:'t/2',eligible:true,e2e_ms:20000,status:'failure',children:[],result:'FAILURE',cancelled:false}]},
      {number:2,title:'PR 2',state:'open',created_ms:600,merged_ms:null,author:'b',url:'u/2',events:[],issues:[],submission_count:1,head_sha:'s2',
        batches:[{number:3,url:'t/3',eligible:true,e2e_ms:29000,status:'running',children:[],result:'RUNNING',cancelled:true}]}
    ]}};
    renderRepositories();
  `);
  const rows = app.element('repositoryRows').innerHTML;
  assert.match(rows, /ubs-engine/);
  assert.match(rows, /P90 \/ P50 · n=2/);
  assert.match(rows, /1 \/ 1 \/ 1 \/ 1/); // success / failure / running / cancelled
  assert.match(rows, /采集完成/);
  assert.doesNotMatch(rows, /x86 总耗时/);
  assert.doesNotMatch(rows, /ARM 总耗时/);
  assert.doesNotMatch(rows, /DT 总耗时/);
  assert.match(rows, /次执行/);
  // Scope line reports observed PR/exec and the pooled valid sample, not an average of per-repo P90.
  const scope = app.element('repositoryCoverage').innerHTML;
  assert.match(scope, /已观测/);
  assert.match(scope, /有效 E2E/);
  assert.match(scope, /纳入/);
});