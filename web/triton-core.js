/* REQ-017: a valid duration is a finite, non-negative raw number. Missing,
   null, empty strings, numeric strings, NaN, infinities and negatives are
   never coerced into an implicit 0. Top-level so both module blocks below
   share this one definition. */
const validDuration = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
// E2E identity and measurement qualification are independent of NPU evidence.
// Explicitly unresolved old records must also be excluded; old records without
// identity/qualification fields retain the established numerical rules.
const e2eIdentityKnown = row => !(row && Object.prototype.hasOwnProperty.call(row, 'pr') && row.pr == null)
  && !(row && row.e2e_sample_eligible === false);
/* EC-005: E2E and NPU sample qualification are independent. E2E requires a
   known PR identity and a finite non-negative E2E duration; NPU requires the
   NPU evidence itself (npu_queue_seconds) and must not be erased just because
   the E2E duration is missing. */
const sampleEligible = (row, metric = 'e2e') => !!row
  && (row.status === 'success' || row.status === 'failure')
  && (metric === 'npu'
    ? (!row.npu_data_missing && validDuration(row.npu_queue_seconds))
    : (e2eIdentityKnown(row) && validDuration(row.duration_seconds)));

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function selectWindow(rows, start, end) {
    return rows.filter(row => {
      const stamp = +new Date(row.start_at);
      return stamp >= start && stamp <= end;
    });
  }

  function windowForHours(domainStart, domainEnd, hours) {
    return [Math.max(domainStart, domainEnd - hours * 3600000), domainEnd];
  }

  function moveWindow(domainStart, domainEnd, start, end, delta) {
    const span = end - start;
    let nextStart = start + delta;
    let nextEnd = end + delta;
    if (nextStart < domainStart) return [domainStart, domainStart + span];
    if (nextEnd > domainEnd) return [domainEnd - span, domainEnd];
    return [nextStart, nextEnd];
  }

  /* TA-002: anti-collision layout must never silently replace the data-driven
     anchor. layoutPoints keeps the true (x, y) position as `anchor` and reports
     the visually spread `dot` plus an `offset` flag; a leader line can then be
     drawn from the anchor so the spread position is never mistaken for the
     measured value. The spread algorithm only resolves collisions — it does not
     change statistics, tooltips, details or CSV values. */
  function layoutPoints(points, threshold, bounds) {
    const placed = [];
    return points.map(point => {
      let candidate = { x: point.x, y: point.y }, step = 0;
      while (placed.some(p => Math.hypot(p.x - candidate.x, p.y - candidate.y) < threshold) && step < 80) {
        step += 1;
        const radius = threshold * .55 * Math.sqrt(step);
        const angle = step * 2.399963229728653;
        candidate = { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
        if (bounds) candidate = {
          x: Math.max(bounds.minX, Math.min(bounds.maxX, candidate.x)),
          y: Math.max(bounds.minY, Math.min(bounds.maxY, candidate.y)),
        };
      }
      placed.push(candidate);
      return { anchor: { x: point.x, y: point.y }, dot: candidate, offset: candidate.x !== point.x || candidate.y !== point.y };
    });
  }

  /* Backward-compatible alias: callers that only need the spread dot positions
     still get the collision-resolved dots (never the true anchors). */
  function spreadPoints(points, threshold, bounds) {
    return layoutPoints(points, threshold, bounds).map(point => point.dot);
  }

  /* TA-001: the left margin must leave room for the complete y-axis labels.
     A label is right-anchored at (marginLeft - anchorOffset); its left edge sits
     at marginLeft - anchorOffset - width, so the margin grows until that edge
     stays >= pad inside the SVG. */
  function yAxisMarginLeft(labels, opts) {
    const o = opts || {};
    const charWidth = o.charWidth != null ? o.charWidth : 7;
    const anchorOffset = o.anchorOffset != null ? o.anchorOffset : 8;
    const pad = o.pad != null ? o.pad : 6;
    const min = o.min != null ? o.min : 50;
    const longest = Math.max(0, ...(labels || []).map(s => String(s).length * charWidth));
    return Math.max(min, longest + anchorOffset + pad);
  }

  /* TA-011: the navigator's pointer→time reverse mapping must use the same
     inset padding as the drawing transform (drawNavigator maps the domain onto
     [padding.l, width - padding.r], not the whole rect). */
  function navTimeAt(clientX, rectLeft, rectWidth, domainStart, domainEnd, inset) {
    const p = inset || { l: 4, r: 4 };
    const plotW = rectWidth - p.l - p.r;
    if (!Number.isFinite(plotW) || plotW <= 0) return domainStart;
    const x = Math.max(p.l, Math.min(rectWidth - p.r, clientX - rectLeft));
    return domainStart + (x - p.l) / plotW * (domainEnd - domainStart);
  }

  function percentile(values, q) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * q;
    const lower = Math.floor(position), upper = Math.ceil(position);
    return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  /* REQ-017: chart/summary statistics count only valid durations. EC-005: the
     NPU chart reads the NPU value (npu_queue_seconds), never the E2E duration. */
  function chartStats(rows, metric = 'e2e') {
    const valueOf = row => metric === 'npu' ? row.npu_queue_seconds : row.duration_seconds;
    const observed = rows.map(valueOf).filter(validDuration);
    const completed = rows.filter(row => sampleEligible(row, metric)).map(valueOf);
    return {
      max: observed.length ? Math.max(...observed) : 300,
      p90: percentile(completed, 0.9),
      p50: percentile(completed, 0.5),
      average: completed.length ? completed.reduce((sum, value) => sum + value, 0) / completed.length : null,
      count: completed.length,
    };
  }

  function filterBranches(rows, selected) {
    return selected && selected.size ? rows.filter(row => selected.has(row.base_branch)) : rows.slice();
  }

  function dashboardStats(rows) {
    const completed = rows.filter(row => sampleEligible(row));
    const values = completed.map(row => row.duration_seconds);
    return {
      prs: new Set(rows.map(row => row.pr).filter(Boolean)).size,
      batches: rows.length,
      valid: completed.length,
      median: percentile(values, .5),
      p90: percentile(values, .9),
      incomplete: rows.filter(row => row.missing && row.missing.length).length,
      approximate: rows.filter(row => row.approximate).length,
    };
  }

  /* REQ-014: one start-source label shared by hover card, batch detail and CSV. */
  const START_SOURCE_LABELS = { trigger_event: '触发事件', first_job_created: '本 attempt 首个 job 创建（前置排队未知）', attempt_start: '本次重跑开始', workflow_created: '最早 workflow 创建' };
  function startSourceLabel(batch) {
    if (!batch || !batch.start_source) return '无起点证据';
    const base = START_SOURCE_LABELS[batch.start_source] || batch.start_source;
    return batch.approximate ? base + '，近似' : base;
  }

  /* REQ-029: stable identity label for a chart mark so keyboard users can
     locate a batch before opening its pinned detail card. */
  function markLabel(batch, kind) {
    if (batch && batch.pr == null) {
      const workflow = (batch.workflows || [])[0] || {};
      return (kind === 'npu' ? 'NPU 排队详情：' : '观测详情：') + '未关联 PR · Run #' + (workflow.id || batch.id || '?')
        + ' · attempt ' + (workflow.attempt || 1) + ' · ' + String(batch.sha || '未知').slice(0, 7);
    }
    const pr = batch && batch.pr != null ? batch.pr : '?';
    const attempt = `第 ${(batch && batch.e2e_index) || 1}/${(batch && batch.e2e_total) || 1} 次 E2E`;
    const sha = String((batch && batch.sha) || '未知').slice(0, 7);
    return (kind === 'npu' ? 'NPU 排队详情：PR #' : 'E2E 详情：PR #') + pr + ' ' + attempt + ' ' + sha;
  }

  function circleMark(batch, cx, cy, index, color, kind, anchor) {
    /* TS28-005 AC1: every point uses the same 3.5 CSS px radius so the same-PR
       highlight (7 px) is measured against one documented base size. */
    const radius = 3.5;
    const ax = anchor ? ` data-anchor-x="${anchor.x}" data-anchor-y="${anchor.y}"` : ` data-anchor-x="${cx}" data-anchor-y="${cy}"`;
    return `<g class="mark-hit" data-i="${index}" data-kind="${kind || 'e2e'}" data-x="${cx}" data-y="${cy}"${ax} role="button" tabindex="0" aria-label="${markLabel(batch, kind)}" transform="translate(${cx} ${cy})"><circle class="hit-area" r="8"/><circle class="dot" r="${radius}" fill="${color}"/></g>`;
  }

  function normalizeE2ePayload(payload) {
    if (payload.e2e_metric_version === 2) return payload;
    return { ...payload, e2e_metric_version: 2,
      e2e_metric_notice: '旧口径数据尚未重新采集，Integration Tests E2E 暂不可用；NPU 数据独立保留。',
      batches: payload.batches.map(b => ({ ...b, legacy_observed_seconds: b.duration_seconds,
        duration_seconds: null, e2e_sample_eligible: false, e2e_exclusion_reason: 'legacy_metric_unverified' })) };
  }

  function prHistory(rows, selected) {
    const peers = selected.pr == null ? [selected] : rows.filter(b => b.pr === selected.pr &&
      (b.id === selected.id || b.action_name === 'Integration Tests' || (b.workflows || []).some(w => w.name === 'Integration Tests')));
    const groups = new Map();
    peers.slice().sort((a, b) => (+new Date(a.start_at) || 0) - (+new Date(b.start_at) || 0) || String(a.id).localeCompare(String(b.id))).forEach(b => {
      const key = b.sha || b.id;
      if (!groups.has(key)) groups.set(key, { sha: b.sha, rows: [] });
      groups.get(key).rows.push(b);
    });
    return [...groups.values()];
  }

  function overlapIndices(points, x, y) {
    return points.filter(p => Math.hypot(p.x - x, p.y - y) < 8).map(p => p.i);
  }

  return { normalizeE2ePayload, prHistory, overlapIndices, selectWindow, windowForHours, moveWindow, spreadPoints, layoutPoints, yAxisMarginLeft, navTimeAt, chartStats, filterBranches, dashboardStats, circleMark, markLabel, validDuration, sampleEligible, e2eIdentityKnown, startSourceLabel };
});

