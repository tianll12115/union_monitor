const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the real view against bounded DOM/timer boundaries. Browser gates test
// the rendered layout and focus; these checks inspect its actual markup/state.
function viewHarness() {
  const nodes = new Map(), documentListeners = new Set(), resizeListeners = new Set(), intervals = new Set(), downloads = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      selector, innerHTML:'', textContent:'', value:'', hidden:false, style:{}, dataset:{}, clientWidth:900,
      isConnected:true, children:[{}], classList:{toggle(){},contains(){return false;}},
      querySelectorAll(){return [];}, querySelector(){return null;}, contains(){return false;},
      captures:new Set(),
      setAttribute(name,value){this[name]=value;}, getBoundingClientRect(){return {x:0,y:0,left:0,width:900,height:370};},
      focus(){}, setPointerCapture(id){this.captures.add(id);}, releasePointerCapture(id){this.captures.delete(id);},
    });
    return nodes.get(selector);
  };
  const container = node('container');
  container.querySelector = node;
  const context = {
    ...require('../web/triton-core.js'), Units:require('../web/units.js'), Date, Intl, Blob,
    Metrics:{async saveCsv(rows,name){downloads.push({name,rows});return {mode:'saved',name,url:'/exports/'+name};}},
    URL:{createObjectURL(blob){downloads.push({blob});return 'blob:qualifications';},revokeObjectURL(){}},
    document:{activeElement:null,getElementById:node,createElement(){return {click(){downloads[downloads.length-1].name=this.download;}};},addEventListener(_e,f){documentListeners.add(f);},removeEventListener(_e,f){documentListeners.delete(f);}},
    addEventListener(_e,f){resizeListeners.add(f);},removeEventListener(_e,f){resizeListeners.delete(f);},
    setTimeout(){return 1;},clearTimeout(){},setInterval(f){intervals.add(f);return f;},clearInterval(f){intervals.delete(f);},
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/triton-view.js'),'utf8'),context,
    {filename:require.resolve('../web/triton-view.js')});
  return {view:context.TritonView,container,node,documentListeners,resizeListeners,intervals,downloads};
}

function sample() {
  const batches = Array.from({length:10},(_,i)=>({id:i===9?'failed-long':'batch-'+i,pr:i+1,title:'Example',base_branch:'main',
    sha:'abc',status:i===9?'failure':'success',duration_seconds:i===9?2000:600,
    start_at:'2026-10-10T01:00:00Z',end_at:'2026-10-10T01:33:20Z',missing:[],workflows:[],npu_jobs:[],
    e2e_sample_eligible:true,pr_url:'https://github.com/example/repo/pull/'+(i+1)}));
  batches.push({id:'unresolved',pr:null,title:'未关联',base_branch:'未知目标分支',sha:'def',status:'failure',duration_seconds:5,
    start_at:'2026-10-10T01:00:00Z',end_at:'2026-10-10T01:00:05Z',missing:['未可靠关联 PR'],
    e2e_sample_eligible:false,e2e_exclusion_reason:'unresolved_pr_batch_identity',workflows:[{id:123,attempt:1,jobs:[]}],npu_jobs:[]});
  return {window_start:'2026-10-10T00:00:00Z',window_end:'2026-10-11T00:00:00Z',collected_at:'2026-10-11T00:01:00Z',batches};
}

test('NPU median trend uses completed qualified samples, matching its P50 and count', () => {
  const data = sample();
  data.batches = [];
  for (const hour of [1, 7]) {
    for (const [status, value, missing] of [['success', 0, false], ['failure', 60, false], ['running', 9000, false], ['cancelled', 10000, false], ['success', 11000, true]]) {
      data.batches.push({id: `${hour}-${status}-${value}`, pr: 1, base_branch: 'main', status,
        start_at: `2026-10-10T${String(hour).padStart(2, '0')}:00:00Z`,
        duration_seconds: 600, npu_queue_seconds: value, npu_data_missing: missing});
    }
  }
  const h = viewHarness(); h.view.render(data, h.container);
  const svg = h.node('[data-role="npuChart"]').innerHTML;
  const max = 11000 * 1.12;
  const expectedY = 328 - 30 / max * 310;
  const path = svg.match(/class="median-line" d="([^"]+)"/)[1];
  const ys = [...path.matchAll(/,[\d.]+/g)].map(x => Number(x[0].slice(1)));
  assert.equal(ys.length, 2);
  for (const y of ys) assert.ok(Math.abs(y - expectedY) < 1e-9, `${y} should map P50=30s`);
  assert.match(h.node('[data-role="kNpuN"]').textContent, /^n=4/);
});

