const {test}=require('node:test');const assert=require('node:assert/strict');const M=require('../web/core.js');

const ms=iso=>Date.parse(iso);
const ev=(kind,at,source)=>{const e={id:`${kind}-${at}`,kind,time_ms:ms(at)};if(source)e.source=source;return e;};
const sample=()=>[
  {number:101,repository:'r',url:'u/101',events:[
     ev('create','2026-10-20T08:00:00+08:00','PR.created_at'),
     ev('push','2026-10-22T08:30:00+08:00','operate_logs'),
     ev('retest','2026-10-22T08:59:00+08:00','comments')]},
  {number:102,repository:'r',url:'u/102',events:[
     ev('create','2026-10-22T08:45:00+08:00','PR.created_at')]},
  {number:103,repository:'r',url:'u/103',events:[
     ev('create','2026-10-19T08:00:00+08:00','PR.created_at'),
     ev('push','2026-10-22T08:55:00+08:00','operate_logs')]},
  {number:104,repository:'r',url:'u/104',events:[
     ev('create','2026-10-18T08:00:00+08:00','PR.created_at'),
     ev('push','2026-10-22T08:55:00+08:00','operate_logs')]},
  {number:105,repository:'r',url:'u/105',events:[]},
];

test('section-6 sample recomputes the expected submission order',()=>{
  assert.deepEqual(M.sortPRs(sample(),'submitted').map(p=>p.number),[104,103,102,101,105]);
});

test('retest at 08:59 does not update the 08:30 push',()=>{
  assert.equal(M.submissionValue(sample()[0]),ms('2026-10-22T08:30:00+08:00'));
});

test('a push without gate participation still counts',()=>{
  assert.equal(M.submissionValue(sample()[2]),ms('2026-10-22T08:55:00+08:00'));
});

test('create-only PR uses its creation time',()=>{
  assert.equal(M.submissionValue(sample()[1]),ms('2026-10-22T08:45:00+08:00'));
});

test('no authoritative events means unknown',()=>{
  assert.equal(M.submissionValue(sample()[4]),null);
});

test('new-snapshot field wins over raw events',()=>{
  const p={number:9,repository:'r',url:'u/9',submission_time_profile:'ubs-latest-code-submission-v1',
           latest_submission_ms:111,events:[ev('push','2026-10-22T09:30:00+08:00','operate_logs')]};
  assert.equal(M.submissionValue(p),111);
});

test('partial and unknown status never fabricate a submission time',()=>{
  const events=[ev('create','2026-10-22T08:00:00+08:00','PR.created_at')];
  assert.equal(M.submissionValue({number:1,repository:'r',url:'u/1',submission_events_status:'partial',events}),null);
  assert.equal(M.submissionValue({number:2,repository:'r',url:'u/2',submission_time_profile:'ubs-latest-code-submission-v1',latest_submission_ms:null}),null);
});

test('a reported operate_logs failure suppresses legacy derivation',()=>{
  const p={number:3,repository:'r',url:'u/3',events:[ev('create','2026-10-22T08:00:00+08:00','PR.created_at')],
           issues:['操作日志采集失败: timeout']};
  assert.equal(M.submissionValue(p),null);
});

test('non-authoritative kinds (note/comment) never update submission time',()=>{
  const p={number:4,repository:'r',url:'u/4',events:[
    ev('create','2026-10-22T08:00:00+08:00','PR.created_at'),
    {id:'note',kind:'note',source:'comments',time_ms:ms('2026-10-22T08:59:00+08:00')}]};
  assert.equal(M.submissionValue(p),ms('2026-10-22T08:00:00+08:00'));
});

test('submitted sort places unknown last and ties by PR number descending',()=>{
  const order=M.sortPRs([
    {number:1,repository:'r',url:'u/1',events:[ev('create','2026-10-22T08:00:00+08:00','PR.created_at')]},
    {number:9,repository:'r',url:'u/9',events:[]},
    {number:5,repository:'r',url:'u/5',events:[ev('create','2026-10-22T09:00:00+08:00','PR.created_at')]},
  ],'submitted').map(p=>p.number);
  assert.deepEqual(order,[5,1,9]);
});

test('ADR-021: a push beyond the snapshot cutoff is excluded, never sorted front',()=>{
  const cutoff=ms('2026-10-22T09:00:00+08:00');
  const p={number:1,repository:'r',url:'u/1',events:[ev('push','2026-10-22T09:30:00+08:00','operate_logs')]};
  assert.equal(M.submissionValue(p,cutoff),null);
});

test('ADR-021: legacy latest_submission_ms=0 is unknown, not epoch zero',()=>{
  const p={number:1,repository:'r',url:'u/1',submission_time_profile:'ubs-latest-code-submission-v1',latest_submission_ms:0};
  assert.equal(M.submissionValue(p),null);
  assert.equal(M.submissionDetail(p).ms,null);
});

test('ADR-021: legacy derivation falls back to the in-window create event when a push is future',()=>{
  const cutoff=ms('2026-10-22T09:00:00+08:00');
  const p={number:1,repository:'r',url:'u/1',events:[
    ev('create','2026-10-22T08:00:00+08:00','PR.created_at'),
    ev('push','2026-10-22T09:30:00+08:00','operate_logs')]};
  assert.equal(M.submissionValue(p,cutoff),ms('2026-10-22T08:00:00+08:00'));
});

test('ADR-021: partial logging failure yields unknown ms, never the observed create time',()=>{
  const cutoff=ms('2026-10-22T09:00:00+08:00');
  const p={number:3,repository:'r',url:'u/3',
    events:[ev('create','2026-10-22T08:00:00+08:00','PR.created_at')],
    issues:['操作日志采集失败: timeout']};
  const d=M.submissionDetail(p,cutoff);
  assert.equal(d.ms,null);
  assert.equal(d.status,'partial');
  assert.equal(M.submissionValue(p,cutoff),null);
});