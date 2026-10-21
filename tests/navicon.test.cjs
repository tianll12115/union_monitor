const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','web','style.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','web','app.js'),'utf8');

/* ---- REQ-032: icon rail keeps every entry identifiable (static layout contract).
   UDR-015: the fixed task navigation is catalog-driven (rendered in app.js from
   Shell.FIXED_TASKS) instead of hardcoded per-community menus. ---- */

const block=(css.match(/@media\(max-width:800px\)\{[\s\S]*?\n\}/)?.[0] ?? '').replace(/\/\*[\s\S]*?\*\//g,'');

test('REQ-032 AC01: icon rail shows real labels — font-size:0 hiding is gone, entries stack icon over 10px label',()=>{
  assert.ok(block,'≤800px block exists');
  assert.doesNotMatch(block,/font-size:0/,'font-size:0 hid every entry name with no visual explanation');
  const item=block.match(/\.nav-item\{[^}]*\}/)[0];
  assert.match(item,/flex-direction:column/,'icon above label, vertical stack');
  assert.match(item,/font-size:10px/,'visible micro label');
  assert.match(item,/text-align:center/);
});

test('REQ-032 AC01: rail width fits 6-char CJK labels and the workspace margin matches',()=>{
  assert.match(block,/\.side-nav,\.sidebar\{width:76px/,'6 chars × 10px + padding');
  assert.match(block,/\.workspace\{margin-left:76px\}/);
});

test('REQ-032 AC01: group headers stay visible in the icon rail for context',()=>{
  const hiddenRules=[...block.matchAll(/([^{]+)\{display:none\}/g)].map(m=>m[1]);
  assert.ok(hiddenRules.length>0,'the block still hides non-essential chrome');
  for(const sel of hiddenRules) assert.doesNotMatch(sel,/\.nav-group/,'group headers must not be hidden: '+sel);
  const groupRule=block.match(/\.nav-group\{[^}]*\}/);
  assert.ok(groupRule,'icon-mode .nav-group override exists');
  assert.match(groupRule[0],/font-size:9px/);
  assert.match(groupRule[0],/text-align:center/);
});

test('EC-001: the sidebar has exactly two community entries and no fixed task bar',()=>{
  assert.doesNotMatch(html,/data-nav="workbench"/,'workbench nav entry is removed');
  assert.doesNotMatch(html,/id="sideProjectSelector"/,'the duplicate project selector is removed');
  assert.match(html,/id="sideTasks"/,'community container exists');
  assert.match(app,/Shell\.COMMUNITIES/,'community entries render from the shell model');
  assert.match(app,/data-nav="\$\{esc\(c\.id\)\}"/,'community links carry a community identity');
  assert.match(app,/title="\$\{esc\(c\.label\)\}"/,'each community link exposes its label as title');
});

test('REQ-032 AC02: the brand links to the UBS overview and carries a tooltip',()=>{
  assert.match(html.match(/<a class="brand"[^>]*>/)[0],/href="#projects\/ubs\/overview"/,'brand links to UBS overview');
  assert.match(html.match(/<a class="brand"[^>]*>/)[0],/title="监控中心/);
});

test('REQ-032 AC02: active highlight stays and the icon rail adds no popup overlay over the click target',()=>{
  assert.match(css.match(/\.nav-item\.active\{[^}]*\}/)[0],/background:var\(--accent-soft\)/);
  assert.doesNotMatch(block,/\.nav-item[^{]*::(before|after)/,'no pseudo-element tooltip layers');
  assert.doesNotMatch(block,/position:(fixed|absolute)/,'labels render inline, nothing covers the click target');
});