const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../web/triton-core.js');

test('legacy commit spans never become Integration Tests E2E by changing a label',()=>{
  const original={batches:[{id:'old',pr:2280,status:'success',duration_seconds:172949,npu_queue_seconds:3}]};
  const migrated=core.normalizeE2ePayload(original);
  assert.equal(core.dashboardStats(migrated.batches).valid,0);
  assert.equal(migrated.batches[0].duration_seconds,null);
  assert.equal(migrated.batches[0].npu_queue_seconds,3);
  assert.equal(original.batches[0].duration_seconds,172949);
  assert.match(migrated.e2e_metric_notice,/旧/);
});

test('versioned run metrics keep their evidence and unknown schemas fail closed',()=>{
  const p={e2e_metric_version:2,batches:[{id:'x',duration_seconds:12}]};
  assert.deepEqual(core.normalizeE2ePayload(p),p);
  assert.equal(core.normalizeE2ePayload({...p,e2e_metric_version:99}).batches[0].duration_seconds,null);
});

test('PR history groups observed SHAs and keeps reruns within the same submission',()=>{
  const row=(id,sha,start,pr=7)=>({id,sha,start_at:start,pr,action_name:'Integration Tests'});
  const a=row('a','sha1','2026-10-01T00:00:00Z');
  const rerun={...a,id:'rerun',kind:'rerun',start_at:'2026-10-02T00:00:00Z'};
  const b=row('b','sha2','2026-10-01T12:00:00Z');
  const groups=core.prHistory([b,rerun,a,row('other','sha3','2026-10-01',8)],a);
  assert.deepEqual(groups.map(g=>g.sha),['sha1','sha2']);
  assert.deepEqual(groups[0].rows.map(r=>r.id),['a','rerun']);
  assert.deepEqual(core.prHistory([{...a,pr:null}],{...a,pr:null})[0].rows.map(r=>r.id),['a']);
});

test('true-coordinate overlapping candidates include every selectable point',()=>{
  assert.deepEqual(core.overlapIndices([{i:1,x:2,y:3},{i:2,x:2,y:3},{i:3,x:90,y:90}],2,3),[1,2]);
});
