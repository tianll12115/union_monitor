'use strict';

// Shared browser-test error guard (spec §4 line 102 / PSG-005-AC01).
//
// Wraps the base Playwright `test`/`expect` so every journey collects, for the
// whole test, the following unexpected conditions:
//   - `pageerror` (uncaught page exceptions)
//   - `console.error`
//   - `requestfailed` (network-level failures)
//   - same-origin JS/CSS/JSON or `/data|/api/` responses with status >= 400
//
// After the test body the guard fails the test if ANY such condition was not
// explicitly allow-listed via `allowError`. Fault-injection journeys (e.g. the
// BASIC-009 503 / bad-JSON / timeout cases) mark only their specific injected
// failure as expected, so unrelated errors still fail the suite.
//
// `test`/`expect` stay API-compatible with `@playwright/test` (they delegate to
// the base objects), so `test.skip`, `test.describe`, `expect.poll`, etc. keep
// working. With `fullyParallel:false` and `workers:1` a single module-level
// "currently allowed predicates" list is safe.

const base = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { toIstanbul, toLcov } = require('./coverage-collector.cjs');

let allowedPredicates = [];
let collected = [];
let pendingCoverageEntries = [];
let mergedBrowserCoverage = {};

const REPO = path.join(__dirname, '..', '..');

async function saveBrowserCoverage() {
  const istanbul = await toIstanbul(pendingCoverageEntries);
  pendingCoverageEntries = [];
  for (const [key, fileData] of Object.entries(istanbul)) {
    if (!mergedBrowserCoverage[key]) mergedBrowserCoverage[key] = { path: key, l: {} };
    for (const [line, count] of Object.entries(fileData.l)) {
      const n = Number(count) || 0;
      mergedBrowserCoverage[key].l[line] = Math.max(
        Number(mergedBrowserCoverage[key].l[line]) || 0,
        n,
      );
    }
  }
  const outDir = process.env.COVERAGE_OUT_DIR || path.join(REPO, 'test-results', 'browser-coverage');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'lcov.info'), toLcov(mergedBrowserCoverage));
}

function isKeyResource(url) {
  // Only the application's own critical assets count; external links opened in
  // new tabs and unrelated third-party resources are ignored.
  return /(\.js|\.css|\.json)([?#]|$)/i.test(url) || /(\/data\/|\/api\/)/i.test(url);
}

function matchesAllowed(entry) {
  for (const predicate of allowedPredicates) {
    try {
      if (predicate(entry)) return true;
    } catch (_) {
      // A throwing predicate is treated as non-matching.
    }
  }
  return false;
}

const test = base.test.extend({
  page: async ({ page }, use) => {
    allowedPredicates = [];
    collected = [];
    const record = (entry) => {
      if (!matchesAllowed(entry)) collected.push(entry);
    };
    page.on('pageerror', (error) => {
      record({ kind: 'pageerror', message: String((error && error.message) || error) });
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      // Chromium logs every failed network load to the console itself
      // ("Failed to load resource: ..."); those are already tracked by the
      // response/requestfailed handlers below, and would otherwise double-report
      // the fault-injection failures the tests deliberately allow.
      if (/^Failed to load resource/.test(msg.text())) return;
      record({ kind: 'console', message: msg.text() });
    });
    page.on('requestfailed', (request) => {
      const failure = (request.failure() && request.failure().errorText) || '';
      // The app cancels stale reads via AbortController when reload() runs;
      // that is legitimate in-flight cancellation, not a load failure.
      if (/err_aborted|aborted/i.test(failure)) return;
      record({ kind: 'requestfailed', url: request.url(), failure });
    });
    page.on('response', (response) => {
      if (response.status() < 400) return;
      if (isKeyResource(response.url())) {
        record({ kind: 'response', url: response.url(), status: response.status() });
      }
    });

    await page.coverage.startJSCoverage({ resetOnNavigation: false }).catch(() => {});
    try {
      await use(page);
    } finally {
      const cov = await page.coverage.stopJSCoverage().catch(() => []);
      pendingCoverageEntries.push(...cov);
      await saveBrowserCoverage();
    }

    if (collected.length) {
      const summary = collected.map((entry) => JSON.stringify(entry)).join('\n');
      throw new Error('Unexpected browser errors detected:\n' + summary);
    }
  },
});

function allowError(page, predicate) {
  // `page` is accepted for call-site symmetry with the fault-injection helper;
  // the predicate receives a recorded entry {kind, message, url, status, failure}
  // and must return true for exactly the injected failure to be ignored.
  if (typeof predicate !== 'function') {
    throw new Error('allowError(page, predicate) requires a predicate function');
  }
  allowedPredicates.push(predicate);
}

module.exports = { test, expect: base.expect, allowError };