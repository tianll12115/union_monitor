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

let allowedPredicates = [];
let collected = [];

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
      if (msg.type() === 'error') record({ kind: 'console', message: msg.text() });
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

    await use(page);

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