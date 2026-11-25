'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');

const css = readFileSync(resolve(__dirname, '../web/style.css'), 'utf8');

test('motion uses shared timing and native overlay transitions', () => {
  assert.match(css, /--motion-feedback:100ms/);
  assert.match(css, /--motion-content:150ms/);
  assert.match(css, /--motion-overlay:220ms/);
  assert.match(css, /overlay var\(--motion-exit\) allow-discrete/);
  assert.match(css, /@starting-style\s*\{\s*dialog\[open\]/);
  assert.match(css, /\.skel\{[^}]*background:var\(--surface-sunken\)\}/);
  assert.doesNotMatch(css, /animation:[^};]*infinite|transition:width/);
});

test('reduced motion includes backdrop and button-styled links', () => {
  const override = css.slice(css.lastIndexOf('@media(prefers-reduced-motion:reduce)'));
  assert.match(override, /dialog::backdrop\{animation:none!important;transition:none!important\}/);
  assert.match(override, /\.button:active,button:active:not\(:disabled\)\{transform:none\}/);
});
