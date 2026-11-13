const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../web/triton-core.js');

test('a published snapshot that excludes registered new CI cannot keep a trusted old E2E KPI',()=>{
  const row={pr:1,status:'success',duration_seconds:1200,e2e_sample_eligible:false,is_integration_tests:false,
    e2e_exclusion_reason:'outside_integration_tests',npu_queue_seconds:70,
    workflows:[{workflow_id:348219361,path:'.github/workflows/ascend-ci.yml'}]};
  const payload={e2e_metric_version:2,batches:[row]};
  const corrected=core.normalizeE2ePayload(payload);
  assert.match(corrected.e2e_metric_notice,/工作流范围/);
  assert.equal(corrected.batches[0].duration_seconds,null);
  assert.equal(corrected.batches[0].npu_queue_seconds,70);
  assert.equal(payload.batches[0].duration_seconds,1200);
});

test('quarantined source job execution cannot be reconstructed from raw timestamps in the UI',()=>{
  const job={status:'completed',created_at:'2026-11-10T00:00:00Z',started_at:'2026-11-10T00:00:10Z',
    completed_at:'2026-11-10T00:01:00Z',run_seconds:null,timeline_conflict:true,measurement_error:'源 job/step 时间矛盾'};
  const timing=core.jobTiming(job,'2026-11-10T00:02:00Z');
  assert.equal(timing.waitSeconds,10);
  assert.equal(timing.runSeconds,null);
  assert.match(timing.anomaly,/job\/step/);
});

test('neutral outcomes stay neutral in run, workflow and export detail models',()=>{
  assert.equal(core.recordResult({status:'completed',conclusion:'neutral'}),'neutral');
  assert.equal(core.normalizeResult('neutral'),'neutral');
  const members=core.workflowMembers({workflows:[{id:1,status:'completed',conclusion:'neutral',jobs:[]}]});
  assert.equal(members[0].result,'neutral');
});

test('NPU details keep incomplete maxima unknown and auxiliary NPU evidence applicable',()=>{
  const row={pr:1,is_integration_tests:false,npu_data_missing:true,npu_queue_seconds:null,
    workflows:[{id:1,name:'Documentation',jobs:[]}],
    npu_jobs:[{id:1,status:'completed',wait_seconds:11},{id:2,status:'completed',wait_seconds:null}]};
  const model=core.hoverModel(row,{metric:'npu'});
  assert.equal(model.npuQueueSeconds,null);
  assert.equal(model.npuApplicable,true);
  assert.equal(model.npu.applicable,true);
  assert.match(model.boundary.associationNote,/Documentation/);
  assert.doesNotMatch(model.boundary.associationNote,/当前 Integration Tests/);
  const missing=core.hoverModel({...row,npu_jobs:[]},{metric:'npu'});
  assert.equal(missing.npuApplicable,false);
  assert.match(missing.npuNotApplicableReason,/NPU/);
});

test('PR history uses proven integration scope rather than mutable workflow display names',()=>{
  const row={id:'old',pr:1,sha:'a',is_integration_tests:true,start_at:'2026-11-10'};
  const renamed={...row,id:'new',sha:'b',start_at:'2026-11-11',action_name:'Renamed NPU CI'};
  const unrelated={...row,id:'aux',sha:'c',is_integration_tests:false,action_name:'Integration Tests'};
  assert.deepEqual(core.prHistory([row,renamed,unrelated],row).map(g=>g.sha),['a','b']);
});

test('sample accounting partitions all runs without treating missing or unknown as zero',()=>{
  const rows=[
    {pr:1,status:'success',duration_seconds:10,e2e_sample_eligible:true,is_integration_tests:true,npu_queue_seconds:3},
    {pr:null,status:'failure',duration_seconds:12,e2e_sample_eligible:false,is_integration_tests:true,e2e_exclusion_reason:'unresolved_pr_batch_identity',npu_queue_seconds:4},
    {pr:2,status:'cancelled',duration_seconds:8,e2e_sample_eligible:false,is_integration_tests:true,e2e_exclusion_reason:'non_sample_result',npu_queue_seconds:2},
    {pr:1,status:'success',duration_seconds:7,e2e_sample_eligible:false,is_integration_tests:false,e2e_exclusion_reason:'outside_integration_tests'},
    {pr:3,status:'success',duration_seconds:null,e2e_sample_eligible:false,is_integration_tests:true,e2e_exclusion_reason:'invalid_or_missing_duration',npu_queue_seconds:null,npu_data_missing:true},
  ];
  const a=core.metricAccounting(rows);
  assert.deepEqual(a,{total:5,knownPrs:3,unresolved:1,
    e2e:{included:1,excluded:4,reasons:{unresolved_pr_batch_identity:1,non_sample_result:1,outside_integration_tests:1,invalid_or_missing_duration:1}},
    npu:{included:2,excluded:3,reasons:{non_sample_result:1,no_npu_jobs:1,missing_or_invalid_npu:1}}});
  assert.equal(a.e2e.included+a.e2e.excluded,a.total);
  assert.equal(a.npu.included+a.npu.excluded,a.total);
  assert.deepEqual(core.metricAccounting([]),{total:0,knownPrs:0,unresolved:0,e2e:{included:0,excluded:0,reasons:{}},npu:{included:0,excluded:0,reasons:{}}});
});

test('running, invalid, and explicit non-integration flags never enter E2E through a missing eligibility field',()=>{
  const rows=[{pr:1,status:'success',duration_seconds:10,is_integration_tests:false},
    {pr:1,status:'running',duration_seconds:8},
    {pr:1,status:'success',duration_seconds:-1},
    {pr:1,status:'failure',duration_seconds:9,e2e_sample_eligible:false}];
  assert.equal(core.dashboardStats(rows).valid,0);
  assert.deepEqual(core.metricAccounting(rows).e2e.reasons,{outside_integration_tests:1,running_observation:1,invalid_or_missing_duration:1,explicit_metric_exclusion:1});
});

test('NPU accounting preserves independent measurements and does not infer unavailable jobs',()=>{
  const rows=[{pr:1,status:'running',npu_queue_seconds:5},
    {pr:2,status:'success',npu_queue_seconds:-2,npu_jobs:[{id:1}]},
    {pr:3,status:'success',npu_queue_seconds:0,npu_data_missing:true}];
  assert.deepEqual(core.metricAccounting(rows).npu,{included:0,excluded:3,reasons:{non_sample_result:1,missing_or_invalid_npu:2}});
});
