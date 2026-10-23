/* Dated adversarial audit: records observations without changing application files. */
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {chromium}=require(path.resolve(__dirname,'../../node_modules/@playwright/test'));
const root=path.resolve(__dirname,'../..');
const output=path.resolve(root,'audit/2026-10-23-requirements-review');
fs.mkdirSync(path.join(output,'screenshots'),{recursive:true});
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/minimal/repos/ubs-engine.json')));
const results={baseline:'88ed1aa1e30a46f825527cc5f8cffa0116b657ad',mode:'offline-fixture, real Chromium',
 fixture_sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'tests/fixtures/minimal/repos/ubs-engine.json'))).digest('hex'),
 recorded_at:new Date().toISOString(),cases:[]};
const base=process.env.AUDIT_BASE_URL||'http://dashboard.test:8899/';
async function downloadText(download){const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);return Buffer.concat(chunks).toString('utf8');}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP dashboard.test 127.0.0.1','--proxy-server=direct://']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  for(const width of [1440,390]){
   const navPage=await context.newPage();await navPage.setViewportSize({width,height:1000});
   const errors=[];navPage.on('pageerror',e=>errors.push(e.message));
   await navPage.goto(base);await navPage.locator('#sideTasks a[data-nav="ubs"]').waitFor();
   const firstUrl=navPage.url();
   const links=await navPage.getByRole('navigation',{name:'主导航'}).getByRole('link').allTextContents();
   await navPage.locator('#sideTasks a[data-nav="triton"]').click();
   await navPage.locator('#triton-view [data-role="kE2eN"]').waitFor();
   const actual={first_url:firstUrl,links,link_count:links.length,url_after_click:navPage.url(),
    active_links:await navPage.locator('#sideTasks a.active').count(),errors,
    project_selector_count:await navPage.locator('#sideProjectSelector').count(),
    task_placeholder_visible:await navPage.locator('#project-task-view').isVisible()};
   results.cases.push({id:`NAV-${width}`,title:'Cold start and one-click community navigation',
    requirement_ids:['EC-001'],actual,verification_passed:links.length===2&&actual.active_links===1&&
     firstUrl.includes('#projects/ubs/overview')&&actual.url_after_click.includes('#projects/triton/engineering')&&
     !actual.task_placeholder_visible&&actual.project_selector_count===0&&errors.length===0});
   await navPage.close();
  }
  for(const scenario of ['independent','npu-missing','e2e-missing']){
   const data=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/minimal/triton.json')));
   const seed=data.batches[0];
   const specText=fs.readFileSync(path.join(root,'docs/requirements/2026-10-21-engineering-capability-dashboard.md'),'utf8');
   const contract=JSON.parse(specText.match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);
   data.batches=contract.triton_sample.batches.map(r=>({...structuredClone(seed),...r}));
   const t2=data.batches.find(r=>r.id==='T2');
   if(scenario==='e2e-missing')t2.duration_seconds=null;
   if(scenario==='npu-missing')t2.npu_data_missing=true;
   const metricPage=await context.newPage();
   await metricPage.route('**/data/triton.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
   await metricPage.goto(base+'#triton');await metricPage.locator('#triton-view [data-role="kE2eN"]').waitFor();
   const actual={};for(const key of ['kE2eP50','kE2eP90','kE2eN','kNpuP50','kNpuP90','kNpuN'])actual[key]=await metricPage.locator(`[data-role="${key}"]`).innerText();
   const expected=scenario==='npu-missing'?{kE2eP50:'1.00 min',kE2eP90:'1.80 min',kE2eN:'n=2',kNpuP50:'0.50 min',kNpuP90:'0.90 min',kNpuN:'n=2'}:
    scenario==='e2e-missing'?{kE2eP50:'0.00 min',kE2eP90:'0.00 min',kE2eN:'n=1',kNpuP50:'1.00 min',kNpuP90:'2.60 min',kNpuN:'n=3'}:
    {kE2eP50:'1.00 min',kE2eP90:'1.80 min',kE2eN:'n=2',kNpuP50:'1.00 min',kNpuP90:'2.60 min',kNpuN:'n=3'};
   results.cases.push({id:'METRIC-'+scenario,requirement_ids:['EC-005'],actual,expected,verification_passed:Object.keys(expected).every(key=>actual[key].includes(expected[key]))});
   await metricPage.close();
  }
  let page=await context.newPage();
  await page.goto(base+'#ubs/repo/ubs-engine');
  await page.locator('#prRows tr[data-pr]').first().waitFor();
  const before=await page.locator('#kpis').innerText();
  await page.locator('#state').selectOption('merged');
  const after=await page.locator('#kpis').innerText();
  results.cases.push({id:'RUNTIME-01',title:'UBS lifecycle list filter changes analysis KPI',
   requirement_ids:['EC-007','UAR-008','UDR-016'],expected:'S KPI remains unchanged by list state filter',
   before,after,confirmed:before!==after});
  await page.locator('#query').fill('AUDIT-NO-MATCH-20261023');
  const beforeUrl=page.url();
  await page.evaluate(()=>{location.hash='#projects/ubs/engineering?repository=gitcode%3Aopeneuler%2Fubs-engine';});
  await page.waitForTimeout(250);
  const leaked={query:await page.locator('#query').inputValue(),state:await page.locator('#state').inputValue(),
   count:await page.locator('#prCount').innerText(),url:page.url()};
  results.cases.push({id:'RUNTIME-02',title:'Explicit engineering URL inherits prior list state',
   requirement_ids:['EC-009','UAR-009','UDR-020'],expected:'Missing query parameters select defaults rather than prior state',
   before_url:beforeUrl,actual:leaked,confirmed:leaked.query!==''||leaked.state!==''});
  await page.screenshot({path:path.join(output,'screenshots/ubs-implicit-filter.png'),fullPage:true});
  await page.close();
  page=await context.newPage();
  const synthetic=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/minimal/triton.json')));
  const seed=synthetic.batches[0];
  synthetic.batches=Array.from({length:12},(_,i)=>({...structuredClone(seed),id:`audit-batch-${i}`,pr:200+i,
   title:`Controlled successful sample ${i}`,sha:(200+i).toString(16).padStart(40,'0'),
   duration_seconds:(i+1)*60,status:'success',complete:true,missing:[],e2e_sample_eligible:true}));
  fs.writeFileSync(path.join(output,'triton-export-controlled-input.json'),JSON.stringify(synthetic,null,2));
  await page.route('**/data/triton.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(synthetic)}));
  await page.goto(base+'#triton');
  await page.locator('#triton-view .row-main').first().waitFor();
  const shown=await page.locator('#triton-view .row-main').count();
  const listTitle=await page.locator('#triton-view [data-role="attention"] .group-title').innerText();
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出批次 CSV',exact:true}).click();
  const csv=await downloadText(await downloadEvent);
  fs.writeFileSync(path.join(output,'triton-default-export.csv'),csv);
  const csvLines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  const displayedPrs=await page.locator('#triton-view .row-main').allTextContents();
  results.cases.push({id:'RUNTIME-03',title:'Triton default attention list and exported set differ',
   requirement_ids:['EC-011','UAR-018','UDR-019'],expected:'Export matches current L records including collapse-hidden rows only',
   controlled_input:'12 successful, qualified batches with durations 1..12 minutes; default attention uses page-level P90',
   actual:{list_title:listTitle,rendered_rows:shown,exported_rows:csvLines.length-1,displayed_rows:displayedPrs,
    csv_header:csvLines[0]},confirmed:csvLines.length-1>shown});
  const originalUrl=page.url();
  await page.getByRole('searchbox',{name:'搜索关注列表'}).fill('AUDIT-NO-MATCH-20261023');
  const searchedUrl=page.url();
  const originalRows=await page.locator('#triton-view .row-main').count();
  const shared=await context.newPage();
  await shared.goto(searchedUrl);
  await shared.locator('#triton-view .row-main').first().waitFor();
  const sharedRows=await shared.locator('#triton-view .row-main').count();
  results.cases.push({id:'RUNTIME-04',title:'Triton shared URL loses current search condition',
   requirement_ids:['EC-009','UAR-009','UDR-020'],expected:'A fresh URL restores the same records and controls',
   actual:{original_url:originalUrl,searched_url:searchedUrl,original_rows:originalRows,shared_rows:sharedRows},
   confirmed:originalRows===0&&sharedRows>0});
  await page.screenshot({path:path.join(output,'screenshots/triton-search-no-url.png'),fullPage:true});
  await shared.close();await page.close();
  page=await context.newPage();
  await page.goto(base+'#ubs/repo/ubs-engine');
  await page.locator('#prRows tr[data-pr]').first().waitFor();
  const evt=page.waitForEvent('download');await page.locator('#export').click();
  const ubsCsv=await downloadText(await evt);
  fs.writeFileSync(path.join(output,'ubs-record-export.csv'),ubsCsv);
  const metadata=await page.locator('.export-notice').innerText();
  results.cases.push({id:'RUNTIME-05',title:'UBS exported file does not carry visible provenance metadata',
   requirement_ids:['EC-011','UAR-018','UDR-019'],expected:'Downloaded file or companion carries snapshot, scope and units',
   actual:{notice:metadata,csv_header:ubsCsv.replace(/^\uFEFF/,'').split(/\r?\n/)[0],
     contains_snapshot:ubsCsv.includes('sha256:'),contains_profile:ubsCsv.includes('ubs-pr-representative-v1')},
   confirmed:!ubsCsv.includes('sha256:')&&!ubsCsv.includes('ubs-pr-representative-v1')});
  await page.screenshot({path:path.join(output,'screenshots/ubs-export-metadata.png'),fullPage:true});
  // Visual evidence at required narrow widths, with geometric observations only.
  await page.goto(base+'#triton');
  await page.locator('#triton-view [data-role="chart"]').waitFor();
  for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:900});
   await page.screenshot({path:path.join(output,`screenshots/triton-${width}.png`),fullPage:true});
   const geometry=await page.evaluate(()=>({viewport:innerWidth,document_width:document.documentElement.scrollWidth,
    svg_labels:[...document.querySelectorAll('#triton-view svg text')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};}),
    stat_readouts:[...document.querySelectorAll('#triton-view .selection-stat strong')].map(e=>{const r=e.getBoundingClientRect(),p=e.closest('.selection-stats').getBoundingClientRect();return {text:e.textContent,left:r.left,right:r.right,parent_left:p.left,parent_right:p.right,outside_parent:r.left<p.left||r.right>p.right};})}));
   results.cases.push({id:`VISUAL-${width}`,title:`Triton layout at ${width}px`,requirement_ids:['EC-010','UAR-010'],
    actual:geometry,page_overflow:geometry.document_width>width});
  }
  await page.setViewportSize({width:390,height:900});
  await page.locator('#triton-view [data-role="e2eStats"]').screenshot({path:path.join(output,'screenshots/triton-390-stat-readouts.png')});
  await context.close();
 }finally{await browser.close();fs.writeFileSync(path.join(output,'runtime-observations.json'),JSON.stringify(results,null,2));}
 console.log(JSON.stringify(results.cases.map(({id,confirmed,page_overflow})=>({id,confirmed,page_overflow}))));
})().catch(error=>{console.error(error);process.exitCode=1;});