test('real attention markup renders a failed slow batch once with multiple reasons', () => {
  const h=viewHarness();h.view.render(sample(),h.container);
  const markup=h.node('[data-role="attention"]').innerHTML;
  assert.equal((markup.match(/<article[^>]*id="triton-batch-[^"]*-failed-long"/g)||[]).length,1);
  assert.match(markup,/耗时偏长/);
  assert.match(markup,/失败/);
});

test('real unknown-PR markup has a run identity and never a fake PR hyperlink', () => {
  const h=viewHarness();h.view.render(sample(),h.container);
  const markup=h.node('[data-role="attention"]').innerHTML;
  assert.doesNotMatch(markup,/href="#"/);
  assert.match(markup,/Run #123/);
  assert.match(markup,/E2E 排除/);
});

test('deactivation closes the card and clears resources, while remount restores query state once', () => {
  const h=viewHarness(),data=sample();h.view.render(data,h.container);
  h.node('[data-role="search"]').value='Example';
  h.node('[data-role="tip"]').style.display='block';
  assert.equal(typeof h.view.deactivate,'function');
  h.view.deactivate();
  assert.equal(h.node('[data-role="tip"]').style.display,'none');
  assert.equal(h.documentListeners.size,0);assert.equal(h.resizeListeners.size,0);assert.equal(h.intervals.size,0);
  h.node('[data-role="search"]').value='';h.view.render(data,h.container);
  assert.equal(h.node('[data-role="search"]').value,'Example');
  assert.equal(h.documentListeners.size,1);assert.equal(h.resizeListeners.size,1);assert.equal(h.intervals.size,1);
  h.view.render(data,h.container);
  assert.equal(h.documentListeners.size,1);assert.equal(h.intervals.size,1);
});

test('record export matches the displayed attention list and persists qualification metadata separately', async () => {
  const h=viewHarness();h.view.render(sample(),h.container);
  await h.node('[data-role="exportBatches"]').onclick();
  assert.equal(h.downloads.length,2);
  assert.equal(h.downloads[0].rows[0].length,16);
  // ADR-007: the download set equals the visible attention list (dedup by batch id),
  // not the full search pool — header + failed-long + unresolved.
  assert.equal(h.downloads[0].rows.length,3);
  assert.equal(h.downloads[1].name,'triton-qualifications-v1.json');
  const metadata=JSON.parse(await h.downloads[1].blob.text());
  assert.equal(metadata.schema_version,1);
  assert.equal(metadata.batches.length,2);
  assert.equal(metadata.batches.find(batch=>batch.id==='unresolved').e2e_sample_eligible,false);
});

test('ADR-007: show-all export reuses the complete sorted search pool (list == download)', async () => {
  const h=viewHarness();h.view.render(sample(),h.container);
  h.node('[data-role="showAll"]').onclick();
  await h.node('[data-role="exportBatches"]').onclick();
  assert.equal(h.downloads[0].rows.length,12); // header + all 11 batches
  const metadata=JSON.parse(await h.downloads[1].blob.text());
  assert.equal(metadata.batches.length,11);
});

test('deactivation releases a navigator pointer that was still captured mid-drag', () => {
  const h=viewHarness();h.view.render(sample(),h.container);
  const navigator=h.node('[data-role="navigator"]');
  navigator.onpointerdown({preventDefault(){},pointerId:42,clientX:450,target:{dataset:{drag:'window'}}});
  assert.equal(navigator.captures.size,1);
  h.view.deactivate();
  assert.equal(navigator.captures.size,0);
  assert.equal(navigator.onpointermove,null);
});

test('EC-004: Triton shows two metric cards (E2E + NPU queue) with P90/P50/n, no PR/batch score cards', () => {
  const h=viewHarness();h.view.render(sample(),h.container);
  assert.match(h.node('[data-role="kE2eN"]').textContent,/^n=\d+/);
  assert.match(h.node('[data-role="kE2eP50"]').textContent,/^P50 /);
  assert.match(h.node('[data-role="kE2eP90"]').textContent,/\d/);
  assert.match(h.node('[data-role="kNpuN"]').textContent,/^n=/);
  assert.match(h.node('[data-role="kNpuP50"]').textContent,/^P50 /);
  const src=fs.readFileSync(require.resolve('../web/triton-view.js'),'utf8');
  assert.doesNotMatch(src,/data-role="kPr"/,'涉及 PR score card retired');
  assert.doesNotMatch(src,/data-role="kBatch"/,'门禁批次 score card retired');
  assert.match(src,/data-metric="triton_batch_e2e"/);
  assert.match(src,/data-metric="triton_npu_max_queue"/);
});

test('EC-008-AC03: 起点未知但有来源身份的批次可从“时间未知(n)”入口找到且导出标时间未知', async () => {
  const data = sample();
  data.batches.push({ id: 'unknown-start', pr: 900, title: '起点未知批次', base_branch: 'main', sha: '99999999', kind: 'initial', status: 'success', duration_seconds: 600,
    start_at: null, end_at: '2026-10-10T01:00:00Z', missing: [], workflows: [{ id: 999, attempt: 1, jobs: [] }],
    action_url: 'https://github.com/triton-lang/triton-ascend/actions/runs/999', npu_jobs: [], start_source: 'workflow_created', approximate: false });
  const h = viewHarness(); h.view.render(data, h.container);
  assert.match(h.node('[data-role="unknownTime"]').textContent, /时间未知\(1\)/);
  assert.doesNotMatch(h.node('[data-role="attention"]').innerHTML, /unknown-start/);
  h.node('[data-role="unknownTime"]').onclick();
  const markup = h.node('[data-role="attention"]').innerHTML;
  assert.match(markup, /unknown-start/);
  assert.match(markup, /起点未知/);
  assert.match(h.node('[data-role="priorityNote"]').textContent, /不计入选区分位数/);
  await h.node('[data-role="exportBatches"]').onclick();
  const rows = h.downloads[0].rows;
  const startIdx = rows[0].indexOf('start_at');
  const row = rows.find(r => String(r[0]) === '900');
  assert.ok(row, 'unknown-start batch exported');
  assert.equal(row[startIdx], '时间未知');
});
