/* Read-only reproduction of cross-page audit findings.
 * Run: node audit/2026-10-21/evidence/cross-page-reproduction.cjs
 * The script reads repository files and runs the existing app in its VM DOM
 * double. It does not fetch data, control a browser, or write any file.
 * Assertions describe observed defects, not the desired corrected contract.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const { createApp } = require(path.join(root, 'tests/helpers/app-harness.cjs'));
const M = require(path.join(root, 'web/core.js'));
const R = require(path.join(root, 'web/records.js'));
const Q = require(path.join(root, 'web/query-state.js'));
const W = require(path.join(root, 'web/workbench.js'));
const source = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'web/router.js'), 'utf8');
const findings = [];
function app() {
  const a = createApp();
  a.context.QueryState = Q;
  a.context.Records = R;
  return a;
}
function finding(id, title, priority, refs, observed, trigger, requirement, acceptance, blindSpots, classification = 'VM reproduced') {
  findings.push({ id, title, priority, classification, source: refs, observed, trigger, requirement, acceptance, existing_test_blind_spots: blindSpots });
}
function sourceSlice(start, end) {
  const p = source.indexOf(start);
  assert.ok(p >= 0, 'source marker exists: ' + start);
  const q = source.indexOf(end, p + start.length);
  assert.ok(q >= 0, 'source end marker exists: ' + end);
  return source.slice(p, q);
}
function captureRoute(a) {
  a.run('applyRoute=(r)=>globalThis.appliedRoute=r; snapshot=null;');
}
async function main() {
  {
    const a = app(); captureRoute(a);
    a.run('applyProjectRoute({project:"ubs",task:"records",query:{q:"needle",state:"merged",tf:"push",qf:"incomplete",ps:"50",page:"3"}})');
    const read = () => ({ q: a.element('query').value, state: a.element('state').value, trigger: a.element('triggerFilter').value, quality: a.element('qualityFilter').value, ps: a.run('pageSize'), page: a.run('page') });
    const before = read();
    a.run('applyProjectRoute({project:"ubs",task:"records",query:{}})');
    const after = read(); assert.deepEqual(after, before);
    finding('CP-01', '省略 URL 条件没有恢复默认状态', 'P1', ['web/app.js:107', 'web/app.js:116', 'web/app.js:23'], { before, bare_url_after: after },
      '同一文档先进入带搜索/高级筛选/分页的 UBS records，再后退或导航至不带这些参数的 records URL。',
      'URL 恢复必须先建立完整默认状态，再应用已验证参数；同一 URL 的结果不依赖此前访问顺序。',
      ['带 q/state/tf/qf/ps/page 的页面→无参数页面后，控件和列表严格恢复默认。', '前进、后退及新标签页加载同一 URL，实体身份集合、排序、页码和条件相等。'],
      ['tests/browser/url-context.spec.cjs 只检查有参数的新标签页恢复，未检查省略参数的历史返回。']);
  }
  {
    const a = app();
    a.element('state').value = 'merged';
    a.element('state').selectedOptions = [{ textContent: '已合入' }];
    a.context.location.hash = '#projects/ubs/records?state=merged';
    a.run('render=()=>{};globalThis.syncCalls=0;syncRecordsUrl=()=>globalThis.syncCalls++;renderActiveConditions([])');
    a.element('clearConditions').onclick();
    const observed = { state_after_clear: a.element('state').value, url_after_clear: a.context.location.hash, sync_calls: a.context.syncCalls };
    assert.equal(observed.state_after_clear, ''); assert.equal(observed.sync_calls, 0);
    finding('CP-02', '清除高级条件没有同步分享地址', 'P2', ['web/app.js:25'], observed,
      '启用高级筛选后点击常驻条件条中的“清除高级条件”，然后复制地址或刷新。',
      '所有改变分析集合的清除动作必须同步 URL 与历史，不能让已清除条件仍存在于分享地址。',
      ['点击清除后 URL 不含 state/tf/qf，刷新保持清除结果。', '后退恰好恢复清除前条件，前进恢复清除后条件。'],
      ['tests/browser/advanced-sample-filter.spec.cjs 检查条件条/分母，未保护清除后的 URL 与刷新。']);
  }
  {
    const a = app(); const sort = a.element('sort');
    let options = ['duration', 'start', 'queue'], value = 'duration', markup = '';
    // Implements the native select rule: assigning a value absent from its
    // current option collection produces an empty selected value.
    Object.defineProperty(sort, 'value', { get: () => value, set: v => { value = options.includes(String(v)) ? String(v) : ''; } });
    Object.defineProperty(sort, 'innerHTML', { get: () => markup, set: s => { markup = s; options = [...s.matchAll(/value="([^"]+)"/g)].map(m => m[1]); value = options[0] || ''; } });
    a.run('applyRoute=()=>renderEntityChrome();snapshot=null;applyProjectRoute({project:"ubs",task:"records",query:{entity:"prs",sort:"batches"}})');
    assert.equal(sort.value, 'e2e');
    finding('CP-03', '同页切换实体时 URL 排序被旧选项吞掉', 'P2', ['web/app.js:30', 'web/app.js:108', 'web/app.js:110'], { initial_entity: 'batches', requested_entity: 'prs', requested_sort: 'batches', actual_sort: sort.value },
      '当前表格已渲染批次排序选项，再在同一文档导航/后退至 entity=prs&sort=batches。冷启动的初始 PR 选项不一定触发。',
      '先重建目标实体的排序选项，再恢复该实体的排序值；实体切换与排序作为同一上下文还原。',
      ['批次→PR URL 请求 batches/created 都精确恢复；PR→批次请求 duration/start/queue 都精确恢复。', '前进后退跨实体往返后，排序值及完整身份顺序一致。'],
      ['tests/browser/url-context.spec.cjs 使用全新标签页恢复，未覆盖已有另一实体 options 的同页还原。'], 'VM reproduced with native select semantics; browser confirmation recommended');
  }
  {
    const a = app(); const row = { dataset: { batch: 'batch-1', pr: '100' } };
    a.element('prRows').querySelectorAll = () => [row];
    a.run('batchList=[{batch_id:"batch-1",pr:100,number:1,title:"clicked",status:"success",duration_ms:1}];openDetail=(...args)=>globalThis.openedArgs=args;renderBatchTable()');
    row.onclick(); assert.deepEqual(Array.from(a.context.openedArgs), [100]);
    finding('CP-04', '批次点击丢失批次身份且分享只保留 PR', 'P1', ['web/app.js:31', 'web/app.js:22', 'web/app.js:197'], { clicked_batch_id: row.dataset.batch, openDetail_arguments: Array.from(a.context.openedArgs), url_state_contains_batch: /batch/.test(sourceSlice('function recordsState()', '\nfunction recordsUrl()')) },
      '同一 PR 有多个批次时，从默认批次表点击非代表批次；复制详情 URL 后重新打开。',
      '列表、质量、关注和图表下钻都传递完整稳定批次身份；详情默认展开所点批次，URL 可恢复同一批次。',
      ['PR100 的1/2/3批次中代表为2，点击1只将1标为选中入口，任务导出属于1。', '刷新或分享同一 URL 后仍展开1；消失批次明确提示而非替换为代表批次。'],
      ['tests/browser/unified-detail.spec.cjs 的列表入口强制切到 PR 实体，只对 failed-wait 测试直接批次入口；未点击公共批次行。']);
  }
  {
    const a = app();
    a.run('render=()=>{};repositoryIndex={repositories:[{name:"ubs-engine",repository:"openeuler/ubs-engine",status:"success"}],start_ms:1,end_ms:2};repositorySnapshots={"ubs-engine":{meta:{repository:"openeuler/ubs-engine",start_ms:1,end_ms:2,branch:"master"},prs:[{number:100,batches:[]}]}};detailPR={number:100};detailRepo="ubs-engine";view="ubs-repo";');
    a.element('detail').open = true;
    a.run('applyProjectRoute({project:"ubs",task:"records",query:{repository:"gitcode:openeuler/ubs-engine"}})');
    const backLeavesOpen = a.element('detail').open; assert.equal(backLeavesOpen, true);
    const callbacks = {};
    a.element('detail').addEventListener = (name, callback) => { callbacks[name] = callback; };
    const closeWire = sourceSlice("$('detail').addEventListener('close'", ";$('detail').addEventListener('click'");
    a.run(closeWire + ';');
    a.context.location.hash = '#projects/ubs/records?pr=100';
    a.element('detail').open = false; callbacks.close();
    assert.match(a.context.location.hash, /pr=100/);
    finding('CP-05', '详情与返回/Escape 的 URL 状态不双向同步', 'P1', ['web/app.js:124', 'web/app.js:140', 'web/app.js:242'], { url_without_pr_keeps_dialog_open: backLeavesOpen, after_native_close_url: a.context.location.hash, after_native_close_internal_pr: a.run('detailPR') },
      '打开同仓 PR 详情后浏览器后退至无 pr 参数的 URL；或按 Escape 关闭后刷新。',
      'URL 中无详情身份时关闭详情；所有关闭入口（按钮、Escape、外部点击、返回）统一更新详情身份并恢复入口焦点。',
      ['打开→Back 时详情关闭且保持源列表；Forward 重开同一实体。', 'Escape 后 URL 不含详情身份，刷新不重开；其他关闭入口行为一致。'],
      ['tests/browser/url-context.spec.cjs 只点击 closeDetail 按钮，未验证浏览器 Back/Forward 或原生 dialog close。']);
  }
  {
    const a = app();
    a.context.prs = [{ number: 100, title: 'Example', author: 'unique-author', events: [], batches: [{ number: 1, url: 'https://ci.openeuler.openatom.cn/job/x/1/', eligible: true, status: 'success', e2e_ms: 60000, sha: 'unique-sha', children: [] }] }];
    a.run('snapshot={meta:{repository:"openeuler/ubs-engine"},prs};'); a.element('sort').value = 'duration';
    const observed = { author: { pr: a.run('Metrics.searchPRs(prs,"unique-author").length'), batches: a.run('buildBatchList(prs,"unique-author").length') }, sha: { pr: a.run('Metrics.searchPRs(prs,"unique-sha").length'), batches: a.run('buildBatchList(prs,"unique-sha").length') } };
    assert.equal(observed.author.pr, 1); assert.equal(observed.author.batches, 0);
    assert.equal(observed.sha.pr, 1); assert.equal(observed.sha.batches, 0);
    finding('CP-06', '默认批次搜索不支持界面声明的作者/SHA', 'P2', ['web/index.html:57', 'web/app.js:29', 'web/records.js:109', 'web/core.js:14'], observed,
      '使用输入框提示中的作者或 SHA 搜索；同一词在 PR 实体有结果，切默认批次实体变空。',
      '公共搜索字段与文案一致；批次记录保留检索用作者、SHA 等字段，切换实体不丢失可解释的定位能力。',
      ['固定 PR 的作者/SHA 在两实体都命中对应 PR/批次，未知字段不误命中。', '搜索仅改变 L，不改变 S 的 KPI/趋势/有效分母。'],
      ['tests/search_sl.test.cjs 主要测试 PR 搜索与 S/L 隔离；records normalization 单测未验证作者/SHA检索接线。']);
  }
  {
    const a = app();
    a.run('snapshot={meta:{repository:"openeuler/ubs-engine"},prs:[]};filtered=[{number:100,title:"x",state:"open",author:"dev",events:[],batches:[{eligible:true,e2e_ms:60000,number:1,url:"batch-1",children:[]}]}];download=(rows,name,meta)=>globalThis.exported={rows,name,meta};exportPRs()');
    const ex = a.context.exported;
    const observed = { column: ex.rows[0][14], value: ex.rows[1][14], metadata_unit: ex.meta.unit, duration_unit: ex.meta.duration_unit, list_condition: ex.meta.list_condition || null };
    assert.equal(observed.value, 60000); assert.equal(observed.metadata_unit, '分钟');
    finding('CP-07', '公共导出元信息声明分钟但数值仍是毫秒', 'P1', ['web/app.js:195', 'web/app.js:208', 'web/app.js:209', 'web/app.js:211'], observed,
      '从 PR列表、跨仓汇总或详情导出，按照导出成功提示中的“单位：分钟”解释 CSV 耗时。',
      '公共版本化导出的列名、数值和元信息单位必须一致；原毫秒 CSV 作为明确标注的兼容入口保留。',
      ['60000ms 样本的公共分钟导出为1且列名/metadata一致，或兼容导出仍60000但清楚声明ms。', '零、未知、亚秒与极端值换算正确；不以四舍五入文本验证源值。'],
      ['tests/browser/unified-export.spec.cjs 检查行数/metadata文字，没有按列单位核对导出数值。']);
  }
  {
    const downloads = [], blobs = [];
    const env = { location: { hostname: 'example.invalid' }, Blob: class { constructor(parts) { this.parts = parts; blobs.push(this); } }, URL: { createObjectURL: () => 'blob:audit', revokeObjectURL() {} }, document: { createElement() { return { click() { downloads.push(this.download); } }; } } };
    const result = await M.saveCsv([['PR', 'E2E ms'], [100, 60000]], 'records.csv', env, { snapshot_id: 'snapshot-a', entity: 'L 记录', count: 1, list_condition: 'q=100' });
    assert.deepEqual(downloads, ['records.csv']); assert.equal(blobs[0].parts[0].includes('snapshot-a'), false);
    const a = app(); a.run('release={projects:{ubs:{snapshot_version:"new-release-snapshot"}}};snapshot={meta:{collected_at:"old-snapshot-time"}};');
    const md = a.run('versionedMeta("L 记录","当前筛选",1,"分钟")');
    finding('CP-08', '导出缺少可持久追溯条件/版本且旧数据可能贴新版本', 'P1', ['web/core.js:20', 'web/core.js:22', 'web/core.js:30', 'web/app.js:208', 'web/app.js:232'], { downloads, file_contains_snapshot_id: blobs[0].parts[0].includes('snapshot-a'), returned_metadata_snapshot_id: result.metadata.snapshot_id, metadata_for_retained_old_data: { snapshot_id: md.snapshot_id, collected_at: md.collected_at } },
      '保存 CSV 后离开页面再核查；或重载中某仓读取失败保留旧快照，但 release.json 已返回新版本时导出。',
      '下载物携带持久版本/范围/列表条件证据（sidecar或容器，兼容CSV不加注释头）；元信息绑定实际导出数据快照及release，不从当前全局release拼接。',
      ['离线只凭下载物可恢复release/snapshot/profile/实际时间、S范围、L条件及实体条数。', '模拟新release+旧仓回退，导出身份/时间均属于旧实际快照；不能声明新快照。'],
      ['export_meta 单测只断言返回对象；unified-export 浏览器只断言页面成功文字。未检验sidecar或回退数据与版本绑定。']);
  }
  {
    const project = { project_id: 'ubs', repositories: [], window: { hours: 720, time_basis: 'pr_created_at' } };
    const absent = W.projectCard(project, undefined);
    const fresh = W.projectCard(project, { task_status: 'success', data_mode: 'fresh' });
    assert.equal(absent.task_status_label, '失败');
    finding('CP-09', '目录成功但运行报告缺失会虚构失败，关注计数未接入', 'P1', ['web/app.js:60', 'web/app.js:62', 'web/app.js:65', 'web/workbench.js:51', 'web/workbench.js:57', 'web/workbench-view.js:44'], { missing_report: { task: absent.task_status_label, data: absent.data_mode_label, count: absent.concern_count }, fresh_status_without_passed_concerns: { count: fresh.concern_count }, concern_table_gets_separate_rows: source.includes('concern_rows:concernRows') },
      '目录成功、release 404/缺项目条目但项目数据可读；或工作台关注表已有记录而项目卡片关注仍“—”。',
      '缺报告标记未提供/未知，不推导采集失败或数据不可用；已加载数据状态独立显示。卡片关注与实际同版本去重表共用集合，未完成读取为未知。',
      ['catalog可用+release缺失+快照可读，卡片不出现虚构本轮失败，能进入数据且列明缺报告。', '完整关注集合已加载时卡片计数等于该项目表格唯一身份数；部分/失败读取不得显示无关注。'],
      ['app_runtime 诚实工作台测试的harness未注入Workbench/WorkbenchView，只运行旧fallback。collection-status浏览器缺release用例仅要求不可用，没有禁止虚构失败。']);
  }
  {
    const a = app(); const nodes = new Map();
    a.element('triton-view').querySelector = selector => {
      if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', disabled: false });
      return nodes.get(selector);
    };
    a.run('window.tritonPayload={batches:[{id:"run-1",pr:100,status:"success",duration_seconds:60,action_url:"https://github.com/triton-lang/triton-ascend/actions/runs/1"}]};tritonStatus="failed";tritonError="network-down";renderTritonRecords()');
    const rendered = a.element('triton-view').innerHTML;
    const row = (rendered.match(/<tr data-batch=[\s\S]*?<\/tr>/) || [''])[0];
    assert.ok(row); assert.equal(/tabindex=|<button\b/.test(row), false);
    finding('CP-10', '公共 Triton 记录缺少键盘详情入口，UBS趋势读数仅悬浮', 'P2', ['web/app.js:48', 'web/app.js:38', 'tests/accessibility.test.cjs:37'], { triton_row_has_focusable_detail_control: /tabindex=|<button\b/.test(row), triton_only_anchor_is_external_source: /<a href="https:\/\/github.com/.test(row), anchor_is_skipped_by_row_handler: source.includes("if(e.target.closest('a'))return;"), ubs_trend_has_keyboard_listener: /keydown|tabindex/.test(sourceSlice('function drawTrend(', '\nfunction drawTasks(')) },
      '仅用Tab/Enter访问Triton公共记录并尝试打开统一详情；或用键盘读取UBS趋势某日均值/P90/n。',
      '记录详情使用可聚焦命名控件并支持Enter/Space；图表逐点读数提供键盘入口或等价可访问表格。',
      ['无需鼠标即可从每一条记录进入详情、访问来源、关闭并回到入口焦点。', 'UBS趋势每个日期的均值/P90/n对键盘与辅助技术可取得，且与图表源序列一致。'],
      ['accessibility.test.cjs 只匹配源码片段，键盘行为集中在Triton旧趋势控件，没有真实键盘走公共记录/UBS趋势。'], 'Generated HTML/source verified; actual keyboard and assistive technology behavior require browser confirmation');
    assert.equal(rendered.includes('network-down'), false);
    finding('CP-11', 'Triton公共记录保留旧数据时吞掉重读失败提示', 'P1', ['web/app.js:43', 'web/app.js:48', 'web/app.js:227'], { old_record_still_rendered: rendered.includes('run-1'), error_text_visible: rendered.includes('network-down'), old_data_warning_visible: rendered.includes('上一次') || rendered.includes('读取失败') },
      '先成功读取Triton，在公共记录页重新加载，后续HTTP/JSON/超时失败但旧payload仍保留。',
      '所有任务视图使用统一读取状态；保留旧数据时必须说明失败原因、旧采集时间和数据未更新。',
      ['网络/HTTP/解析/超时均保留旧记录且显示失败及重试入口；成功重试后清掉旧错误。', '在overview/trends/records切换时错误状态一致，其他项目不受影响。'],
      ['app_runtime 的失败保留主要测试UBS，Triton旧视图有专用提示但公共records新增分支未覆盖。']);
  }
  {
    const a = app(); captureRoute(a);
    a.element('state').value = 'merged'; a.element('notice').hidden = true;
    a.run('applyProjectRoute({project:"ubs",task:"records",query:{basis:"batch_started_at",state:["open","closed"],ps:"7",page:"not-a-page"}})');
    const observed = { requested_basis: 'batch_started_at', requested_state: ['open', 'closed'], state_after: a.element('state').value, requested_page_size: 7, page_size_after: a.run('pageSize'), notice_hidden: a.element('notice').hidden, notice_text: a.element('notice').textContent };
    assert.equal(observed.notice_hidden, true); assert.equal(observed.state_after, 'merged');
    finding('CP-12', '已知 URL 参数的非法值/重复值被静默忽略', 'P2', ['web/router.js:36', 'web/app.js:88', 'web/app.js:108', 'web/app.js:127'], observed,
      '分享链接包含不支持的basis、重复state、非法ps/page等已知键。',
      '逐键校验类型、基数、枚举及范围；非法条件必须显式解释，不能静默沿用上次值或换口径。',
      ['对每个已支持键覆盖重复值、空值、非法枚举、非法数字，显示可判定错误或明确修正说明。', 'basis不兼容时拒绝或明确告知，不按不同时间依据悄悄显示。'],
      ['router_project测试只验证parseQuery可聚合重复键；app仅拒绝重复repository，未测所有已知键在页面的语义校验。']);
  }
  {
    const a = app(); captureRoute(a);
    const routes = {};
    for (const task of ['overview', 'trends', 'records']) {
      a.run('applyProjectRoute(' + JSON.stringify({ project: 'ubs', task, query: { repository: 'gitcode:openeuler/ubs-engine' } }) + ')');
      routes[task] = JSON.parse(JSON.stringify(a.context.appliedRoute));
    }
    assert.deepEqual(routes.overview, routes.trends); assert.deepEqual(routes.trends, routes.records);
    finding('CP-13', '固定任务入口未形成各自页面，能力与导航不一致', 'P2', ['web/app.js:78', 'web/app.js:93', 'web/app.js:98', 'web/app.js:121', 'web/app.js:142'], { ubs_routes_to_same_view: routes, all_fixed_tasks_rendered: ['overview', 'trends', 'records', 'quality', 'collection', 'method'], triton_supported_tasks: ['overview', 'trends', 'records'] },
      '在UBS单仓依次点项目概览、趋势与任务、PR与批次，或在Triton点击数据质量/数据与采集。',
      '固定任务有可辨认的内容和活动状态，能力未提供时导航事先说明；项目切换保存并恢复各自有效范围/列表状态。',
      ['每个任务URL、活动导航、面包屑与主体内容一致；同项目各任务可从用户目标区分。', '未提供任务入口标明能力状态；跨项目往返能恢复该项目上下文且不会继承别项目无效条件。'],
      ['navigation与shell测试主要断言选择器/链接/互斥显示，未验证不同任务的完整目标内容和逐项目状态恢复。'], 'Routing facts VM reproduced; task content completeness is a product acceptance gap');
  }
  const files = ['web/app.js', 'web/core.js', 'web/records.js', 'web/workbench.js', 'web/workbench-view.js', 'web/index.html', 'web/router.js', 'tests/helpers/app-harness.cjs', 'docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md'];
  const hashes = Object.fromEntries(files.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
  const result = {
    audit_date: '2026-10-21',
    code_sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    command: 'node audit/2026-10-21/evidence/cross-page-reproduction.cjs',
    read_only_runtime: true,
    method: 'Existing app-harness VM executes unchanged app functions; controlled DOM boundaries, pure models and generated HTML inspected. CP-03 models native select behavior explicitly.',
    limitations: ['No browser was controlled by this agent.', 'Native dialog events and keyboard reachability need real Chromium confirmation; source and generated HTML facts are separately labeled.', 'This script reproduces defects; its successful exit is not business acceptance of desired behavior.'],
    requirement_mapping: { 'CP-01': ['UDR-020'], 'CP-02': ['UDR-016', 'UDR-020'], 'CP-03': ['UDR-018', 'UDR-020'], 'CP-04': ['UDR-017', 'UDR-020'], 'CP-05': ['UDR-012', 'UDR-020'], 'CP-06': ['UDR-016', 'UDR-018'], 'CP-07': ['UDR-006', 'UDR-019'], 'CP-08': ['UDR-019', 'UDR-020', 'UDR-035'], 'CP-09': ['UDR-009', 'UDR-011', 'UDR-032'], 'CP-10': ['UDR-014'], 'CP-11': ['UDR-013', 'UDR-032'], 'CP-12': ['UDR-010', 'UDR-020'], 'CP-13': ['UDR-015'] },
    existing_regressions_observed_as_implemented: ['S/L models separate ordinary search from analysis selection.', 'Common Records.sortRecords sorts finite zero correctly, unknown last, stable identity ties before paginate.', 'UBS PR detail and Triton records share the dialog element; UBS no-representative fallback is explicit.', 'Read timeout and generation gates cover independent project reads; same-repository prior UBS snapshot is retained.', 'Fixed task links and project selector exist; they are not a complete acceptance of all task goals.'],
    baseline_test_run: { command: 'node --test tests/query_state.test.cjs tests/router_project.test.cjs tests/records.test.cjs tests/export_meta.test.cjs tests/accessibility.test.cjs tests/detail.test.cjs', observed: { tests: 42, pass: 42, fail: 0 }, caveat: 'Run separately during audit. These passing helper/source tests do not cover the reproduced app wiring defects.' },
    input_sha256: hashes,
    observations_count: findings.length,
    findings,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
