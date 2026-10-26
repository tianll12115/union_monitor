'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { urlToRel, toLcov, toIstanbul } = require('./browser/coverage-collector.cjs');

function hasCoverageDeps() {
  try {
    require.resolve('v8-to-istanbul');
    require.resolve('istanbul-lib-coverage');
    return true;
  } catch {
    return false;
  }
}

test('urlToRel maps root and /web/ script URLs to web/*.js and rejects non-scripts', () => {
  assert.equal(urlToRel('http://dashboard.test:18877/app.js'), 'web/app.js');
  assert.equal(urlToRel('http://dashboard.test:18877/web/core.js'), 'web/core.js');
  assert.equal(urlToRel('http://dashboard.test:18877/units.js?v=1'), 'web/units.js');
  assert.equal(urlToRel('http://dashboard.test:18877/index.html'), null);
  assert.equal(urlToRel('not a url'), null);
});

test('toLcov emits SF/DA/end_of_record sorted by path and line', () => {
  const lcov = toLcov({
    '/repo/web/b.js': { l: { 2: 0, 1: 3 } },
    '/repo/web/a.js': { l: { 1: 5 } },
  });
  assert.equal(
    lcov,
    'SF:/repo/web/a.js\nDA:1,5\nend_of_record\n'
    + 'SF:/repo/web/b.js\nDA:1,3\nDA:2,0\nend_of_record\n',
  );
});

test('toLcov returns empty text for no coverage', () => {
  assert.equal(toLcov({}), '');
});

test('toIstanbul converts V8 precise coverage into line coverage', { skip: !hasCoverageDeps() && 'v8-to-istanbul not installed' }, async () => {
  const source = 'const a = 1;\nconst b = a + 1;\n';
  const entry = {
    url: 'http://dashboard.test:18877/web/core.js',
    scriptId: '1',
    source,
    functions: [
      { functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: source.length, count: 1 }] },
    ],
  };
  const out = await toIstanbul([entry]);
  const paths = Object.keys(out);
  assert.equal(paths.length, 1);
  assert.match(paths[0], /web[\\/]core\.js$/);
  assert.equal(out[paths[0]].l['1'], 1);
  assert.equal(out[paths[0]].l['2'], 1);
});

test('toIstanbul ignores non-script URLs and entries without source', { skip: !hasCoverageDeps() && 'v8-to-istanbul not installed' }, async () => {
  const out = await toIstanbul([
    { url: 'http://x/index.html', source: 'x', functions: [] },
    { url: 'http://x/core.js', source: '', functions: [] },
    { url: 'http://x/units.js' },
  ]);
  assert.deepEqual(out, {});
});