/* ---- T8 additions (appended; the prefix above is the original module plus
   REQ-017's validity filter, whose shared predicate is defined once at the
   top of this file). Merges the pure helpers of the standalone Triton
   dashboard into the shared core so the merged view and Node tests share one
   implementation. ---- */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) Object.assign(module.exports, api);
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function isSlow(batch, p90) {
    return e2eIdentityKnown(batch) && validDuration(batch && batch.duration_seconds) && p90 != null && batch.status !== 'running' && batch.duration_seconds >= p90;
  }

  /* REQ-026: the strategy (P90 slow group vs top-5 longest), the threshold
     and the group labels are decided from G — the rows passed in — and its
     valid completed-sample count before any search filtering; the query only
     narrows the rows shown inside each already-decided group. */
  function attentionGroups(rows, p90, query) {
    const list = Array.isArray(rows) ? rows : [];
    const completed = list.filter(row => sampleEligible(row));
    const valid = completed.filter(row => validDuration(row.duration_seconds)).length;
    let slow = list.filter(row => isSlow(row, p90))
      .sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0));
    if (valid < 10) {
      slow = completed.filter(row => validDuration(row.duration_seconds)).slice()
        .sort((a, b) => b.duration_seconds - a.duration_seconds)
        .slice(0, 5);
    }
    const running = list.filter(row => row.status === 'running')
      .sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0));
    const failure = list.filter(row => row.status === 'failure')
      .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
    const searched = row => matchesQuery(row, query);
    return [
      { key: 'slow', label: valid < 10 ? '耗时最长' : '耗时偏长', rows: slow.filter(searched) },
      { key: 'running', label: '执行中', rows: running.filter(searched) },
      { key: 'failure', label: '失败', rows: failure.filter(searched) },
    ];
  }

  /* REQ-026: the note names the same G sample denominator that picks the
     strategy and states that the three groups may overlap. */
  function attentionNote(valid) {
    const n = Number.isFinite(valid) ? valid : 0;
    return n < 10
      ? '有效完成样本少于 10 个（页级范围 ' + n + ' 个），展示耗时最长批次；理由计数可重叠，列表按稳定批次去重、每批次一行多标签。'
      : '优先显示超过 P90（按页级范围 ' + n + ' 个有效完成样本计算）、执行中和失败的批次；理由计数可重叠，列表按稳定批次去重、每批次一行多标签。';
  }

  /* REQ-028: stable DOM ids for one batch row. The attention groups may
     list the same batch in more than one group (failure ∩ slow), so ids
     carry the group key to keep aria-controls and focus restoration
     unambiguous when a batch appears twice. */
  function rowDomIds(batchId, groupKey) {
    const suffix = String(groupKey) + '-' + String(batchId);
    return { rowId: 'triton-batch-' + suffix, detailId: 'triton-detail-' + suffix };
  }

  /* REQ-027: the time-window constraints shared by pointer, touch and
     keyboard adjustments: stay inside the collection window and keep at
     least a 30-minute selection — or the whole window when the domain
     itself is shorter. */
  function minWindowSpan(domainStart, domainEnd) {
    return Math.min(30 * 60000, Math.max(0, domainEnd - domainStart));
  }

  function clampBoundary(domainStart, domainEnd, viewStart, viewEnd, side, value) {
    const minSpan = minWindowSpan(domainStart, domainEnd);
    if (side === 'start') return Math.max(domainStart, Math.min(value, viewEnd - minSpan));
    return Math.min(domainEnd, Math.max(value, viewStart + minSpan));
  }

  /* REQ-027: maps a keyboard action ("<mode>-<direction>") to the next
     selection. The step is a fraction of the current span so small windows
     fine-tune while large ones traverse quickly; Home/End reach the allowed
     edges. Pan and boundary actions apply the same constraints as pointer
     dragging (verified equivalent against moveWindow/clampBoundary by the
     Node tests). */
  function keyWindow(action, domainStart, domainEnd, viewStart, viewEnd) {
    const span = viewEnd - viewStart;
    const minSpan = minWindowSpan(domainStart, domainEnd);
    const step = Math.max(minSpan, span / 10);
    const whole = Math.min(span, domainEnd - domainStart);
    const clampStart = value => clampBoundary(domainStart, domainEnd, viewStart, viewEnd, 'start', value);
    const clampEnd = value => clampBoundary(domainStart, domainEnd, viewStart, viewEnd, 'end', value);
    const pan = delta => {
      const target = Math.max(domainStart, Math.min(domainEnd - span, viewStart + delta));
      return [target, target + span];
    };
    switch (action) {
      case 'window-left': return pan(-step);
      case 'window-right': return pan(step);
      case 'window-home': return [domainStart, domainStart + whole];
      case 'window-end': return [domainEnd - whole, domainEnd];
      case 'start-left': return [clampStart(viewStart - step), viewEnd];
      case 'start-right': return [clampStart(viewStart + step), viewEnd];
      case 'start-home': return [domainStart, viewEnd];
      case 'start-end': return [clampStart(viewEnd - minSpan), viewEnd];
      case 'end-left': return [viewStart, clampEnd(viewEnd - step)];
      case 'end-right': return [viewStart, clampEnd(viewEnd + step)];
      case 'end-home': return [viewStart, clampEnd(viewStart + minSpan)];
      case 'end-end': return [viewStart, domainEnd];
      default: return [viewStart, viewEnd];
    }
  }

  /* REQ-027: slider value semantics for the three navigator controls. The
     whole-window slider reports the window center over the domain; each
     boundary slider reports its edge position within its own allowed range
     (the other edge minus the minimum span). */
  function navSliderSemantics(domainStart, domainEnd, viewStart, viewEnd) {
    const minSpan = minWindowSpan(domainStart, domainEnd);
    return {
      window: { min: domainStart, max: domainEnd, now: Math.round((viewStart + viewEnd) / 2) },
      start: { min: domainStart, max: viewEnd - minSpan, now: viewStart },
      end: { min: viewStart + minSpan, max: domainEnd, now: viewEnd },
    };
  }

  function freshnessSlots(now, collectedAt) {
    const t = +new Date(now);
    const collected = collectedAt == null ? null : +new Date(collectedAt);
    const bj = new Date(t + 8 * 3600000);
    const day = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
    const slots = [-4, 8, 12, 16, 18, 20]
      .map(hours => day + (hours - 8) * 3600000)
      .filter(slot => slot + 90 * 60000 <= t);
    const latest = slots.length ? Math.max(...slots) : null;
    const stale = latest != null && collected != null && collected < latest;
    return { slots, latest, stale };
  }

  function matchesQuery(batch, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    return String(batch.pr || '').includes(q) || String(batch.title || '').toLowerCase().includes(q);
  }

  function sameSessionMount(mounted, payload, container) {
    if (!mounted || mounted.payload !== payload || mounted.container !== container) return false;
    return !!(container && container.isConnected && container.children && container.children.length);
  }

  /* REQ-006：新采集窗口下的选区恢复。m = min(30 分钟, 新窗长 W)：原选区与新窗交集
     达到 m 时取交集（完全覆盖则原样保留），否则恢复新窗末尾长度
     L = min(W, max(原选区长, m)) 的窗口；返回 null 表示新窗口本身非法。 */
  function recoverWindow(oldStart, oldEnd, newStart, newEnd) {
    const MIN_MS = 30 * 60 * 1000;
    if (![newStart, newEnd].every(Number.isFinite) || newEnd <= newStart) return null;
    const W = newEnd - newStart;
    const m = Math.min(MIN_MS, W);
    if (![oldStart, oldEnd].every(Number.isFinite) || oldEnd <= oldStart) {
      return { start: newStart, end: newEnd, adjusted: false, reason: null };
    }
    const span = oldEnd - oldStart;
    const is = Math.max(oldStart, newStart);
    const ie = Math.min(oldEnd, newEnd);
    if (ie - is >= m) {
      const unchanged = is === oldStart && ie === oldEnd;
      return { start: is, end: ie, adjusted: !unchanged, reason: unchanged ? null : '原选区已按新采集窗口裁剪为交集' };
    }
    const L = Math.min(W, Math.max(span, m));
    return { start: newEnd - L, end: newEnd, adjusted: true, reason: '原选区与新采集窗口无有效交集，已恢复为新窗口末尾选区' };
  }

  /* REQ-029 AC02: pure placement for the pinned detail card. The cascade
     clamps into the viewport, then flips above, then left of the anchor
     box (a focusable 16×16 mark) whenever clamping alone would pull the
     card back over it; the .tooltip CSS cap calc(50vh - 24px) keeps a
     vertical escape band open in every viewport (2h + 40 <= vh), so the
     above-flip always terminates the cascade in production. */
  function placeTipBox(ax, ay, width, height, vw, vh, markW, markH) {
    const pad = 12, gap = 14;
    const bx = ax - markW / 2, by = ay - markH / 2;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    const covers = (px, py) => px < bx + markW && px + width > bx && py < by + markH && py + height > by;
    let px = clamp(ax + gap, pad, Math.max(pad, vw - width - pad));
    let py = clamp(ay + gap, pad, Math.max(pad, vh - height - pad));
    if (covers(px, py)) py = clamp(by - height - gap, pad, Math.max(pad, vh - height - pad));
    if (covers(px, py)) px = clamp(bx - width - gap, pad, Math.max(pad, vw - width - pad));
    return { x: px, y: py };
  }

  /* REQ-031 AC01/AC02: the x-axis label count adapts to the real plot width.
     The window endpoints are always ticks and the rest divide the span
     evenly, so thinning labels only removes labels — it never moves marks
     or changes any statistic. */
  function axisTicks(start, end, plotWidth, labelWidth, gap = 10, maxTicks = 7) {
    const from = +new Date(start), to = +new Date(end);
    const span = Math.max(to - from, 1);
    const width = Number.isFinite(plotWidth) ? plotWidth : 0;
    const fit = Math.floor((width + gap) / (labelWidth + gap));
    const count = Math.min(maxTicks, Math.max(2, fit));
    const ticks = [];
    for (let i = 0; i < count; i++) ticks.push(from + (i * span) / (count - 1));
    return ticks;
  }

  /* REQ-033 AC01: 顶栏分支徽标文本——空选择=全部目标分支；单选=分支名；多选=数量并在 title 列出所选分支。 */
  function branchBadgeText(branches) {
    if (!branches.length) return { text: '全部目标分支' };
    if (branches.length === 1) return { text: branches[0] };
    const sorted = [...branches].sort();
    return { text: `已选 ${branches.length} 个分支`, title: sorted.join('、') };
  }

  return { isSlow, attentionGroups, attentionNote, rowDomIds, minWindowSpan, clampBoundary, keyWindow, navSliderSemantics, freshnessSlots, matchesQuery, sameSessionMount, recoverWindow, placeTipBox, axisTicks, branchBadgeText };
});

