const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '..', 'web', 'shell.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
const tritonView = fs.readFileSync(path.join(__dirname, '..', 'web', 'triton-view.js'), 'utf8');

test('P-002: shell modules load in dependency order before app.js', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)" defer>/g)].map(m => m[1]);
  const idx = name => scripts.indexOf(name);
  assert.ok(idx('catalog.js') > -1, 'catalog.js loaded');
  assert.ok(idx('query-state.js') > idx('catalog.js'), 'query-state after catalog');
  assert.ok(idx('shell.js') > idx('query-state.js'), 'shell after query-state');
  assert.ok(idx('app.js') > idx('shell.js'), 'app owns the published snapshot read');
  /* EC-012: the retired workbench deck scripts are no longer loaded. */
  assert.equal(idx('workbench.js'), -1, 'workbench.js removed');
  assert.equal(idx('status-view.js'), -1, 'status-view.js removed');
  assert.equal(idx('workbench-view.js'), -1, 'workbench-view.js removed');
});

test('EC-001: the workbench view and nav entry are removed and the brand points at the UBS overview', () => {
  assert.doesNotMatch(html, /<section id="workbench-view"/);
  assert.doesNotMatch(html, /data-nav="workbench"/);
  assert.match(html, /href="#projects\/ubs\/overview"/);
});

test('P-011: a project route opens its project view instead of the workbench', () => {
  const { createApp } = require('./helpers/app-harness.cjs');
  const runtime = createApp();
  runtime.run("navigate('#projects/triton/trends')");
  assert.equal(runtime.element('workbench-view').hidden, true);
  assert.equal(runtime.element('triton-view').hidden, false);
});

test('EC-001: shell declares exactly two community entries and no fixed task bar', () => {
  assert.match(shell, /COMMUNITIES\s*=\s*\[/);
  assert.match(shell, /id: 'ubs'[^}]*entry: '#projects\/ubs\/overview'/);
  assert.match(shell, /id: 'triton'[^}]*entry: '#projects\/triton\/engineering'/);
  assert.match(shell, /label: 'UBSCore'/);
  assert.match(shell, /label: 'Triton-Ascend'/);
  assert.doesNotMatch(shell, /FIXED_TASKS/);
});

test('P-009: units.js loads before triton-view and Triton durations unify to minutes', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)" defer>/g)].map(m => m[1]);
  const idx = name => scripts.indexOf(name);
  assert.ok(idx('units.js') > idx('core.js'), 'units after core');
  assert.ok(idx('triton-view.js') > idx('units.js'), 'triton-view after units');
  assert.match(tritonView, /const dur = value => Units\.minutes\(value == null \? null : value \* 1000\)/);
});

test('P-007: detail.js loads before app.js and exposes the unified detail model', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)" defer>/g)].map(m => m[1]);
  const idx = name => scripts.indexOf(name);
  assert.ok(idx('detail.js') > idx('core.js'), 'detail after core');
  assert.ok(idx('app.js') > idx('detail.js'), 'app.js after detail');
  const detail = fs.readFileSync(path.join(__dirname, '..', 'web', 'detail.js'), 'utf8');
  assert.match(detail, /function defaultExpandedBatch/);
  assert.match(detail, /reason: 'no-representative'/);
  assert.match(detail, /'未采集'/);
});

test('P-008: eligibility.js loads before app.js and models the three independent axes', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)" defer>/g)].map(m => m[1]);
  const idx = name => scripts.indexOf(name);
  assert.ok(idx('eligibility.js') > idx('core.js'), 'eligibility after core');
  assert.ok(idx('app.js') > idx('eligibility.js'), 'app.js after eligibility');
  const axes = fs.readFileSync(path.join(__dirname, '..', 'web', 'eligibility.js'), 'utf8');
  assert.match(axes, /function normalizeExecutionResult/);
  assert.match(axes, /function eligibilityFor/);
  assert.match(axes, /'cancelled'/);
});
