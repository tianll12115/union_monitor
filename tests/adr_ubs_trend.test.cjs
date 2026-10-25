const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../web/core.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');

test('ADR-015: the UBS trend derives per-day P50 via statsWithP50', () => {
  assert.match(app, /Metrics\.statsWithP50\(groups\[d\]\)/);
  assert.match(app, /<polyline class="median-line" points="\$\{points\('p50'\)\}"/);
});

test('ADR-015: every trend day is a focusable mark exposing P50/P90/n', () => {
  assert.match(app, /class="mark-hit" tabindex="0" role="img" data-i=/);
  assert.match(app, /aria-label="日期 \$\{s\.d\} · 平均 \$\{minute\(s\.mean\)\} · P50 \$\{minute\(s\.p50\)\} · P90 \$\{minute\(s\.p90\)\} 分钟 · n=\$\{s\.n\}"/);
  assert.match(app, /showTip\(i\)/);
  assert.match(app, /focusin/);
});

test('ADR-015: statsWithP50 returns a real per-day median distinct from P90', () => {
  const s = M.statsWithP50([600000, 300000, 900000, 300000, 600000]);
  assert.equal(s.p50, 600000);
  assert.equal(s.mean, 540000);
  assert.equal(s.p90, 780000);
  assert.equal(s.n, 5);
});