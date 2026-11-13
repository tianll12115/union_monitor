const {test,expect}=require('./error-guard');

test('data integrity: new CI contributes and all metric exclusions reconcile with selected runs',async({page})=>{
  const start='2026-11-10T00:00:00Z';
  const row=(id,changes={})=>({id:String(id),pr:id,title:`PR ${id}`,base_branch:'main',sha:String(id).repeat(40),
    start_at:start,end_at:'2026-11-10T00:20:00Z',duration_seconds:1200,status:'success',
    e2e_sample_eligible:true,is_integration_tests:true,npu_queue_seconds:60,missing:[],
    action_name:'Integration Tests',action_url:`https://github.com/triton-lang/triton-ascend/actions/runs/${id}/attempts/1`,
    workflows:[{id,attempt:1,name:'Integration Tests',workflow_id:348219361,path:'.github/workflows/ascend-ci.yml',jobs:[]}],...changes});
  const payload={e2e_metric_version:2,repo:'triton-lang/triton-ascend',window_start:'2026-11-09T00:00:00Z',
    window_end:'2026-11-12T00:00:00Z',collected_at:'2026-11-12T00:00:00Z',
    discovery:{enumerated_runs:100,candidate_runs:5,excluded_runs:95},
    batches:[row(1),row(2,{duration_seconds:600}),
      row(3,{pr:null,e2e_sample_eligible:false,e2e_exclusion_reason:'unresolved_pr_batch_identity'}),
      row(4,{is_integration_tests:false,e2e_sample_eligible:false,e2e_exclusion_reason:'outside_integration_tests',npu_queue_seconds:null,
        action_name:'Documentation',workflows:[{id:4,name:'Documentation',workflow_id:99,path:'.github/workflows/docs.yml',jobs:[]}]}),
      row(5,{e2e_sample_eligible:false,e2e_exclusion_reason:'invalid_or_missing_duration',duration_seconds:null,npu_queue_seconds:null,npu_data_missing:true})]};
  await page.route('**/data/triton.json*',r=>r.fulfill({json:payload}));
  await page.goto('./#projects/triton/engineering');
  await expect(page.locator('[data-role="kE2eN"]')).toContainText('n=2');
  await expect(page.locator('[data-role="kE2eP90"]')).toContainText('19.00');
  const accounting=page.locator('[data-role="sampleAccounting"]');
  await expect(accounting).toContainText('5 条运行');
  await expect(accounting).toContainText('4 个已关联 PR');
  await expect(accounting).toContainText('1 条未关联 PR');
  await expect(accounting).toContainText('E2E：纳入 2，排除 3');
  await expect(accounting).toContainText('NPU：纳入 3，排除 2');
  await expect(accounting).toContainText('NPU 跨全部工作流');
  await expect(accounting).toContainText('非 Integration Tests 1');
  await expect(page.locator('[data-role="boundary"]')).toContainText('发现对账：100 条源运行 = 5 条候选 + 95 条范围外运行');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
