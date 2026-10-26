'use strict';

// Converts raw Playwright JS coverage entries (V8 precise-coverage shape:
// { url, scriptId, source, functions }) into LCOV line coverage
// (SF:/DA:/end_of_record) that scripts/verify_changed_coverage.py consumes
// alongside coverage.py and c8 reports. Delegates offset→line and block/
// function merging to v8-to-istanbul + istanbul-lib-coverage (the same stack c8
// uses), keeping the browser numbers consistent with the Node numbers.

const path = require('node:path');
const v8toIstanbul = require('v8-to-istanbul');
const libCoverage = require('istanbul-lib-coverage');

const REPO = path.join(__dirname, '..', '..');

function urlToRel(url) {
  try {
    const p = new URL(url).pathname; // e.g. /web/core.js or /core.js
    if (p.startsWith('/web/') && p.endsWith('.js')) return p.slice(1);
    const name = p.split('/').pop();
    if (name && name.endsWith('.js') && name !== '') return 'web/' + name;
    return null;
  } catch {
    return null;
  }
}

async function convertEntry(entry) {
  const rel = urlToRel(entry && entry.url);
  if (!rel
      || typeof entry.source !== 'string' || entry.source.length === 0
      || !Array.isArray(entry.functions) || entry.functions.length === 0) {
    return null;
  }
  try {
    const abs = path.join(REPO, rel);
    const converter = v8toIstanbul(abs, 0, { source: entry.source });
    await converter.load();
    converter.applyCoverage(entry.functions);
    const raw = converter.toIstanbul();
    const data = Object.values(raw)[0];
    if (!data) return null;
    const fc = new libCoverage.classes.FileCoverage(data);
    return { path: abs, l: fc.getLineCoverage() };
  } catch {
    return null;
  }
}

async function toIstanbul(entries) {
  const out = {};
  for (const entry of entries || []) {
    const converted = await convertEntry(entry);
    if (!converted) continue;
    const key = converted.path;
    if (!out[key]) out[key] = { path: key, l: {} };
    for (const [line, count] of Object.entries(converted.l)) {
      const n = Number(count) || 0;
      out[key].l[line] = Math.max(Number(out[key].l[line]) || 0, n);
    }
  }
  return out;
}

function toLcov(istanbul) {
  const records = [];
  for (const filePath of Object.keys(istanbul || {}).sort()) {
    const fileData = istanbul[filePath];
    records.push('SF:' + filePath);
    const lines = Object.keys(fileData.l || {}).map(Number).sort((a, b) => a - b);
    for (const line of lines) {
      records.push(`DA:${line},${fileData.l[line]}`);
    }
    records.push('end_of_record');
  }
  return records.length ? records.join('\n') + '\n' : '';
}

module.exports = { toIstanbul, toLcov, urlToRel };