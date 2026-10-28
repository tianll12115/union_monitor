const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

/* TA-014: 有界定向变异检查。每个整改点都有对应的独立 oracle，且该 oracle 在
   “变异后（重新引入缺陷）”的源码上必须失败，否则视为 oracle 未真正拦截该缺陷。 */

const corePath = require.resolve('../web/triton-core.js');
const viewPath = require.resolve('../web/triton-view.js');
const appPath = require.resolve('../web/app.js');

const read = p => fs.readFileSync(p, 'utf8');

function loadCore(mutate) {
  let src = read(corePath);
  if (mutate) src = mutate(src);
  const moduleShim = { exports: {} };
  // The UMD wrapper assigns the API onto module.exports when a `module` is present.
  new Function('module', src)(moduleShim);
  return moduleShim.exports;
}

function mutationCaught(label, buildOracle, mutate, sourceKind = 'core') {
  test(`${label}: the oracle fails on the mutated source`, () => {
    let oracle;
    if (sourceKind === 'core') {
      oracle = buildOracle(loadCore(null));
    } else {
      oracle = buildOracle(read(sourceKind === 'view' ? viewPath : appPath));
    }
    assert.equal(oracle.holds, true, `baseline oracle must hold: ${oracle.reason}`);
    let mutated;
    if (sourceKind === 'core') {
      mutated = buildOracle(loadCore(mutate));
    } else {
      mutated = buildOracle(mutate(read(sourceKind === 'view' ? viewPath : appPath)));
    }
    assert.equal(mutated.holds, false, `mutation must be caught: ${oracle.reason}`);
  });
}

/* TA-001：纵轴标签不得裁掉高位数字。 */
mutationCaught('crop high-order y-axis labels',
  core => ({
    holds: core.yAxisMarginLeft(['3308.76 min']) >= 11 * 7 + 8 + 6,
    reason: 'the longest label must drive the left margin (11 chars + anchor + pad)',
  }),
  src => src.replace('return Math.max(min, longest + anchorOffset + pad);', 'return min;'));

/* TA-002：防碰撞只能移动展开点，真实锚点不可被静默平移。 */
mutationCaught('silently translating the true anchor',
  core => {
    const layout = core.layoutPoints([{ x: 10, y: 10 }, { x: 11, y: 11 }], 4);
    return {
      holds: layout[1].offset === true && layout[1].anchor.x === 11 && layout[1].anchor.y === 11,
      reason: 'an offset mark must keep its anchor at the true (x=11) position',
    };
  },
  src => src.replace('return { anchor: { x: point.x, y: point.y }, dot: candidate,',
    'return { anchor: { x: candidate.x, y: candidate.y }, dot: candidate,'));

/* TA-006：NPU 图不得误用 E2E 时长作为 NPU 排队。 */
mutationCaught('NPU samples reading the E2E duration',
  core => {
    const row = { status: 'success', duration_seconds: null, npu_queue_seconds: 30 };
    return {
      holds: core.sampleEligible(row, 'npu') === true,
      reason: 'NPU qualification must use npu_queue_seconds, independent of a missing E2E duration',
    };
  },
  src => src.replace('validDuration(row.npu_queue_seconds)', 'validDuration(row.duration_seconds)'));

/* TA-011：导航器反算必须与绘制共用内边距。 */
mutationCaught('navigator ignoring the drawing inset',
  core => ({
    holds: core.navTimeAt(4, 0, 100, 0, 1000, { l: 4, r: 4 }) === 0,
    reason: 'the left inset must map back to the domain start (not 40ms in)',
  }),
  src => src.replace('const plotW = rectWidth - p.l - p.r;', 'const plotW = rectWidth;')
    .replace('const x = Math.max(p.l, Math.min(rectWidth - p.r, clientX - rectLeft));',
      'const x = Math.max(0, Math.min(rectWidth, clientX - rectLeft));')
    .replace('return domainStart + (x - p.l) / plotW * (domainEnd - domainStart);',
      'return domainStart + x / plotW * (domainEnd - domainStart);'));

/* TA-001/TA-003：纵轴数值必须自上而下递减且零在基线（逆转轴 / 把 0 移顶）。 */
mutationCaught('reversing the y-axis direction',
  src => ({
    holds: (src.match(/H - m\.b - v \/ max \* \(H - m\.t - m\.b\)/g) || []).length >= 2,
    reason: 'both charts map the max value to the top and zero to the baseline',
  }),
  src => src.replace(/H - m\.b - v \/ max/g, 'm.t + v / max'), 'view');

mutationCaught('moving zero to the top of the y-axis labels',
  src => ({
    holds: (src.match(/dur\(max \* \(1 - i \/ 4\)\)/g) || []).length >= 2,
    reason: 'the top label must be the maximum and the bottom label zero',
  }),
  src => src.replace(/dur\(max \* \(1 - i \/ 4\)\)/g, 'dur(max * (i / 4))'), 'view');

/* TA-012：详情精确源值必须由秒换算为毫秒再格式化，缺失不得补零。 */
mutationCaught('detail formatting raw seconds instead of milliseconds',
  src => ({
    holds: src.includes('Units.exact(sec*1000)'),
    reason: 'seconds must be converted to ms before the exact formatter runs',
  }),
  src => src.replace('Units.exact(sec*1000)', 'Units.exact(sec)'), 'app');

/* TA-008：固定卡片期间，其它点的 mouseenter 不得覆盖固定身份。 */
mutationCaught('hover overwriting a pinned tip identity',
  src => ({
    holds: src.includes("mark.onmouseenter = e => { clearTimeout(tipTimer); if (!tipPinned) placeTip(e, b, html); };"),
    reason: 'mouseenter must respect the pinned state instead of unconditionally repainting',
  }),
  src => src.replace("mark.onmouseenter = e => { clearTimeout(tipTimer); if (!tipPinned) placeTip(e, b, html); };",
    "mark.onmouseenter = e => { clearTimeout(tipTimer); placeTip(e, b, html); };"), 'view');

/* TA-006：Escape 关闭（原生 close 事件）必须清理详情批次 URL 状态。 */
mutationCaught('Escape close leaving the batch in the URL',
  src => ({
    holds: /addEventListener\('close',[^]*?clearDetailBatch\(\)/.test(src),
    reason: 'the native close listener must clear the Triton detail batch context',
  }),
  src => src.replaceAll('if(window.TritonView?.clearDetailBatch)window.TritonView.clearDetailBatch();', ''), 'app');