/* ---- TS28 additions: read-only hover/association/timing adapter plus the
   same-PR visible group helper. All functions are pure and Node-testable; the
   view only formats and escapes the returned model. Evidence rules follow
   section 4.3: without a trigger-chain field the reliable set is exactly the
   current run/attempt, and same-PR/SHA runs stay in a separate
   same_commit_unproven bucket that never feeds E2E or the charts. ---- */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) Object.assign(module.exports, api);
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FAILURE_RESULTS = ['failure', 'timed_out', 'action_required', 'startup_failure'];
  const RUNNING_RESULTS = ['queued', 'waiting', 'pending', 'requested', 'in_progress', 'running'];
  const CANCELLED_RESULTS = ['cancelled', 'canceled', 'stale'];
  const FOCUS_ORDER = ['a3-py310', 'a3-py311', 'a5-py312'];
  const FOCUS_LABELS = { 'a3-py310': 'A3 · py3.10', 'a3-py311': 'A3 · py3.11', 'a5-py312': 'A5 · py3.12' };
  const EXCLUSION_LABELS = {
    unresolved_pr_batch_identity: 'PR 与提交批次身份未确认',
    outside_integration_tests: '辅助检查，不计入 Integration Tests E2E',
    rerun_queue_start_unknown: '重跑前置排队起点未知，仅观测',
    legacy_metric_unverified: '旧口径未重新采集',
    running_observation: '执行中观测',
    non_sample_result: '当前结果不属完成样本',
    invalid_or_missing_duration: '时长证据无效或缺失',
  };

  function stampOf(value) {
    if (value == null || value === '') return null;
    const value2 = +new Date(value);
    return Number.isFinite(value2) ? value2 : null;
  }

  function finiteSeconds(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }

  function normalizeResult(value) {
    const text = String(value == null ? '' : value).toLowerCase();
    if (text === 'success') return 'success';
    if (FAILURE_RESULTS.includes(text)) return 'failure';
    if (CANCELLED_RESULTS.includes(text)) return 'cancelled';
    if (RUNNING_RESULTS.includes(text)) return 'running';
    if (text === 'skipped' || text === 'neutral') return 'skipped';
    return 'unknown';
  }

  /* The scatter color follows this run/attempt's own normalized result; a
     completed run with no conclusion is unknown, never a default success. */
  function recordResult(record) {
    if (!record) return 'unknown';
    if (record.conclusion != null && record.conclusion !== '') return normalizeResult(record.conclusion);
    const status = String(record.status == null ? '' : record.status).toLowerCase();
    if (status === 'completed') return 'unknown';
    return normalizeResult(status);
  }

  /* AC2/AC5: only http(s) links may render as actionable anchors. */
  function safeLink(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text) return null;
    try {
      const parsed = new URL(text, 'https://example.invalid');
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? text : null;
    } catch (error) {
      return null;
    }
  }

  function deltaSeconds(later, earlier) {
    return later != null && earlier != null ? (later - earlier) / 1000 : null;
  }

  /* US28-003 AC4: zero and decimals are preserved; an inverted pair is
     explained and stays null instead of being clamped to a fake zero. The
     observed value for a running/queued job is labelled "as of collection"
     and never joins a completed duration. */
  function jobTiming(job, asOf) {
    const source = job || {};
    const created = stampOf(source.created_at);
    const started = stampOf(source.started_at);
    const ended = stampOf(source.completed_at);
    const asOfMs = stampOf(asOf);
    const skipped = String(source.conclusion || '').toLowerCase() === 'skipped';
    const anomalies = [];
    let wait = null, run = null, observed = null;
    let waitKind = null, runKind = null, observedKind = null;
    if (started != null && created != null) {
      if (started >= created) { wait = deltaSeconds(started, created); waitKind = 'job_created_to_started'; }
      else anomalies.push('源时间戳异常：开始早于创建，排队不适用');
    } else if (finiteSeconds(source.wait_seconds) != null) {
      wait = finiteSeconds(source.wait_seconds); waitKind = 'source_provided';
    }
    if (started != null && ended != null) {
      if (ended >= started) { run = deltaSeconds(ended, started); runKind = 'job_started_to_completed'; }
      else anomalies.push('源时间戳异常：结束早于开始，执行不适用');
    } else if (finiteSeconds(source.run_seconds) != null) {
      run = finiteSeconds(source.run_seconds); runKind = 'source_provided';
    }
    if (source.run_inverted === true) { run = null; runKind = null; }
    if (source.wait_inverted === true) { wait = null; waitKind = null; }
    if (String(source.status || '').toLowerCase() !== 'completed') {
      run = null; runKind = null;
      if (started != null && asOfMs != null && asOfMs >= started) {
        observed = deltaSeconds(asOfMs, started); observedKind = 'run_observed_until_as_of';
      } else if (created != null && asOfMs != null && asOfMs >= created) {
        observed = deltaSeconds(asOfMs, created); observedKind = 'queue_observed_until_as_of';
      }
    }
    return {
      waitSeconds: skipped ? null : wait,
      runSeconds: skipped ? null : run,
      observedSeconds: skipped ? null : observed,
      waitKind, runKind, observedKind,
      anomaly: anomalies.length ? anomalies.join('；') : (source.measurement_error || null),
      applicable: !skipped,
      skipped,
      failedSteps: Array.isArray(source.failed_steps) ? source.failed_steps.slice() : [],
    };
  }

  function workflowJobsTiming(workflow, asOf) {
    return (workflow && Array.isArray(workflow.jobs) ? workflow.jobs : [])
      .map(job => ({ job, timing: jobTiming(job, asOf) }));
  }

  /* TS28-002 AC1: derived timing fields are read from the payload when the
     collector supplied them; older snapshots without them are derived from
     the retained job timestamps and every absence carries a reason. */
  function workflowTiming(workflow, asOf) {
    const source = workflow || {};
    const hasContract = Object.prototype.hasOwnProperty.call(source, 'first_job_wait_seconds');
    const jobs = Array.isArray(source.jobs) ? source.jobs.filter(j => j && j.conclusion !== 'skipped') : [];
    const attempt = Number(source.attempt || 1);
    let wait = finiteSeconds(source.first_job_wait_seconds);
    let span = finiteSeconds(source.execution_span_seconds);
    let origin = source.attempt_origin || null;
    let originSource = source.attempt_origin_source || null;
    let missing = source.timing_missing_reason || (source.timing_anomaly ? source.timing_anomaly : null);
    if (!hasContract) {
      const created = stampOf(source.created_at);
      const starts = jobs.map(j => stampOf(j.started_at)).filter(v => v != null);
      const ends = jobs.map(j => stampOf(j.completed_at)).filter(v => v != null);
      const jobCreated = jobs.map(j => stampOf(j.created_at)).filter(v => v != null);
      if (attempt === 1 && created != null) { origin = source.created_at; originSource = 'workflow_created'; }
      else if (attempt > 1 && source.attempt_source === 'enumerated' && jobCreated.length) {
        origin = new Date(Math.min(...jobCreated)).toISOString(); originSource = 'first_job_created';
      }
      const originMs = stampOf(origin);
      wait = originMs != null && starts.length && Math.min(...starts) >= originMs ? deltaSeconds(Math.min(...starts), originMs) : null;
      const complete = source.jobs_complete !== false && jobs.length
        && jobs.every(j => j.status === 'completed' && stampOf(j.started_at) != null && stampOf(j.completed_at) != null
          && +new Date(j.completed_at) >= +new Date(j.started_at));
      span = complete && starts.length && ends.length && Math.max(...ends) >= Math.min(...starts)
        ? deltaSeconds(Math.max(...ends), Math.min(...starts)) : null;
      if (!jobs.length) missing = '无有效 job 明细（可能被跳过或未获取）';
      else if (source.jobs_complete === false) missing = 'job 分页不完整，执行跨度不适用';
      else if (attempt > 1 && originMs == null) missing = '重跑前置排队起点未知，首任务等待留空';
      else if (wait == null) missing = '缺少首任务开始时间或 attempt 起点';
      else if (span == null) missing = 'job 尚未全部完成，执行跨度仅截至采集观测';
    }
    return {
      firstJobWaitSeconds: wait,
      executionSpanSeconds: span,
      originAt: origin,
      originSource,
      jobsComplete: source.jobs_complete !== false,
      complete: span != null,
      missingReason: missing || null,
      anomaly: source.timing_anomaly || null,
    };
  }

  function isIntegrationTestsRecord(batch) {
    if (!batch) return false;
    if (typeof batch.is_integration_tests === 'boolean') return batch.is_integration_tests;
    if (batch.e2e_exclusion_reason === 'outside_integration_tests') return false;
    return true;
  }

  function runIdentity(batch) {
    const workflow = (batch && batch.workflows && batch.workflows[0]) || {};
    return { runId: workflow.id != null ? workflow.id : batch && batch.id, attempt: Number(workflow.attempt || 1) };
  }

  function workflowMembers(batch, asOf) {
    return (batch && Array.isArray(batch.workflows) ? batch.workflows : []).map(workflow => {
      const attempt = Number(workflow.attempt || 1);
      return {
        runId: workflow.id,
        attempt,
        name: workflow.name || '未命名 workflow',
        path: workflow.path || null,
        status: workflow.status || null,
        result: recordResult(workflow),
        createdAt: workflow.created_at || null,
        url: safeLink(workflow.url),
        jobsComplete: workflow.jobs_complete !== false,
        relationship: 'current_run',
        evidence: 'run_id+attempt 身份（当前快照）',
        time: workflowTiming(workflow, asOf),
        jobs: workflowJobsTiming(workflow, asOf).map(({ job, timing }) => ({
          id: job.id,
          name: job.name || '未命名任务',
          status: job.status || null,
          result: recordResult(job),
          url: safeLink(job.url),
          timing,
        })),
      };
    });
  }

  function parseFocusName(name) {
    const text = String(name || '');
    const chip = /linux-(aarch64|amd64)-(a[35])(?:[-\s,)]|$)/i.exec(text);
    const python = /(?:^|[^a-z0-9])py(3\.\d+)/i.exec(text);
    if (!chip || !python) return null;
    return { arch: chip[1].toLowerCase(), chip: chip[2].toLowerCase(), python: python[1] };
  }

  function focusKey(info) {
    return info.chip + '-py' + info.python.replace('.', '');
  }

  /* TS28-003: collect every A3/A5 matrix job actually present in the reliable
     set (not only the default three), dedupe by repo/run/attempt/job_id and
     never borrow a row from another workflow/partition. */
  function focusJobs(batch) {
    const asOf = null;
    const rows = [];
    const seen = new Set();
    const seenJobIds = new Set();
    const skippedKeys = new Set();
    const workflowJobs = [];
    for (const workflow of (batch && batch.workflows) || []) {
      for (const job of workflow.jobs || []) {
        workflowJobs.push({ workflow, job });
        const info = parseFocusName(job.name);
        if (!info) continue;
        const key = focusKey(info);
        if (job.conclusion === 'skipped') { skippedKeys.add(key); continue; }
        const identity = [workflow.id, workflow.attempt || 1, job.id != null ? job.id : job.url].join('/');
        if (seen.has(identity)) continue;
        if (job.id != null && seenJobIds.has(String(job.id))) continue;
        seen.add(identity);
        if (job.id != null) seenJobIds.add(String(job.id));
        rows.push({
          key, arch: info.arch, python: info.python,
          name: job.name || '未命名任务',
          runId: workflow.id, attempt: Number(workflow.attempt || 1), jobId: job.id,
          status: job.status || null, result: recordResult(job),
          url: safeLink(job.url),
          timing: jobTiming(job, asOf),
        });
      }
    }
    for (const job of (batch && batch.focus_jobs) || []) {
      const info = parseFocusName(job.name) || { chip: String(job.key || '').split('-')[0], python: null };
      const key = job.key || (info.python ? focusKey(info) : null);
      if (!key) continue;
      const identity = [job.run_id || 'focus', job.attempt || 1, job.id != null ? job.id : job.url].join('/');
      if (seen.has(identity)) continue;
      if (job.id != null && seenJobIds.has(String(job.id))) continue;
      seen.add(identity);
      if (job.id != null) seenJobIds.add(String(job.id));
      if (job.conclusion === 'skipped') { skippedKeys.add(key); continue; }
      rows.push({
        key, arch: info.arch || (/amd64/.test(String(job.name)) ? 'amd64' : 'aarch64'), python: info.python,
        name: job.name || '未命名任务', runId: job.run_id != null ? job.run_id : null,
        attempt: Number(job.attempt || 1), jobId: job.id, status: job.status || null,
        result: recordResult(job), url: safeLink(job.url), timing: jobTiming(job, asOf),
      });
    }
    const order = row => {
      const preferred = FOCUS_ORDER.indexOf(row.key);
      return preferred < 0 ? FOCUS_ORDER.length + 1 : preferred;
    };
    rows.sort((a, b) => order(a) - order(b) || String(a.key).localeCompare(String(b.key))
      || String(a.name).localeCompare(String(b.name)));
    const missing = FOCUS_ORDER.filter(key => !rows.some(row => row.key === key)).map(key => ({
      key,
      label: FOCUS_LABELS[key],
      reason: !isIntegrationTestsRecord(batch) ? '本记录非 Integration Tests，E2E 不适用'
        : skippedKeys.has(key) ? '已跳过（未触发）'
        : (batch.workflows || []).some(w => w.jobs_complete === false) ? '明细采集失败'
        : '没有找到匹配任务',
    }));
    return {
      rows,
      missing,
      labels: FOCUS_LABELS,
      available: rows.length > 0,
      note: rows.length ? null
        : !isIntegrationTestsRecord(batch) ? '本记录非 Integration Tests，E2E 不适用'
        : (batch.workflows || []).some(w => w.jobs_complete === false) ? 'job 明细采集失败，重点任务无法判断'
        : '本次可靠集合中没有找到 A3/A5 矩阵任务',
    };
  }

  /* TS28-002 AC2 / section 4.3: index the whole snapshot by verified PR + full
     SHA. Same-PR/SHA runs are candidates only; they are always excluded from
     E2E and never alter a point's duration. */
  function relatedIndex(batches) {
    const index = new Map();
    for (const batch of batches || []) {
      if (!batch || batch.pr == null || !batch.sha) continue;
      const key = String(batch.pr) + '|' + String(batch.sha).toLowerCase();
      if (!index.has(key)) index.set(key, []);
      for (const workflow of batch.workflows || []) {
        index.get(key).push({ batch, workflow });
      }
      if (!(batch.workflows || []).length) index.get(key).push({ batch, workflow: {} });
    }
    return index;
  }

  function sameCommitRuns(batch, source) {
    if (!batch || batch.pr == null || !batch.sha) return [];
    const key = String(batch.pr) + '|' + String(batch.sha).toLowerCase();
    const own = new Set((batch.workflows || []).map(w => String(w.id) + '/' + Number(w.attempt || 1)));
    if (!own.size) {
      const identity = runIdentity(batch);
      own.add(String(identity.runId) + '/' + identity.attempt);
    }
    const candidates = source instanceof Map
      ? (source.get(key) || [])
      : (source || []).flatMap(other => {
        if (!other || other.pr !== batch.pr || String(other.sha || '').toLowerCase() !== String(batch.sha).toLowerCase()) return [];
        const list = (other.workflows || []).map(workflow => ({ batch: other, workflow }));
        return list.length ? list : [{ batch: other, workflow: {} }];
      });
    const seen = new Set();
    const rows = [];
    for (const candidate of candidates) {
      const other = candidate.batch;
      if (!other || other === batch) continue;
      const workflow = candidate.workflow || {};
      const identity = String(workflow.id != null ? workflow.id : other.id) + '/' + Number(workflow.attempt || 1);
      if (own.has(identity) || String(other.id) === String(batch.id) && !(other.workflows || []).length) continue;
      if (seen.has(identity)) continue;
      seen.add(identity);
      rows.push({
        batchId: other.id,
        runId: workflow.id != null ? workflow.id : other.id,
        attempt: Number(workflow.attempt || 1),
        workflowName: workflow.name || other.critical_workflow || other.action_name || '未命名 workflow',
        status: workflow.status || other.status || null,
        result: recordResult(workflow.conclusion ? workflow : other),
        startAt: other.start_at || workflow.created_at || null,
        durationSeconds: finiteSeconds(other.duration_seconds),
        url: safeLink(workflow.url || other.action_url),
        relationship: 'same_commit_unproven',
        excludedFromE2e: true,
      });
    }
    rows.sort((a, b) => (stampOf(a.startAt) || 0) - (stampOf(b.startAt) || 0) || String(a.runId).localeCompare(String(b.runId)));
    return rows;
  }

  function npuJobRows(batch, asOf) {
    return ((batch && batch.npu_jobs) || []).map(job => ({
      id: job.id,
      name: job.name || '未命名任务',
      status: job.status || null,
      result: recordResult(job),
      url: safeLink(job.url || (batch && batch.action_url)),
      timing: jobTiming(job, asOf),
    }));
  }

  function visiblePrCount(batches, pr) {
    if (pr == null) return 0;
    return new Set((batches || []).filter(b => b && b.pr === pr).map(b => b.id)).size;
  }

  /* Build the complete, escaped-by-the-caller hover model for either chart. */
  function hoverModel(batch, options) {
    const opts = options || {};
    const metric = opts.metric === 'npu' ? 'npu' : 'e2e';
    const asOf = opts.collectedAt || opts.windowEnd || null;
    const workflows = (batch && batch.workflows) || [];
    const identity = runIdentity(batch);
    const npuRowsData = npuJobRows(batch, asOf);
    const waits = npuRowsData.map(row => row.timing.waitSeconds).filter(value => value != null);
    const declaredQueue = finiteSeconds(batch && batch.npu_queue_seconds);
    const npuQueueSeconds = declaredQueue != null ? declaredQueue : (waits.length ? Math.max(...waits) : null);
    const integration = isIntegrationTestsRecord(batch);
    const focus = focusJobs(batch);
    const related = sameCommitRuns(batch, opts.index || opts.batches || []);
    const workflowUrls = workflows.map(w => safeLink(w.url)).filter(Boolean);
    const actions = safeLink(batch && batch.action_url) || workflowUrls[0] || null;
    const prUrl = safeLink(batch && batch.pr_url);
    const duration = finiteSeconds(batch && batch.duration_seconds);
    const exclusion = batch && (batch.e2e_exclusion_reason || (batch.pr == null ? 'unresolved_pr_batch_identity'
      : metric === 'e2e' && !integration ? 'outside_integration_tests' : null));
    const missing = Array.isArray(batch && batch.missing) ? batch.missing.slice() : [];
    const associationNote = batch && batch.pr == null
      ? '未可靠关联 PR：不推断身份，不生成 PR 链接'
      : workflows.length
        ? '本次集合仅含当前 Integration Tests run/attempt；未采集到其他可靠触发链证据'
        : '缺少来源 run/attempt 证据，按不可关联处理';
    return {
      metric,
      batchId: batch && batch.id,
      prKnown: !!(batch && batch.pr != null),
      pr: batch && batch.pr != null ? batch.pr : null,
      title: (batch && batch.title) || '标题未获取',
      author: (batch && batch.author) || null,
      branch: (batch && batch.branch) || null,
      baseBranch: (batch && batch.base_branch) || null,
      sha: (batch && batch.sha) || null,
      runId: identity.runId,
      attempt: identity.attempt,
      startAt: batch && batch.start_at || null,
      status: batch && batch.status || 'unknown',
      result: normalizeResult(batch && batch.status),
      durationSeconds: duration,
      npuQueueSeconds,
      npuApplicable: integration,
      npuNotApplicableReason: integration ? null : '本记录非 Integration Tests，E2E 不适用',
      exclusionReason: exclusion || null,
      exclusionLabel: exclusion ? (EXCLUSION_LABELS[exclusion] || exclusion) : null,
      missing,
      links: { pr: prUrl, actions, detail: null },
      reliable: {
        members: workflowMembers(batch, asOf),
        note: workflows.length
          ? '本次可靠关联的运行仅来自当前 run/attempt 身份'
          : '未采集到可核验的 workflow 证据',
      },
      focus,
      related: {
        rows: related,
        count: related.length,
        note: related.length
          ? '同提交其他运行不能证明同次触发，不计 E2E，也不改变主点时长'
          : '未发现同提交其他运行（不表示该提交从未触发其他 workflow）',
      },
      npu: { jobs: npuRowsData, queueSeconds: npuQueueSeconds, applicable: integration },
      boundary: {
        collectedAt: opts.collectedAt || null,
        discoveryCutoff: opts.discoveryCutoff || null,
        windowStart: opts.windowStart || null,
        windowEnd: opts.windowEnd || null,
        visibleSamePr: opts.visibleSamePr != null ? opts.visibleSamePr : visiblePrCount(opts.batches, batch && batch.pr),
        associationNote,
        aggregationNote: (batch && batch.aggregation_note) || null,
        startSource: (batch && batch.start_source) || null,
      },
    };
  }

  return {
    normalizeResult, recordResult, safeLink, jobTiming, workflowTiming,
    workflowMembers, focusJobs, focusKey, parseFocusName, relatedIndex,
    sameCommitRuns, npuJobRows, visiblePrCount, hoverModel,
    isIntegrationTestsRecord, EXCLUSION_LABELS, FOCUS_ORDER, FOCUS_LABELS,
  };
});
