/* Triton-Ascend 门禁效率视图（合并看板 T8）。
   契约：window.TritonView.render(payload, container)，payload 为 web/data/triton.json。
   单一共享时间导航器同时驱动 E2E 与 NPU 两张散点图；每图各自保留状态 chips
   与 selection-stats；渲染逻辑移植自原独立看板 template.html（语义不变），
   视觉遵循 web/style.css 的令牌与组件词汇表（色值一律 var(--*)）。
   REQ-001 页级集合 G：所选目标分支 × 共享时间窗（按 start_at 含起止边界）内
   的全部批次；顶部汇总、状态数量、数据边界、关注/全部列表与两图的输入均从 G
   派生。E2E/NPU 状态 chips 只作用于对应图及图内统计；列表搜索只过滤列表。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./triton-core.js'), globalThis);
  else root.TritonView = factory(root, root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, root) {
  'use strict';

  const HOUR = 3600000;
  const statusLabels = { success: '成功', failure: '失败', running: '执行中', cancelled: '取消', skipped: '已跳过', unknown: '未知' };
  const statusFill = {
    success: 'var(--ok)', failure: 'var(--danger)', running: 'var(--info)',
    cancelled: 'var(--warn)', skipped: 'var(--neutral)', unknown: 'var(--neutral)',
  };
  const focusDefs = [['a3-py310', 'A3 · py3.10'], ['a3-py311', 'A3 · py3.11'], ['a5-py312', 'A5 · py3.12']];
  const csvFields = ['pr', 'title', 'sha', 'base_branch', 'kind', 'start_at', 'end_at', 'status',
    'duration_seconds', 'npu_queue_seconds', 'approximate', 'start_source', 'critical_workflow', 'missing', 'pr_url', 'action_url'];
  const METRIC_ID = 'integration_tests_workflow_e2e';

  /* DQ-02/TS28-008 AC2: the CSV and its qualification sidecar always share one
     scope — metric version, selection window, branch, query, unknown-time
     exemption, discovery cutoff, collection completion and boundary note. The
     same object feeds the zero-row export so an empty selection is still
     auditable instead of an unexplained blank file. */
  function exportScope(payload, options) {
    const o = options || {};
    const disclosure = payload.discovery || {};
    return {
      metric: payload.e2e_metric || METRIC_ID,
      metric_version: payload.e2e_metric_version || 2,
      snapshot_window_start: payload.window_start || null,
      snapshot_window_end: payload.window_end || null,
      selection_start: o.start != null && Number.isFinite(o.start) ? new Date(o.start).toISOString() : null,
      selection_end: o.end != null && Number.isFinite(o.end) ? new Date(o.end).toISOString() : null,
      branches: Array.isArray(o.branches) ? o.branches.slice() : [],
      query: typeof o.query === 'string' ? o.query : '',
      unknown_time_included: !!o.unknownTime,
      discovery_fetch_window_end: disclosure.fetch_window_end || null,
      collected_at: payload.collected_at || null,
      boundary_note: disclosure.boundary_note || null,
    };
  }

  function saveQualifications(qualification) {
    if (!root.URL || typeof root.URL.createObjectURL !== 'function' || !root.document) return null;
    const url = root.URL.createObjectURL(new root.Blob([JSON.stringify(qualification, null, 2)], { type: 'application/json' }));
    const link = root.document.createElement('a');
    link.href = url;
    link.download = 'triton-qualifications-v1.json';
    /* A detached anchor is enough in Chromium, but appending it also keeps the
       download attributable inside an already-asynchronous export handler. */
    if (root.document.body && typeof root.document.body.appendChild === 'function') root.document.body.appendChild(link);
    link.click();
    if (link.parentNode) link.parentNode.removeChild(link);
    root.URL.revokeObjectURL(url);
    return link.download;
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtDate = stamp => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(stamp));
  /* TS28-001 AC1 / section 4.2: source times keep the date and seconds in
     Shanghai time; a >24h or cross-day span is never shortened. */
  const fmtStamp = stamp => (stamp == null || !Number.isFinite(+new Date(stamp))) ? '未知' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(stamp));
  /* REQ-031 AC01: .axis 刻度（11px/600）逐字符宽度的保守估计（实测约 6.05px/字符），
     用于把绘图区宽度折算成可容纳的刻度数。 */
  const AXIS_CHAR_W = 7;
  /* P-009: durations unify to two-decimal minutes (Units.minutes takes ms);
     CSV fields keep their original seconds unit. */
  const dur = value => Units.minutes(value == null ? null : value * 1000);
  const spanText = ms => {
    const hours = ms / HOUR;
    return hours < 24 ? hours.toFixed(hours < 10 ? 1 : 0) + ' 小时' : (hours / 24).toFixed(1) + ' 天';
  };
  const fillFor = status => statusFill[status] || statusFill.unknown;

  let active = null;
  let mounted = null;
  let savedState = null;
  let detailBatchId = null;

  /* ADR-012: read the live triton engineering query from the hash. */
  function readQuery() {
    if (!root.location || !root.Router || !root.Router.parseRoute) return {};
    const route = root.Router.parseRoute(String(root.location.hash));
    return (route && route.view === 'projects' && route.project === 'triton' && route.query) || {};
  }
  const toList = value => (Array.isArray(value) ? value : (value ? [value] : []));

  function deactivate() {
    if (active) {
      savedState = active.state();
      active.destroy();
    }
    active = null;
    mounted = null;
  }

  function identityHtml(batch) {
    if (batch.pr != null && batch.pr_url) return `<a class="pr link" href="${esc(batch.pr_url)}" target="_blank" rel="noopener">PR #${esc(batch.pr)}</a>`;
    const workflow = (batch.workflows || [])[0] || {};
    return `<span class="pr">未关联 PR · Run #${esc(workflow.id || batch.id)} · attempt ${esc(workflow.attempt || 1)}</span>`;
  }

  function qualificationHtml(batch) {
    if (core.sampleEligible(batch)) return '';
    const reasons = { unresolved_pr_batch_identity: 'PR 与提交批次身份未确认', outside_integration_tests: '辅助检查，不计入 Integration Tests E2E', rerun_queue_start_unknown: '重跑前置排队起点未知，仅观测', legacy_metric_unverified: '旧口径未重新采集', running_observation: '执行中观测', non_sample_result: '当前结果不属完成样本', invalid_or_missing_duration: '时长证据无效或缺失' };
    const reason = batch.e2e_exclusion_reason || (batch.pr == null ? 'unresolved_pr_batch_identity' : 'non_sample_result');
    return `<small class="sub">E2E 排除：${esc(reasons[reason] || reason)}</small>`;
  }

  /* REQ-033 AC01/AC02: 顶栏分支徽标跟随 Triton 分支选择（全部/单选/多选），不遗留 UBS 的 master 表达。 */
  function syncBranchBadge(branches) {
    const badge = document.getElementById('branchBadge');
    const badgeName = document.getElementById('branchName');
    if (!badge || !badgeName) return;
    const info = core.branchBadgeText(branches);
    badge.hidden = false;
    badgeName.textContent = info.text;
    badge.title = info.title || '';
  }

  function render(payload, container) {
    const routeChanged = active && !active.matchesRoute();
    /* REQ-033 AC03 / REQ-035 AC03: 数据未变时跳过重挂载，但 applyRoute 已把徽标与页脚重置为默认，需按当前状态重新同步。 */
    if (core.sameSessionMount(mounted, payload, container) && !routeChanged) {
      syncBranchBadge(active ? active.state().branches : []);
      const fm = document.getElementById('footerMeta');
      if (fm && active) fm.textContent = active.footerText();
      return;
    }
    const prevState = routeChanged ? null : (active ? active.state() : savedState);
    if (active) { active.destroy(); active = null; }
    mounted = null;
    if (!container) return;
    const batches = payload && Array.isArray(payload.batches) ? payload.batches : null;
    const domainStart = payload ? +new Date(payload.window_start) : NaN;
    const domainEnd = payload ? +new Date(payload.window_end) : NaN;
    const windowValid = Number.isFinite(domainStart) && Number.isFinite(domainEnd) && domainEnd > domainStart;
    /* TA-010: 合法零数据、缺字段/非法时间窗、请求失败必须给出不同语义，
       不得共用一句"暂无数据"，也不得吞掉来源、窗口与采集时间的可核对性。 */
    if (batches == null) {
      container.innerHTML = '<div class="empty" data-role="tritonEmpty" data-state="invalid">Triton 数据缺失或格式无效：没有可用的 batches 数组。</div>';
      return;
    }
    if (!windowValid) {
      container.innerHTML = '<div class="empty" data-role="tritonEmpty" data-state="invalid">Triton 时间窗无效：window_end 必须晚于 window_start，且两者都能解析为时间。</div>';
      return;
    }
    if (!batches.length) {
      mountEmptyZero(payload, container);
      return;
    }
    mount(payload, container, domainStart, domainEnd, prevState, routeChanged);
  }

  /* TA-010-AC2: a legal zero keeps the source/window/collection context and a
     zero-row CSV export so an empty page is still auditable and downloadable. */
  function mountEmptyZero(payload, container) {
    const win = (Number.isFinite(+new Date(payload.window_start)) && Number.isFinite(+new Date(payload.window_end)))
      ? `${fmtDate(payload.window_start)} — ${fmtDate(payload.window_end)}（上海时间）` : '—';
    const collected = payload.collected_at ? fmtDate(payload.collected_at) : '—';
    container.innerHTML = `<section class="panel">
      <div class="panel-head"><div><h2>Triton-Ascend 门禁效率 <span class="count">0</span></h2><p data-role="boundary">合法零数据：统计窗口 ${win} · 采集完成 ${collected} · 来源 ${esc(payload.repo || 'triton-lang/triton-ascend')}。不是解析失败，也不是请求失败。</p></div></div>
      <div class="empty" data-role="tritonEmpty" data-state="empty">合法零数据：统计窗口内没有可展示的批次，但来源、窗口与采集时间仍可核对。</div>
      <div class="panel-foot"><button type="button" class="button" data-role="exportBatches"><svg class="icon" aria-hidden="true"><use href="#i-download"/></svg>导出零行 CSV</button><span data-role="exportNote"></span></div>
    </section>`;
    const btn = container.querySelector('[data-role="exportBatches"]');
    const note = container.querySelector('[data-role="exportNote"]');
    if (btn) btn.onclick = async () => {
      try {
        const scope = exportScope(payload, { start: +new Date(payload.window_start), end: +new Date(payload.window_end), branches: [], query: '', unknownTime: false });
        const qualification = { schema_version: 1, metric: scope.metric, metric_version: scope.metric_version,
          collected_at: payload.collected_at, window_start: payload.window_start, window_end: payload.window_end,
          scope, batches: [] };
        const file = await root.Metrics.saveCsv([csvFields], 'triton-batches.csv');
        saveQualifications(qualification);
        if (note) note.textContent = '已下载：' + (file.name || 'triton-batches.csv') + '（仅表头，0 行数据）与 triton-qualifications-v1.json（含导出 scope）';
      } catch (err) {
        if (note) note.textContent = '导出失败：' + (err && err.message ? err.message : err);
      }
    };
  }

  function skeleton(D) {
    const legend = `<div class="legend">
      <span><i style="background:var(--ok)"></i>成功</span>
      <span><i style="background:var(--danger)"></i>失败</span>
      <span><i style="background:var(--warn)"></i>取消</span>
      <span><i style="background:var(--info)"></i>执行中</span>
      <span><i class="ref-swatch ref-p90"></i>图内 P90</span>
    </div>`;
    return `
<div class="notice" data-role="freshness" role="status" hidden></div>
<div class="notice" data-role="windowNotice" role="status" hidden></div>
<div class="kpi-grid">
  <article class="kpi kpi-primary" data-metric="triton_batch_e2e"><div class="kpi-label">Integration Tests E2E</div><div class="kpi-value"><span data-role="kE2eP90">—</span><em>P90</em></div><div class="kpi-aux"><span data-role="kE2eP50">P50 —</span><span data-role="kE2eN">n=—</span></div><small>按批次起点选区 · 成功/失败批次的有效 E2E · 兼作“耗时偏长”阈值</small></article>
  <article class="kpi kpi-primary" data-metric="triton_npu_max_queue"><div class="kpi-label">NPU 最长排队</div><div class="kpi-value"><span data-role="kNpuP90">—</span><em>P90</em></div><div class="kpi-aux"><span data-role="kNpuP50">P50 —</span><span data-role="kNpuN">n=—</span></div><small>包含 NPU Job 的批次 · 取最长 NPU 排队</small></article>
</div>
<section class="global-filter">
  <strong>全局筛选</strong>
  <details class="branch-filter" data-role="branchFilter">
    <summary data-role="branchSummary">合入分支：全部</summary>
    <div class="branch-menu" data-role="branchOptions"></div>
  </details>
  <button type="button" class="chip" data-role="clearBranches">清除</button>
  <span class="results" data-role="statusPills"></span>
  <span class="filter-note">筛选会同步更新全部指标、图表和列表</span>
</section>
<section class="section">
  <div class="panel-head">
    <div><h2>Integration Tests E2E</h2>${D.e2e_metric_notice ? `<p class="missing">${esc(D.e2e_metric_notice)}</p>` : ''}<p>每点为一次 Integration Tests；创建至最后 job 完成，含排队。重跑前置排队未知时仅展示观测值。点击查看 PR 提交历史。</p></div>
    <div class="controls" data-role="e2eFilters">
      <button type="button" class="chip active" data-filter="all">全部</button>
      <button type="button" class="chip" data-filter="slow" title="以页级范围（分支×时间窗）的 P90 为阈值">耗时偏长</button>
      <button type="button" class="chip" data-filter="failure">失败</button>
      <button type="button" class="chip" data-filter="running">执行中</button>
    </div>
  </div>
  <div class="chart-wrap"><svg class="chart" data-role="chart" role="img" aria-label="Integration Tests E2E"></svg></div>
  <div style="padding:0 20px 2px"><div class="selection-stats" data-role="e2eStats" aria-live="polite"></div></div>
  ${legend}
</section>
<section class="section">
  <div class="navigator" style="border-top:0">
    <div class="navigator-head"><strong>拖动或键盘选择时间范围 · 两张趋势图联动</strong><span data-role="selectedRange"></span></div>
    <svg class="nav-svg" data-role="navigator" role="group" aria-label="选择趋势图时间范围"></svg>
    <div class="range-control">
      <span class="range-label">快速选择</span>
      <button type="button" class="chip" data-hours="6">6 小时</button>
      <button type="button" class="chip" data-hours="12">12 小时</button>
      <button type="button" class="chip" data-hours="24">24 小时</button>
      <button type="button" class="chip" data-hours="48">48 小时</button>
      <button type="button" class="chip active" data-hours="72">72 小时</button>
      <span class="range-count" data-role="rangeCount"></span>
    </div>
  </div>
</section>
<section class="section">
  <div class="panel-head">
    <div><h2>NPU Job 排队时长</h2><p>每点为一次包含 NPU Job 的运行，纵轴取其子任务中最长排队时长。</p></div>
    <div class="controls" data-role="npuFilters">
      <button type="button" class="chip active" data-npu-filter="all">全部</button>
      <button type="button" class="chip" data-npu-filter="failure">失败</button>
      <button type="button" class="chip" data-npu-filter="running">执行中</button>
    </div>
  </div>
  <div class="chart-wrap"><svg class="chart" data-role="npuChart" role="img" aria-label="NPU Job 排队时长"></svg></div>
  <div class="meta" data-role="npuDataNotice" role="status" style="padding:2px 20px 0"></div>
  <div style="padding:0 20px 2px"><div class="selection-stats" data-role="npuStats" aria-live="polite"></div></div>
  ${legend}
</section>
<section class="section">
  <div class="panel-head">
    <div><h2>需要关注的 PR</h2><p data-role="priorityNote"></p></div>
    <div class="table-actions"><button type="button" class="button" data-role="exportBatches"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-download"/></svg>导出批次 CSV</button></div>
  </div>
  <div class="tools">
    <input type="search" data-role="search" placeholder="搜索 PR 编号或标题" aria-label="搜索关注列表">
    <button type="button" class="chip" data-role="showAll">查看全部批次</button>
    <button type="button" class="chip" data-role="unknownTime">时间未知</button>
  </div>
  <div class="attention" data-role="attention"></div>
</section>
<div class="foot"><strong>口径：</strong>Integration Tests E2E = 本次 workflow 创建至最后 job 完成，包含排队，并行不相加。仅证据完整的成功/失败首次运行参与统计；重跑前置排队起点未知时仅展示观测值。跨 workflow 整套门禁时长未确定。<br><strong>数据边界：</strong><span data-role="boundary"></span></div>
<div class="tooltip" data-role="tip" tabindex="-1" role="region" aria-label="运行与任务详情" aria-live="polite"></div>`;
  }

  function mount(D, container, domainStart, domainEnd, prevState, resetRoute) {
    container.innerHTML = skeleton(D);
    const el = selector => container.querySelector(selector);
    const all = selector => Array.from(container.querySelectorAll(selector));

    const chartSvg = el('[data-role="chart"]');
    const npuChartSvg = el('[data-role="npuChart"]');
    const navSvg = el('[data-role="navigator"]');
    const tip = el('[data-role="tip"]');
    const freshnessEl = el('[data-role="freshness"]');
    const branchOptionsEl = el('[data-role="branchOptions"]');
    const branchSummaryEl = el('[data-role="branchSummary"]');
    const statusPillsEl = el('[data-role="statusPills"]');
    const e2eStats = el('[data-role="e2eStats"]');
    const npuStats = el('[data-role="npuStats"]');
    const npuDataNotice = el('[data-role="npuDataNotice"]');
    const selectedRangeEl = el('[data-role="selectedRange"]');
    const rangeCountEl = el('[data-role="rangeCount"]');
    const priorityNoteEl = el('[data-role="priorityNote"]');
    const boundaryEl = el('[data-role="boundary"]');
    const attentionEl = el('[data-role="attention"]');
    const searchInput = el('[data-role="search"]');
    const showAllBtn = el('[data-role="showAll"]');
    const unknownTimeBtn = el('[data-role="unknownTime"]');
    const exportBtn = el('[data-role="exportBatches"]');
    const kE2eP90 = el('[data-role="kE2eP90"]'), kE2eP50 = el('[data-role="kE2eP50"]'), kE2eN = el('[data-role="kE2eN"]');
    const kNpuP90 = el('[data-role="kNpuP90"]'), kNpuP50 = el('[data-role="kNpuP50"]'), kNpuN = el('[data-role="kNpuN"]');

    /* ADR-012: a deep link seeds the complete state from the URL when present;
       otherwise the previous mounted/saved state is reused as before. */
    const query = readQuery();
    const hasUrlState = ['branch', 'q', 'filter', 'npu', 'showAll', 'unknown', 'from', 'to', 'batch'].some(k => query[k] != null);
    const urlState = hasUrlState || resetRoute ? {
      branches: toList(query.branch),
      search: typeof query.q === 'string' ? query.q : '',
      filter: ['all', 'slow', 'failure', 'running'].includes(query.filter) ? query.filter : null,
      npuFilter: ['all', 'failure', 'running'].includes(query.npu) ? query.npu : null,
      showAll: query.showAll === '1',
      unknownTime: query.unknown === '1',
      start: query.from != null ? Number(query.from) : null,
      end: query.to != null ? Number(query.to) : null,
    } : null;
    const initial = urlState || prevState;
    detailBatchId = query.batch != null ? String(query.batch) : null;

    const selectedBranches = new Set(initial ? initial.branches : []);
    let filter = initial && initial.filter ? initial.filter : 'all';
    let npuFilter = initial && initial.npuFilter ? initial.npuFilter : 'all';
    let showAll = initial ? !!initial.showAll : false, unknownTime = initial ? !!initial.unknownTime : false, tipPinned = false, tipTimer = 0, navDrag = null, lastPinnedMark = null, focusReturnGuard = false;
    let viewStart, viewEnd;
    const recovered = initial ? core.recoverWindow(initial.start, initial.end, domainStart, domainEnd) : null;
    if (recovered) {
      viewStart = recovered.start;
      viewEnd = recovered.end;
    } else {
      [viewStart, viewEnd] = core.windowForHours(domainStart, domainEnd, 72);
    }

    const branchPool = () => core.filterBranches(D.batches, selectedBranches);
    const pageSet = () => core.selectWindow(branchPool(), viewStart, viewEnd);
    const currentSummary = () => core.dashboardStats(pageSet());
    const searchPool = () => pageSet().filter(b => core.matchesQuery(b, searchInput.value));
    /* EC-008-AC03: 起点未知但有来源身份（action_url 或 workflow）的批次不进入时间选区S，
       但可在同页"时间未知(n)"入口找到；不计入选区分位数，详情与导出标注时间未知。
       TA-009: 未知时间仅豁免时间选窗，不豁免分支与搜索约束——列表与导出都遵守所选分支和搜索词。 */
    const unknownTimeBranchPool = () => core.filterBranches(D.batches, selectedBranches)
      .filter(b => !b.start_at && (b.action_url || (b.workflows && b.workflows.length)));
    const unknownTimePool = () => unknownTimeBranchPool().filter(b => core.matchesQuery(b, searchInput.value));
    /* ADR-007: 列表与下载复用同一个排序后的 L —— 导出集合与当前可见列表严格一致，
       不再让默认关注子集与"全部搜索结果"下载集合分叉（关注批次一行去重、理由合并）。 */
    const attentionEntries = () => {
      const summary = currentSummary();
      const pool = searchPool();
      const entries = new Map();
      const addEntry = (batch, reason) => {
        if (!entries.has(batch.id)) entries.set(batch.id, { batch, reasons: new Set() });
        if (reason) entries.get(batch.id).reasons.add(reason);
      };
      for (const group of core.attentionGroups(pageSet(), summary.p90, searchInput.value)) {
        for (const batch of group.rows) addEntry(batch, group.label);
      }
      for (const batch of pool) if ((batch.missing || []).length) addEntry(batch, '证据缺口');
      return entries;
    };
    const displayedPool = () => {
      if (unknownTime) return unknownTimePool().slice().sort((a, b) => +new Date(b.end_at || D.window_end) - +new Date(a.end_at || D.window_end));
      const summary = currentSummary();
      if (!summary.batches) return [];
      const pool = searchPool();
      if (showAll) return pool.slice().sort((a, b) => +new Date(b.start_at) - +new Date(a.start_at));
      return [...attentionEntries().values()].map(entry => entry.batch);
    };
    /* REQ-035 AC02: 页脚统计与摘要条共用同一 pageSet（G=分支×时间窗），标注当前筛选范围；采集时间来自 Triton 快照。 */
    const footerText = () => {
      const s = currentSummary();
      return `${s.batches} BATCHES · ${s.prs} PR · 当前筛选范围 · 采集于 ${fmtDate(D.collected_at)}`;
    };

    /* TA-005: the boundary line discloses the statistical window, the creation
       discovery cutoff, the collection completion time and any lookback / non-atomic
       observation notes, so a reader can tell "as of when" without inventing it. */
    const boundaryText = () => {
      const s = currentSummary();
      const disc = D.discovery || {};
      const parts = [];
      if (Number.isFinite(+new Date(D.window_start)) && Number.isFinite(+new Date(D.window_end))) {
        parts.push(`统计窗口 ${fmtDate(D.window_start)} — ${fmtDate(D.window_end)}（上海时间）`);
      }
      if (disc.fetch_window_end != null && Number.isFinite(+new Date(disc.fetch_window_end))) {
        parts.push(`创建发现截至 ${fmtDate(disc.fetch_window_end)}`);
      }
      if (D.collected_at != null && Number.isFinite(+new Date(D.collected_at))) {
        parts.push(`采集完成 ${fmtDate(D.collected_at)}`);
      }
      if (disc.fetch_window_end != null && D.collected_at != null && Number.isFinite(+new Date(disc.fetch_window_end)) && Number.isFinite(+new Date(D.collected_at))) {
        const gapMin = Math.round((+new Date(D.collected_at) - +new Date(disc.fetch_window_end)) / 60000);
        parts.push(`发现截止与采集完成相差 ${gapMin} 分钟`);
      }
      if (disc.boundary_note) parts.push(String(disc.boundary_note));
      parts.push(`${s.approximate} 个批次使用近似起点，${s.incomplete} 个批次存在明细或关联缺口`);
      return parts.join('；') + '。';
    };

    /* ADR-012: every state change is mirrored into the hash so a copied link
       reconstructs branches, the time window, search, chart filters and the
       open detail. replaceState keeps the filter tweaks out of the history. */
    let sessionHash = root.location && root.location.hash;
    const matchesRoute = () => !root.location || root.location.hash === sessionHash;
    const syncUrl = () => {
      if (!root.history || !root.Router || !root.location) return;
      // A pending hash navigation owns its destination; old detail cleanup
      // must not replace that destination with this session's filters.
      if (!matchesRoute()) return;
      const q = {};
      const branches = [...selectedBranches].sort();
      if (branches.length) q.branch = branches;
      if (searchInput.value) q.q = searchInput.value;
      if (filter !== 'all') q.filter = filter;
      if (npuFilter !== 'all') q.npu = npuFilter;
      if (showAll) q.showAll = '1';
      if (unknownTime) q.unknown = '1';
      if (detailBatchId != null) q.batch = detailBatchId;
      q.from = Math.round(viewStart);
      q.to = Math.round(viewEnd);
      const target = '#projects/triton/engineering' + root.Router.serializeQuery(q);
      if (root.location.hash !== target) root.history.replaceState(null, '', target);
      sessionHash = target;
    };

    /* ADR-012: opening a batch from any entry also records it in the URL. */
    const openDetail = (b, candidates) => {
      detailBatchId = b && b.id != null ? String(b.id) : null;
      syncUrl();
      if (root.openTritonDetail) root.openTritonDetail(b, candidates);
    };

    if (initial) {
      searchInput.value = initial.search || '';
      all('[data-filter]').forEach(x => x.classList.toggle('active', x.dataset.filter === filter));
      all('[data-npu-filter]').forEach(x => x.classList.toggle('active', x.dataset.npuFilter === npuFilter));
      if (recovered && recovered.adjusted) {
        const windowNoticeEl = el('[data-role="windowNotice"]');
        windowNoticeEl.hidden = false;
        windowNoticeEl.textContent = `快照更新：${recovered.reason}（当前选区 ${fmtDate(viewStart)} — ${fmtDate(viewEnd)}）`;
      }
    }

    function e2eRows(threshold) {
      return pageSet().filter(b => b.is_integration_tests !== false && b.e2e_exclusion_reason !== 'outside_integration_tests' && (filter === 'all' || (filter === 'slow' && core.isSlow(b, threshold)) || b.status === filter));
    }

    function npuRows() {
      return pageSet().filter(b => core.validDuration(b.npu_queue_seconds) && (npuFilter === 'all' || b.status === npuFilter));
    }

    /* SVG presentation attributes do not accept var(), so status colors are
       applied as inline style fills after the marks are in the DOM. TS28-004:
       the fill follows this record's normalized result, never a default green. */
    function paintMarks(svg) {
      svg.querySelectorAll('.mark-hit .dot').forEach(dot => {
        const mark = dot.closest('.mark-hit');
        const batch = D.batches[+mark.dataset.i];
        const result = batch ? core.recordResult(batch) : 'unknown';
        dot.style.fill = statusFill[result] || statusFill.unknown;
        mark.dataset.result = result;
        dot.dataset.result = result;
      });
    }

    function draw() {
      const threshold = currentSummary().p90;
      const rows = e2eRows(threshold);
      const stats = core.chartStats(rows);
      const max = Math.max(stats.max * 1.12, 300);
      /* TA-001: the left margin is sized from the complete y-axis labels so the
         leftmost label's bounding box stays inside the SVG (never clipped). */
      const yLabels = [0, 1, 2, 3, 4].map(i => dur(max * (1 - i / 4)));
      const m = { l: core.yAxisMarginLeft(yLabels), r: 22, t: 18, b: 42 };
      /* TA-003: never draw into a stale/too-narrow width; defer until layout settles
         so viewBox always matches the final drawing size and plotWidth stays > 0. */
      const measuredW = chartSvg.clientWidth;
      if (!Number.isFinite(measuredW) || measuredW < m.l + m.r + 1) { scheduleRedraw(); return; }
      const W = measuredW, H = 370;
      chartSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const range = Math.max(viewEnd - viewStart, 1);
      const x = t => m.l + (+new Date(t) - viewStart) / range * (W - m.l - m.r);
      const y = v => H - m.b - v / max * (H - m.t - m.b);
      let out = '';
      yLabels.forEach((label, i) => {
        const yy = m.t + i * (H - m.t - m.b) / 4;
        out += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${m.l - 8}" y="${yy + 3}" text-anchor="end">${label}</text>`;
      });
      /* REQ-031 AC01/AC02: 刻度数随绘图区实际宽度自适应（core.axisTicks）；首末标签
         锚定绘图区两端（start/end），杜绝越界裁切，中间标签保持居中锚点。
         压缩刻度只减少标签，不改变散点的时间映射或统计。 */
      const plotW = W - m.l - m.r;
      const ticks = core.axisTicks(viewStart, viewEnd, plotW, fmtDate(viewStart).length * AXIS_CHAR_W);
      ticks.forEach((t, i) => {
        const first = i === 0, last = i === ticks.length - 1;
        const xx = first ? m.l : last ? W - m.r : m.l + (i * plotW) / (ticks.length - 1);
        out += `<text class="axis" x="${xx}" y="${H - 13}" text-anchor="${first ? 'start' : last ? 'end' : 'middle'}">${fmtDate(t)}</text>`;
      });
      /* TA-013: the reference lines carry an explicit, readable name and their
         sample scope so they are never mistaken for an SLA or the page threshold. */
      if (stats.p90 != null) {
        const py = y(stats.p90);
        out += `<line class="p90-line" x1="${m.l}" x2="${W - m.r}" y1="${py}" y2="${py}"/><title>图内 P90（当前图内已完成样本）</title><text class="ref-label" x="${W - m.r}" y="${py - 4}" text-anchor="end">图内 P90 ${dur(stats.p90)}</text>`;
      }
      /* TS28-006: the six-hour bucket median is removed from both main charts
         (calculation, DOM, legend and title). The in-chart P90 line and the
         card P50 stay — "cancel the bucket median" is not "cancel all medians". */
      /* REQ-017: batches without a valid observed duration are not plotted at a fake 0. */
      const ordered = rows.filter(b => core.validDuration(b.duration_seconds) && b.e2e_exclusion_reason !== 'outside_integration_tests').slice().sort((a, b) => (a.status === 'success' ? 0 : 1) - (b.status === 'success' ? 0 : 1));
      const raw = ordered.map(b => ({ x: x(b.start_at), y: y(b.duration_seconds || 0) }));
      /* Marks stay at measured coordinates; overlapping records are selectable in detail. */
      ordered.forEach((b, i) => {
        const point = raw[i];
        out += core.circleMark(b, point.x, point.y, D.batches.indexOf(b), fillFor(b.status), 'e2e', point);
      });
      chartSvg.innerHTML = out;
      paintMarks(chartSvg);
      const thresholdStat = `<div class="selection-stat metric"><span>耗时偏长阈值（页级 P90）</span><strong>${dur(threshold)}</strong></div>`;
      e2eStats.innerHTML = stats.count
        ? `<div class="selection-stat"><span>选区范围</span><strong>${spanText(viewEnd - viewStart)}</strong></div><div class="selection-stat"><span>有效样本</span><strong>${stats.count} 次</strong></div><div class="selection-stat metric"><span>平均（图内）</span><strong>${dur(stats.average)}</strong></div><div class="selection-stat metric"><span>P50（图内）</span><strong>${dur(stats.p50)}</strong></div><div class="selection-stat metric"><span>P90（图内）</span><strong>${dur(stats.p90)}</strong></div>${thresholdStat}`
        : `<div class="selection-empty">当前选区暂无已完成的有效样本</div>${thresholdStat}`;
      bindMarks();
      refreshHighlight();
    }

    function drawNpu() {
      const missing = pageSet()
        .filter(b => b.npu_data_missing && (npuFilter === 'all' || b.status === npuFilter)).length;
      npuDataNotice.textContent = missing
        ? `${missing} 个批次的 NPU 明细缺失或时间戳异常，未计入统计；缺失不代表没有排队。`
        : '排队时长按 GitHub Job 创建至开始时间计算。';
      const rows = npuRows();
      const stats = core.chartStats(rows, 'npu');
      const max = Math.max(stats.max * 1.12, 60);
      const yLabels = [0, 1, 2, 3, 4].map(i => dur(max * (1 - i / 4)));
      const m = { l: core.yAxisMarginLeft(yLabels), r: 22, t: 18, b: 42 };
      const measuredW = npuChartSvg.clientWidth;
      if (!Number.isFinite(measuredW) || measuredW < m.l + m.r + 1) { scheduleRedraw(); return; }
      const W = measuredW, H = 370;
      npuChartSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const range = Math.max(viewEnd - viewStart, 1);
      const x = t => m.l + (+new Date(t) - viewStart) / range * (W - m.l - m.r);
      const y = v => H - m.b - v / max * (H - m.t - m.b);
      let out = '';
      yLabels.forEach((label, i) => {
        const yy = m.t + i * (H - m.t - m.b) / 4;
        out += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${m.l - 8}" y="${yy + 3}" text-anchor="end">${label}</text>`;
      });
      /* REQ-031 AC01/AC02: 刻度数随绘图区实际宽度自适应（core.axisTicks）；首末标签
         锚定绘图区两端（start/end），杜绝越界裁切，中间标签保持居中锚点。
         压缩刻度只减少标签，不改变散点的时间映射或统计。 */
      const plotW = W - m.l - m.r;
      const ticks = core.axisTicks(viewStart, viewEnd, plotW, fmtDate(viewStart).length * AXIS_CHAR_W);
      ticks.forEach((t, i) => {
        const first = i === 0, last = i === ticks.length - 1;
        const xx = first ? m.l : last ? W - m.r : m.l + (i * plotW) / (ticks.length - 1);
        out += `<text class="axis" x="${xx}" y="${H - 13}" text-anchor="${first ? 'start' : last ? 'end' : 'middle'}">${fmtDate(t)}</text>`;
      });
      /* TA-013: reference lines are named and scoped; never an SLA. */
      if (stats.p90 != null) {
        const py = y(stats.p90);
        out += `<line class="p90-line" x1="${m.l}" x2="${W - m.r}" y1="${py}" y2="${py}"/><title>图内 P90（当前图内有效排队样本）</title><text class="ref-label" x="${W - m.r}" y="${py - 4}" text-anchor="end">图内 P90 ${dur(stats.p90)}</text>`;
      }
      /* TS28-006: no bucket-median curve or label on the NPU chart either. */
      const ordered = rows.slice().sort((a, b) => (a.status === 'success' ? 0 : 1) - (b.status === 'success' ? 0 : 1));
      const raw = ordered.map(b => ({ x: x(b.start_at), y: y(b.npu_queue_seconds) }));
      ordered.forEach((b, i) => {
        const point = raw[i];
        out += core.circleMark(b, point.x, point.y, D.batches.indexOf(b), fillFor(b.status), 'npu', point);
      });
      npuChartSvg.innerHTML = out;
      paintMarks(npuChartSvg);
      npuStats.innerHTML = stats.count
        ? `<div class="selection-stat"><span>选区范围</span><strong>${spanText(viewEnd - viewStart)}</strong></div><div class="selection-stat"><span>有效样本</span><strong>${stats.count} 次</strong></div><div class="selection-stat metric"><span>平均排队</span><strong>${dur(stats.average)}</strong></div><div class="selection-stat metric"><span>P50</span><strong>${dur(stats.p50)}</strong></div><div class="selection-stat metric"><span>P90</span><strong>${dur(stats.p90)}</strong></div>`
        : '<div class="selection-empty">当前选区暂无有效的 NPU 排队样本</div>';
      bindMarks();
      refreshHighlight();
    }

    function drawNavigator() {
      const rows = branchPool();
      const measuredW = navSvg.clientWidth;
      if (!Number.isFinite(measuredW) || measuredW < 10) { scheduleRedraw(); return; }
      const W = measuredW, H = 72, p = { l: 4, r: 4, t: 6, b: 19 };
      const domain = domainEnd - domainStart;
      const x = t => p.l + (t - domainStart) / domain * (W - p.l - p.r);
      const plotH = H - p.t - p.b;
      navSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      /* REQ-027 AC03: remember which navigator control held focus before the
         innerHTML rebuild replaces it. */
      const activeMode = navSvg.contains(document.activeElement) && document.activeElement.dataset
        ? document.activeElement.dataset.drag : null;
      let out = `<rect class="nav-bg" x="${p.l}" y="${p.t}" width="${W - p.l - p.r}" height="${plotH}" rx="2"/>`;
      /* REQ-017: the navigator maps only valid durations onto its height axis. */
      const navRows = rows.filter(b => core.validDuration(b.duration_seconds));
      const max = Math.max(1, ...navRows.map(b => b.duration_seconds));
      navRows.forEach(b => {
        const cy = p.t + plotH - b.duration_seconds / max * (plotH - 5) - 2;
        out += `<circle class="nav-point" cx="${x(+new Date(b.start_at))}" cy="${cy}" r="1.6" style="fill:${fillFor(b.status)}"/>`;
      });
      const sx = x(viewStart), ex = x(viewEnd);
      out += `<rect class="nav-dim" x="${p.l}" y="${p.t}" width="${Math.max(0, sx - p.l)}" height="${plotH}"/>`;
      out += `<rect class="nav-dim" x="${ex}" y="${p.t}" width="${Math.max(0, W - p.r - ex)}" height="${plotH}"/>`;
      /* REQ-027 AC01/AC02: three named, focusable slider entries whose value
         semantics are rebuilt with every redraw. */
      const sem = core.navSliderSemantics(domainStart, domainEnd, viewStart, viewEnd);
      out += `<rect class="nav-selection" data-drag="window" role="slider" tabindex="0" aria-label="时间范围整体窗口" aria-valuemin="${sem.window.min}" aria-valuemax="${sem.window.max}" aria-valuenow="${sem.window.now}" aria-valuetext="${fmtDate(viewStart)} — ${fmtDate(viewEnd)}（${spanText(viewEnd - viewStart)}）" x="${sx}" y="${p.t}" width="${Math.max(1, ex - sx)}" height="${plotH}"/>`;
      for (const [side, xx] of [['start', sx], ['end', ex]]) {
        out += `<rect class="nav-handle" data-drag="${side}" role="slider" tabindex="0" aria-label="时间范围${side === 'start' ? '起点' : '终点'}" aria-valuemin="${sem[side].min}" aria-valuemax="${sem[side].max}" aria-valuenow="${sem[side].now}" aria-valuetext="${fmtDate(side === 'start' ? viewStart : viewEnd)}" x="${xx - 6}" y="${p.t - 2}" width="12" height="${plotH + 4}" rx="2"/>`;
        out += `<line class="nav-grip" x1="${xx - 2}" x2="${xx - 2}" y1="${p.t + 12}" y2="${p.t + plotH - 12}"/><line class="nav-grip" x1="${xx + 2}" x2="${xx + 2}" y1="${p.t + 12}" y2="${p.t + plotH - 12}"/>`;
      }
      out += `<text class="nav-axis" x="${p.l}" y="${H - 4}">${fmtDate(domainStart)}</text><text class="nav-axis" text-anchor="end" x="${W - p.r}" y="${H - 4}">${fmtDate(domainEnd)}</text>`;
      navSvg.innerHTML = out;
      /* REQ-027 AC03: redraws replace the inner DOM, so the focused control
         is restored on its rebuilt counterpart to keep focus visible. */
      if (activeMode) {
        const restored = navSvg.querySelector(`[data-drag="${activeMode}"]`);
        if (restored) restored.focus();
      }
      const hours = Math.round((viewEnd - viewStart) / HOUR);
      all('[data-hours]').forEach(b => b.classList.toggle('active', Math.abs(Number(b.dataset.hours) - hours) < 1 && Math.abs(viewEnd - domainEnd) < 60000));
      selectedRangeEl.textContent = `${fmtDate(viewStart)} — ${fmtDate(viewEnd)}`;
      rangeCountEl.textContent = spanText(viewEnd - viewStart);
    }

    const redrawAll = () => { draw(); drawNpu(); drawNavigator(); };
    /* TA-003: resize handlers defer to the next animation frame so clientWidth is
       read after the final layout, not during an in-flight CSS/layout transition. */
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : id => clearTimeout(id);
    let redrawRaf = 0;
    const scheduleRedraw = () => { caf(redrawRaf); redrawRaf = raf(redrawAll); };

    function updateSummary() {
      const s = currentSummary(), pool = pageSet();
      const e2e = core.chartStats(pool, 'e2e'), npu = core.chartStats(pool, 'npu');
      kE2eP90.textContent = dur(e2e.p90);
      kE2eP50.textContent = 'P50 ' + dur(e2e.p50);
      kE2eN.textContent = 'n=' + e2e.count + (e2e.count > 0 && e2e.count < 10 ? ' · 样本不足' : '');
      kNpuP90.textContent = dur(npu.p90);
      kNpuP50.textContent = 'P50 ' + dur(npu.p50);
      kNpuN.textContent = 'n=' + npu.count + (npu.count > 0 && npu.count < 10 ? ' · 样本不足' : '');
      boundaryEl.textContent = boundaryText();
      const counts = { success: 0, failure: 0, running: 0, cancelled: 0 };
      pool.forEach(b => { if (counts[b.status] != null) counts[b.status] += 1; });
      statusPillsEl.innerHTML = ['success', 'failure', 'running', 'cancelled']
        .map(key => `<span class="pill ${key}">${statusLabels[key]} ${counts[key]}</span>`).join('');
      const fm = document.getElementById('footerMeta');
      if (fm) fm.textContent = footerText();
    }

    function renderBranchOptions() {
      const counts = {};
      D.batches.forEach(b => { counts[b.base_branch] = (counts[b.base_branch] || 0) + 1; });
      const rows = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
      for (const branch of selectedBranches) if (!(branch in counts)) rows.push([branch, null]);
      branchOptionsEl.innerHTML = rows
        .map(([branch, count]) => `<label class="branch-option"><input type="checkbox" value="${esc(branch)}" ${selectedBranches.has(branch) ? 'checked' : ''}><b>${esc(branch)}</b><span>${count == null ? '本快照无批次' : count}</span></label>`).join('');
      branchSummaryEl.textContent = selectedBranches.size ? `合入分支：已选 ${selectedBranches.size} 项` : '合入分支：全部';
      syncBranchBadge([...selectedBranches]);
    }

    function updateGlobal() {
      clearHover();
      updateSummary(); redrawAll(); renderRows(); syncUrl();
    }

    /* ---- TS28-001: rich hover card shared by both charts ---- */
    const relatedIdx = core.relatedIndex(D.batches);
    let hoveredPrKey = null;
    let highlightMarks = [];
    let lastHoverMark = null;
    let currentTipBatch = null;
    let currentTipKind = 'e2e';

    const secondsText = (seconds, observed) => {
      if (seconds == null || !Number.isFinite(seconds)) return '—';
      return `${dur(seconds)}（${Number(seconds).toFixed(2)} s${observed ? '，截至采集已观测' : ''}）`;
    };
    const resultText = result => statusLabels[result] || '未知';
    const resultTag = result => `<span class="tip-result ${esc(result)}">${esc(resultText(result))}</span>`;
    const anchorHtml = (url, label, cls) => {
      const href = core.safeLink(url);
      return href ? `<a class="${esc(cls || '')}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
    };

    function jobRowHtml(job) {
      const t = job.timing || {};
      const observed = t.observedSeconds != null
        ? `<span class="tip-observed">截至采集已观测 ${secondsText(t.observedSeconds, true)}</span>` : '';
      const wait = t.applicable === false ? '不适用（已跳过）' : secondsText(t.waitSeconds);
      const run = t.applicable === false ? '不适用（已跳过）' : secondsText(t.runSeconds);
      const failed = (t.failedSteps || []).length
        ? `<span class="missing">失败步骤：${esc(t.failedSteps.join('、'))}</span>` : '';
      const anomaly = t.anomaly ? `<span class="missing">${esc(t.anomaly)}</span>` : '';
      return `<div class="tip-job"><span class="tip-job-name">${anchorHtml(job.url, job.name + ' ↗') || esc(job.name)}</span>${resultTag(job.result)}<span>排队 ${esc(wait)}</span><span>执行 ${esc(run)}</span>${observed}${failed}${anomaly}</div>`;
    }

    function memberHtml(member) {
      const time = member.time || {};
      const jobs = (member.jobs || []).map(jobRowHtml).join('')
        || '<div class="tip-job missing">job 明细未获取</div>';
      const incomplete = member.jobsComplete === false ? '<span class="missing">部分明细：job 分页不完整</span>' : '';
      return `<details class="tip-wf"><summary><span class="tip-wf-name">${esc(member.name)} · run ${esc(member.runId == null ? '?' : member.runId)} · attempt ${esc(member.attempt)}</span><span>首任务等待 ${esc(secondsText(time.firstJobWaitSeconds))}</span><span>执行跨度 ${esc(secondsText(time.executionSpanSeconds))}</span>${resultTag(member.result)}${anchorHtml(member.url, '↗')}</summary>${time.missingReason ? `<p class="tip-note">${esc(time.missingReason)}</p>` : ''}${incomplete}<div class="tip-jobs">${jobs}</div></details>`;
    }

    function focusRowHtml(row) {
      const t = row.timing || {};
      const label = core.FOCUS_LABELS[row.key] || `${String(row.key).toUpperCase()}`;
      return `<div class="tip-focus-row"><span class="tip-chip">${esc(label)}</span><span class="tip-focus-name">${esc(row.name)}</span><span>排队 ${esc(secondsText(t.waitSeconds))}</span><span>执行 ${esc(secondsText(t.runSeconds))}</span>${resultTag(row.result)}${anchorHtml(row.url, '↗')}${t.anomaly ? `<span class="missing">${esc(t.anomaly)}</span>` : ''}</div>`;
    }

    function relatedRowHtml(row) {
      return `<div class="tip-related-row"><span class="tip-wf-name">${esc(row.workflowName)} #${esc(row.attempt)}</span><span>${esc(fmtStamp(row.startAt))}</span><span>独立耗时 ${esc(secondsText(row.durationSeconds))}</span>${resultTag(row.result)}${anchorHtml(row.url, 'Actions ↗')}</div>`;
    }

    function cardHtml(model, pinned) {
      const headValue = model.metric === 'npu'
        ? `最长排队 ${secondsText(model.npuQueueSeconds)}`
        : `E2E ${secondsText(model.durationSeconds)}`;
      const runText = model.runId == null ? '?' : model.runId;
      const title = model.prKnown
        ? `PR #${esc(model.pr)} · ${esc(model.title)}`
        : `未关联 PR · Run #${esc(runText)} · attempt ${esc(model.attempt)}`;
      const links = [
        model.prKnown ? anchorHtml(model.links.pr, `打开 PR #${model.pr}`) : '<span class="tip-note">未关联 PR，不生成 PR 链接</span>',
        anchorHtml(model.links.actions, `本次 ${((model.reliable.members[0] || {}).name) || 'Actions'} Actions ↗`),
        '<button type="button" class="tip-detail" data-role="tipDetail">运行详情</button>',
      ].filter(Boolean).join('');
      const members = model.reliable.members.map(memberHtml).join('');
      const reliableNote = model.reliable.members.length
        ? `<p class="tip-note">${esc(model.boundary.associationNote)}</p>`
        : `<p class="tip-note">${esc(model.reliable.note)}</p>`;
      const focusRows = model.focus.rows.map(focusRowHtml).join('');
      const focusMissing = model.focus.missing.map(item => `<p class="tip-note">未找到 ${esc(item.label)}：${esc(item.reason)}</p>`).join('');
      const focusSection = `<section class="tip-section"><h4>重点测试任务（本次可靠集合）</h4>${focusRows || `<p class="tip-note">${esc(model.focus.note || '没有找到匹配任务')}</p>`}${focusMissing}</section>`;
      const relatedRows = model.related.rows.map(relatedRowHtml).join('');
      const relatedSection = `<details class="tip-section tip-related"><summary>同提交其他运行（${model.related.count} 个，不能证明同次触发，不计 E2E）</summary>${relatedRows || `<p class="tip-note">${esc(model.related.note)}</p>`}<p class="tip-note">范围：当前快照内同 PR、同完整 SHA 的候选；快照外不宣称完整，也不改变图中指标。</p></details>`;
      const npuSection = model.metric === 'npu'
        ? `<section class="tip-section tip-npu"><h4>本次记录的 NPU Jobs（取最长排队）</h4>${(model.npu.jobs || []).map(jobRowHtml).join('') || '<p class="tip-note">当前记录没有可用的 NPU job 明细</p>'}</section>`
        : '';
      const notApplicable = !model.npuApplicable
        ? `<p class="tip-note warn">${esc(model.npuNotApplicableReason)}</p>` : '';
      const exclusion = model.exclusionLabel
        ? `<p class="tip-note">E2E 排除：${esc(model.exclusionLabel)}</p>` : '';
      const evidence = [
        `关联依据：${model.boundary.associationNote}`,
        `发现截止 ${fmtStamp(model.boundary.discoveryCutoff)}`,
        `采集完成 ${fmtStamp(model.boundary.collectedAt)}`,
        `当前可见同 PR：${model.boundary.visibleSamePr} 个点`,
      ].concat(model.boundary.aggregationNote ? [model.boundary.aggregationNote] : []).map(esc).join(' · ');
      return `<div class="tip-head"><div class="tip-headline"><span class="tip-result ${esc(model.result)}">${esc(resultText(model.result))}</span><strong>${esc(headValue)}</strong></div>${pinned ? '<span class="tip-pin">已固定 · 关闭后恢复悬停</span>' : ''}<button type="button" class="tip-close" aria-label="关闭详情"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button></div>
        <div class="tip-title">${title}</div>
        <div class="tip-summary">${esc(model.author || '未知作者')} · ${esc(model.branch || '未知来源')} → ${esc(model.baseBranch || '未知目标分支')}</div>
        <div class="tip-ident">SHA <code class="tip-sha">${esc(model.sha || '未知')}</code> · run ${esc(runText)} · attempt ${esc(model.attempt)} · 触发 ${esc(fmtStamp(model.startAt))}</div>
        <div class="tip-actions-row">${links}</div>
        ${notApplicable}${exclusion}
        <section class="tip-section"><h4>本次可靠关联的运行（${model.reliable.members.length} 个；来源证据：run/attempt 身份）</h4>${members || `<p class="tip-note">${esc(model.reliable.note)}</p>`}${reliableNote}</section>
        ${focusSection}${relatedSection}${npuSection}
        <div class="tip-hint">${evidence}${model.missing.length ? ' · 证据缺口：' + esc(model.missing.join('；')) : ''}</div>`;
    }

    function visibleSamePrCount(pr) {
      if (pr == null) return 0;
      return new Set(all('.mark-hit').filter(mark => {
        const batch = D.batches[+mark.dataset.i];
        return batch && batch.pr === pr;
      }).map(mark => mark.dataset.i)).size;
    }

    function modelFor(batch, kind) {
      return core.hoverModel(batch, {
        metric: kind, batches: D.batches, index: relatedIdx,
        collectedAt: D.collected_at, discoveryCutoff: (D.discovery || {}).fetch_window_end,
        windowStart: D.window_start, windowEnd: D.window_end,
        visibleSamePr: visibleSamePrCount(batch && batch.pr),
      });
    }

    function clearHighlight() {
      highlightMarks.forEach(entry => {
        const dot = entry.dot;
        if (!dot) return;
        dot.setAttribute('r', '3.5');
        if (entry.source) {
          dot.removeAttribute('stroke');
          dot.removeAttribute('stroke-width');
        }
      });
      all('.mark-hit').forEach(mark => {
        mark.classList.toggle('is-pr', false);
        mark.classList.toggle('is-pr-source', false);
      });
      highlightMarks = [];
      hoveredPrKey = null;
    }

    /* TS28-005: enlarge every currently drawn point of PR=P in BOTH charts
       (all SHA/attempts), without touching x/y, colors, KPI or URL. Unknown PR
       points only enlarge themselves. */
    function applyHighlight(pr, sourceMark) {
      clearHighlight();
      all('.mark-hit').forEach(mark => {
        const batch = D.batches[+mark.dataset.i];
        if (!batch) return;
        const match = pr != null && batch.pr === pr;
        if (!match && mark !== sourceMark) return;
        const dot = mark.querySelector('.dot');
        if (!dot) return;
        dot.setAttribute('r', '7');
        const source = mark === sourceMark;
        if (source) {
          if (dot.style.fill) dot.setAttribute('stroke', dot.style.fill);
          dot.setAttribute('stroke-width', '1.5');
        }
        mark.classList.add('is-pr');
        if (source) mark.classList.add('is-pr-source');
        highlightMarks.push({ dot, source });
      });
      /* '∅' keeps an unknown-PR self-highlight alive across a redraw; plain
         null still means "no active group". */
      hoveredPrKey = pr == null ? '∅' : String(pr);
    }

    /* TS28-005 AC3: a resize redraws the marks but keeps the currently valid PR
       group; hidden/filtered marks cannot be resurrected because the lookup is
       always against the live DOM. */
    function refreshHighlight() {
      if (hoveredPrKey == null) return;
      const source = lastHoverMark && lastHoverMark.isConnected ? lastHoverMark : null;
      applyHighlight(hoveredPrKey === '∅' ? null : Number(hoveredPrKey), source);
    }

    function showTip(b, kind, mark, pinned) {
      currentTipBatch = b;
      currentTipKind = kind;
      const model = modelFor(b, kind);
      lastHoverMark = mark || lastHoverMark;
      tip.innerHTML = cardHtml(model, !!pinned);
      tip.classList.toggle('pinned', !!pinned);
      tip.style.display = 'block';
      placeCard(mark);
      applyHighlight(model.pr, mark);
    }

    /* TS28-001 AC4: the card never exceeds viewport-24 and never covers the
       originating mark; when the natural card is taller than the space above
       or below, it shrinks and scrolls internally instead of overlapping. */
    function placeCard(mark) {
      const rect = mark && typeof mark.getBoundingClientRect === 'function' ? mark.getBoundingClientRect() : null;
      const ax = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const ay = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const pad = 12, gap = 14;
      const spaceAbove = rect ? Math.max(0, rect.top - gap - pad) : 0;
      const spaceBelow = rect ? Math.max(0, window.innerHeight - rect.bottom - gap - pad) : 0;
      const cap = Math.max(120, window.innerHeight - 24);
      const natural = Math.max(tip.scrollHeight || 0, 160);
      /* Shrink against the side the card will actually occupy, not against the
         larger side: otherwise placeTipBox may flip to the smaller side and
         cover the mark. */
      const chosen = spaceBelow >= Math.min(natural, cap) ? spaceBelow : spaceAbove;
      tip.style.maxHeight = Math.max(160, Math.min(cap, chosen)) + 'px';
      const p = core.placeTipBox(ax, ay, tip.offsetWidth, tip.offsetHeight, window.innerWidth, window.innerHeight, 16, 16);
      tip.style.left = p.x + 'px';
      tip.style.top = p.y + 'px';
    }

    /* REQ-029/TS28-001 AC3/AC5: one close path for Esc, ✕, outside click and
       the 180ms leave timer. Closing clears the same-PR group and returns focus
       to the originating mark when focus was inside the card. */
    function hideTip(fallback) {
      const wasInside = tip.contains(document.activeElement);
      tipPinned = false;
      tip.classList.toggle('pinned', false);
      tip.style.display = 'none';
      clearHighlight();
      lastHoverMark = null;
      currentTipBatch = null;
      const target = fallback || lastPinnedMark;
      if (wasInside && target && target.isConnected) {
        /* Returning focus must not immediately reopen the card via onfocus. */
        focusReturnGuard = true;
        target.focus();
        focusReturnGuard = false;
      }
    }

    /* Filters/time/branch changes and teardown actively release pin+hover. */
    function clearHover() {
      clearTimeout(tipTimer);
      hideTip();
      lastPinnedMark = null;
    }

    function candidatesFor(mark, b) {
      const svg = mark.closest('svg');
      const marks = svg ? [...svg.querySelectorAll('.mark-hit')] : [];
      return core.overlapIndices(marks.map(m => ({ i: +m.dataset.i, x: +m.dataset.x, y: +m.dataset.y })),
        +mark.dataset.x, +mark.dataset.y).map(i => D.batches[i]);
    }

    function bindMarks() {
      all('.mark-hit').forEach(mark => {
        const b = D.batches[+mark.dataset.i];
        if (!b) return;
        const kind = mark.dataset.kind === 'npu' ? 'npu' : 'e2e';
        mark.onmouseenter = e => {
          clearTimeout(tipTimer);
          if (tipPinned) return;
          showTip(b, kind, mark, false);
        };
        mark.onmousemove = e => {
          if (tipPinned) return;
          /* Moving between points only re-renders when the identity changes,
             so a same-PR sweep does not rebuild the card on every pixel. */
          if (currentTipBatch !== b || currentTipKind !== kind) showTip(b, kind, mark, false);
        };
        mark.onmouseleave = () => {
          if (tipPinned) return;
          tipTimer = setTimeout(() => hideTip(mark), 180);
        };
        /* TS28-001 AC5: keyboard focus exposes the same information. */
        mark.onfocus = () => {
          clearTimeout(tipTimer);
          if (tipPinned || focusReturnGuard) return;
          showTip(b, kind, mark, false);
        };
        mark.onblur = () => {
          if (tipPinned) return;
          tipTimer = setTimeout(() => {
            if (!tipPinned && !tip.contains(document.activeElement)) hideTip(mark);
          }, 180);
        };
        mark.onclick = e => {
          e.stopPropagation();
          hideTip();
          if (kind !== 'npu' && root.openTritonDetail) { openDetail(b, candidatesFor(mark, b)); return; }
          /* TS28-002/3.2: explicit NPU click pins this identity; hovering other
             points never rewrites it, another explicit click switches it. */
          tipPinned = true;
          lastPinnedMark = mark;
          showTip(b, kind, mark, true);
        };
        /* REQ-029 AC01: SVG marks carry no native button activation, so
           Enter/Space open the same unified detail from the keyboard. */
        mark.onkeydown = e => {
          if (e.key === 'Escape') { e.preventDefault(); hideTip(mark); return; }
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          hideTip();
          if (kind !== 'npu' && root.openTritonDetail) { openDetail(b, candidatesFor(mark, b)); return; }
          tipPinned = true;
          lastPinnedMark = mark;
          showTip(b, kind, mark, true);
          tip.focus();
        };
      });
    }

    tip.onmouseenter = () => clearTimeout(tipTimer);
    tip.onmouseleave = () => {
      if (tipPinned) return;
      const target = lastHoverMark;
      tipTimer = setTimeout(() => hideTip(target), 180);
    };
    /* REQ-029 AC02: Esc and the ✕ button close the pinned card; focus that
       was inside returns to the originating mark. */
    tip.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); hideTip(lastHoverMark); }
    };
    tip.onclick = e => {
      if (e.target.closest('.tip-close')) { e.stopPropagation(); hideTip(lastHoverMark); return; }
      const detailButton = e.target.closest('[data-role="tipDetail"]');
      if (detailButton) {
        e.stopPropagation();
        const batch = currentTipBatch;
        const mark = lastHoverMark;
        hideTip();
        if (batch && root.openTritonDetail) openDetail(batch, mark ? candidatesFor(mark, batch) : undefined);
      }
    };
    const onDocClick = e => {
      if (!e.target.closest('.tooltip') && !e.target.closest('.mark-hit')) hideTip();
    };
    const onDocKeydown = e => {
      if (e.key === 'Escape' && tip.style.display === 'block') { e.preventDefault(); hideTip(lastHoverMark); }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onDocKeydown);

    /* ---- 关注列表（分组、搜索、展开、样本退化） ---- */
    function wfHtml(w, b) {
      const start = +new Date(b.start_at), end = +new Date(b.end_at || D.window_end);
      const total = Math.max(end - start, 1);
      const ws = +new Date(w.created_at), we = +new Date(w.updated_at || D.window_end);
      const left = Math.max(0, (ws - start) / total * 100);
      const width = Math.max(.5, (we - ws) / total * 100);
      const jobs = (w.jobs || []).length ? w.jobs.map(j => `<span class="${j.conclusion === 'failure' ? 'failed' : ''}">${esc(j.name)} · 等待 ${dur(j.wait_seconds)} / 执行 ${dur(j.run_seconds)}${(j.failed_steps || []).length ? ' · 失败步骤：' + j.failed_steps.map(esc).join('、') : ''}</span>`).join('') : '<span>job 明细未获取</span>';
      return `<div class="workflow"><div class="wf-name"><a class="link" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.name)}</a> · #${w.attempt}</div><div class="track"><i class="bar ${w.conclusion || w.status}" style="left:${left}%;width:${Math.min(100 - left, width)}%"></i></div><div class="wf-time">${dur((we - ws) / 1000)}</div></div><div class="jobs">${jobs}</div>`;
    }

    function rowHtml(b, groupKey, reasons = []) {
      /* REQ-028 AC01: the expansion entry is a named button that declares its
         expanded state and controlled region; the row surface keeps working
         as a mouse shortcut through the row-main click handler. */
      const ids = core.rowDomIds(esc(b.id), groupKey);
      return `<article class="row" id="${ids.rowId}" data-batch-id="${esc(b.id)}"><div class="row-main"><button type="button" class="row-toggle" aria-expanded="false" aria-controls="${ids.detailId}" aria-label="${esc(core.markLabel(b, 'e2e'))}"><svg class="icon" aria-hidden="true"><use href="#i-chevron-right"/></svg></button><div>${identityHtml(b)}<div class="sub">${esc((b.sha || '未知').slice(0, 7))}${b.kind === 'rerun' ? ' · 重跑' : ''}</div></div><div class="title">${esc(b.title)}<div class="sub reasons">${reasons.map(reason => `<span class="pill">${esc(reason)}</span>`).join(' · ')}</div><div class="sub">${esc(b.author || '未知作者')} · ${esc(b.branch || '未知来源')} → ${esc(b.base_branch)}</div></div><div class="status ${esc(b.status)}">${statusLabels[b.status] || esc(b.status)}</div><div class="sub">${b.start_at ? fmtDate(b.start_at) : '起点未知'}</div><div class="duration">${core.sampleEligible(b) ? '' : '已观测 '}${dur(b.duration_seconds)}${b.approximate ? '*' : ''}${qualificationHtml(b)}</div><div class="critical">${b.status === 'running' ? '仍在等待 / 执行：' : '最后结束：'}${esc(b.critical_workflow || '未知')}</div></div><div class="detail" id="${ids.detailId}"><div class="detail-meta">起点：${b.start_at ? fmtDate(b.start_at) + '（' + core.startSourceLabel(b) + '）' : '无本次起点证据，E2E 留空'} · 合入分支：${esc(b.base_branch)} · ${b.end_at ? '结束：' + fmtDate(b.end_at) : '截至采集时间仍未结束'}</div>${(b.missing || []).map(x => `<div class="notice">${esc(x)}</div>`).join('')}${(b.workflows || []).map(w => wfHtml(w, b)).join('')}</div></article>`;
    }

    function renderRows() {
      syncUrl();
      const summary = currentSummary();
      const unknownPool = unknownTimePool();
      const unknownBranchPool = unknownTimeBranchPool();
      unknownTimeBtn.textContent = `时间未知${unknownBranchPool.length ? `(${unknownBranchPool.length})` : ''}`;
      unknownTimeBtn.classList.toggle('active', unknownTime);
      showAllBtn.textContent = showAll ? '返回关注列表' : '查看全部批次';
      /* REQ-028 AC03: the innerHTML swaps below destroy the focused row;
         remember it so focus can return to the same row's toggle when it
         survives, or move to the search box when the row is gone. */
      const activeRow = attentionEl.contains(document.activeElement) ? document.activeElement.closest('.row') : null;
      const activeRowId = activeRow ? activeRow.id : null;
      /* EC-008-AC03: the unknown-start diagnostic set is reachable on the same page
         without a data-quality page; it never feeds the selection quantiles and its
         rows still open the unified detail (start evidence marked unknown there). */
      if (unknownTime) {
        const rows = unknownPool.slice().sort((a, b) => +new Date(b.end_at || D.window_end) - +new Date(a.end_at || D.window_end));
        priorityNoteEl.textContent = `${rows.length} 个批次起点未知但有来源身份，不计入选区分位数；详情与导出标注时间未知。`;
        attentionEl.innerHTML = `<div class="group-title">时间未知<span class="count">${rows.length}</span></div><div class="rows">${rows.length ? rows.map(b => rowHtml(b, 'unknown', ['起点未知'])).join('') : '<div class="empty">当前没有起点未知且带来源身份的批次</div>'}</div>`;
        bindRowClicks();
        restoreListFocus(activeRowId);
        return;
      }
      if (!summary.batches) {
        priorityNoteEl.textContent = '当前分支与时间范围内没有批次。';
        attentionEl.innerHTML = '<div class="empty">当前合入分支与时间范围内没有批次，请调整分支筛选或扩大时间范围。</div>';
        restoreListFocus(activeRowId);
        return;
      }
      const pool = searchPool();
      /* REQ-026 AC01: the grouping strategy, threshold and labels come from G
         (pageSet) and its valid-sample count; the search only filters the rows
         inside each group and never changes the strategy. ADR-007: the list and
         the CSV download share the same deduped, ordered batch set. */
      const entries = showAll
        ? new Map(pool.slice().sort((a, b) => +new Date(b.start_at) - +new Date(a.start_at)).map(batch => [batch.id, { batch, reasons: new Set() }]))
        : attentionEntries();
      priorityNoteEl.textContent = core.attentionNote(summary.valid);
      attentionEl.innerHTML = `<div class="group-title">${showAll ? '全部批次' : '关注批次'}<span class="count">${entries.size}</span></div><div class="rows">${entries.size ? [...entries.values()].map(entry => rowHtml(entry.batch, showAll ? 'all' : 'priority', [...entry.reasons])).join('') : '<div class="empty">当前没有匹配批次</div>'}</div>`;
      bindRowClicks();
      restoreListFocus(activeRowId);
    }

    /* REQ-028 AC01/AC02: every listed row opens the unified detail; a link inside
       a row navigates without also opening the detail. */
    function bindRowClicks() {
      all('.row').forEach(row => {
        const main = row.querySelector('.row-main');
        main.onclick = e => {
          if (e.target.closest('a')) return; /* REQ-028 AC02: activating a link navigates, it must not also open the detail */
          const b = D.batches.find(x => String(x.id) === row.dataset.batchId);
          if (b && root.openTritonDetail) openDetail(b);
          else setRowOpen(row, !row.classList.contains('open'));
        };
      });
    }

    /* REQ-028 AC01: aria-expanded always mirrors the visible open state. */
    function setRowOpen(row, open) {
      row.classList.toggle('open', open);
      const btn = row.querySelector('.row-toggle');
      if (btn) btn.setAttribute('aria-expanded', String(open));
    }

    /* REQ-028 AC03: focus returns to the same row's toggle when the row
       survives the re-render, otherwise to the still-visible search box. */
    function restoreListFocus(activeRowId) {
      if (!activeRowId) return;
      const row = document.getElementById(activeRowId);
      const btn = row ? row.querySelector('.row-toggle') : null;
      if (btn) btn.focus();
      else searchInput.focus();
    }

    /* ---- 新鲜度：生产北京时间 8/12/16/18/20 槽位 + 90 分钟宽限 ---- */
    function updateFreshness() {
      const result = core.freshnessSlots(Date.now(), D.collected_at);
      freshnessEl.hidden = !result.stale;
      freshnessEl.textContent = result.stale ? '数据更新已延迟：当前展示最后一次成功采集结果，请检查 GitHub Actions。' : '';
    }

    /* ---- 导出批次 CSV：G × 列表搜索后的完整唯一批次集合（字段与 triton-batches.csv 同集 16 项） ---- */
    async function exportBatches() {
      if (!root.Metrics || typeof root.Metrics.saveCsv !== 'function') return;
      const session = active;
      exportBtn.disabled = true;
      let notice = container.querySelector('[data-role="exportNotice"]');
      if (!notice) {
        notice = document.createElement('div');
        notice.className = 'export-notice';
        notice.setAttribute('role', 'status');
        notice.setAttribute('data-role', 'exportNotice');
        container.insertBefore(notice, container.firstChild);
      }
      notice.textContent = '正在保存 CSV…';
      /* ADR-013: freeze the complete export — rows, scope and the qualification
         sidecar — before the first await, so a filter/branch/time change during
         the request cannot split the CSV from its audit metadata. */
      const pool = displayedPool();
      const rows = [csvFields, ...pool.map(b => csvFields.map(key =>
        key === 'missing' ? (b.missing || []).join('; ') : key === 'approximate' ? (b.approximate ? 'True' : 'False') : key === 'start_at' ? (b.start_at || '时间未知') : b[key] ?? ''))];
      const scope = exportScope(D, { start: viewStart, end: viewEnd, branches: [...selectedBranches], query: searchInput.value, unknownTime });
      const qualification = { schema_version: 1, metric: scope.metric, metric_version: scope.metric_version,
        collected_at: D.collected_at, window_start: D.window_start, window_end: D.window_end,
        scope, analysis_scope: scope,
        batches: pool.map(b => ({ id: b.id, pr: b.pr ?? null,
          workflow_attempts: (b.workflows || []).map(w => ({ run_id: w.id, attempt: w.attempt || 1 })),
          workflow_run_count: b.workflow_run_count != null ? b.workflow_run_count : (b.workflows || []).length,
          aggregation_note: b.aggregation_note || null,
          e2e_sample_eligible: core.sampleEligible(b), e2e_exclusion_reason: b.e2e_exclusion_reason || (b.pr == null ? 'unresolved_pr_batch_identity' : core.sampleEligible(b) ? null : 'non_sample_result') })) };
      try {
        const file = await root.Metrics.saveCsv(rows, 'triton-batches.csv');
        if (active !== session) return;
        saveQualifications(qualification);
        notice.innerHTML = file.mode === 'saved'
          ? `CSV 已保存到本地：<a href="${esc(file.url)}" download="${esc(file.name)}">${esc(file.name)} ↓</a>；资格元数据已由浏览器下载。`
          : '已下载：' + esc(file.name) + ' 与 triton-qualifications-v1.json';
      } catch (err) {
        if (active === session) notice.textContent = '导出失败：' + (err && err.message ? err.message : err);
      } finally {
        if (active === session) exportBtn.disabled = false;
      }
    }

    /* ---- 交互绑定 ---- */
    el('[data-role="e2eFilters"]').onclick = e => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      filter = btn.dataset.filter;
      all('[data-filter]').forEach(x => x.classList.toggle('active', x === btn));
      clearHover();
      draw(); syncUrl();
    };
    el('[data-role="npuFilters"]').onclick = e => {
      const btn = e.target.closest('[data-npu-filter]');
      if (!btn) return;
      npuFilter = btn.dataset.npuFilter;
      all('[data-npu-filter]').forEach(x => x.classList.toggle('active', x === btn));
      clearHover();
      drawNpu(); syncUrl();
    };
    el('.range-control').onclick = e => {
      const btn = e.target.closest('[data-hours]');
      if (!btn) return;
      [viewStart, viewEnd] = core.windowForHours(domainStart, domainEnd, Number(btn.dataset.hours));
      updateGlobal();
    };

    /* TA-011: pointer→time reverse mapping reuses the same inset padding as
       drawNavigator, so a click at a screen position lands on the same instant
       the drawing placed at that position. */
    const navTime = e => {
      const rect = navSvg.getBoundingClientRect();
      return core.navTimeAt(e.clientX, rect.left, rect.width, domainStart, domainEnd, { l: 4, r: 4 });
    };
    navSvg.onpointerdown = e => {
      e.preventDefault();
      const mode = (e.target.dataset && e.target.dataset.drag) || 'jump';
      const at = navTime(e);
      if (mode === 'jump') {
        [viewStart, viewEnd] = core.moveWindow(domainStart, domainEnd, viewStart, viewEnd, at - (viewStart + viewEnd) / 2);
        navDrag = { mode: 'window', origin: at, start: viewStart, end: viewEnd };
      } else {
        navDrag = { mode, origin: at, start: viewStart, end: viewEnd };
      }
      navDrag.pointerId = e.pointerId;
      navSvg.setPointerCapture(e.pointerId);
      updateGlobal();
    };
    navSvg.onpointermove = e => {
      if (!navDrag) return;
      const at = navTime(e), delta = at - navDrag.origin;
      if (navDrag.mode === 'window') [viewStart, viewEnd] = core.moveWindow(domainStart, domainEnd, navDrag.start, navDrag.end, delta);
      else if (navDrag.mode === 'start') viewStart = core.clampBoundary(domainStart, domainEnd, viewStart, viewEnd, 'start', navDrag.start + delta);
      else viewEnd = core.clampBoundary(domainStart, domainEnd, viewStart, viewEnd, 'end', navDrag.end + delta);
      updateGlobal();
    };
    navSvg.onpointerup = navSvg.onpointercancel = () => { navDrag = null; };
    /* REQ-027 AC01/AC04: keyboard operation of the shared time range; arrow
       keys move the window or adjust the focused boundary, Home/End reach the
       allowed edges, under the same constraints as pointer dragging. */
    navSvg.onkeydown = e => {
      const mode = e.target && e.target.dataset ? e.target.dataset.drag : null;
      if (!['window', 'start', 'end'].includes(mode)) return;
      const directions = { ArrowLeft: 'left', ArrowDown: 'left', ArrowRight: 'right', ArrowUp: 'right', Home: 'home', End: 'end' };
      const direction = directions[e.key];
      if (!direction) return;
      e.preventDefault();
      [viewStart, viewEnd] = core.keyWindow(`${mode}-${direction}`, domainStart, domainEnd, viewStart, viewEnd);
      updateGlobal();
    };

    branchOptionsEl.onchange = e => {
      if (!e.target.matches('input[type=checkbox]')) return;
      if (e.target.checked) selectedBranches.add(e.target.value);
      else selectedBranches.delete(e.target.value);
      renderBranchOptions();
      updateGlobal();
    };
    el('[data-role="clearBranches"]').onclick = () => { selectedBranches.clear(); renderBranchOptions(); updateGlobal(); };
    searchInput.oninput = renderRows;
    showAllBtn.onclick = () => { showAll = !showAll; unknownTime = false; renderRows(); };
    unknownTimeBtn.onclick = () => { unknownTime = !unknownTime; showAll = false; renderRows(); };
    exportBtn.onclick = exportBatches;
    const onResize = () => scheduleRedraw();
    window.addEventListener('resize', onResize);

    /* ---- 初始化 ---- */
    updateFreshness();
    const freshTimer = setInterval(updateFreshness, 60000);
    renderBranchOptions();
    updateGlobal();

    active = {
      destroy() {
        clearTimeout(tipTimer);
        clearHighlight();
        tipPinned = false;
        tip.classList.toggle('pinned', false);
        tip.style.display = 'none';
        lastPinnedMark = null;
        lastHoverMark = null;
        currentTipBatch = null;
        if (navDrag && navDrag.pointerId != null && navSvg.releasePointerCapture) {
          try { navSvg.releasePointerCapture(navDrag.pointerId); } catch (_) { /* capture may already have ended */ }
        }
        navDrag = null;
        navSvg.onpointerdown = navSvg.onpointermove = navSvg.onpointerup = navSvg.onpointercancel = navSvg.onkeydown = null;
        clearInterval(freshTimer);
        clearTimeout(tipTimer);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onDocKeydown);
      },
      state() {
        return { branches: [...selectedBranches], search: searchInput.value, filter, npuFilter, showAll, unknownTime, start: viewStart, end: viewEnd };
      },
      footerText,
      syncUrl,
      matchesRoute,
    };
    mounted = { payload: D, container };
  }

  const syncActiveUrl = () => { if (active && active.syncUrl) active.syncUrl(); };
  return { render, deactivate, setDetailBatch: id => { detailBatchId = id == null ? null : String(id); syncActiveUrl(); }, clearDetailBatch: () => { detailBatchId = null; syncActiveUrl(); } };
});
