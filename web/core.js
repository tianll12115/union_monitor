(function(root){
  function triggerCounts(p){const out={create:0,push:0,retest:0,other:0,unlinked:0,unknownBatches:0},events=[...new Map((p.events||[]).map(e=>[e.id,e])).values()],ids=new Set(events.map(e=>e.id));for(const e of events){out[['create','push','retest'].includes(e.kind)?e.kind:'other']++;if(!(p.batches||[]).some(b=>b.event_id===e.id))out.unlinked++;}out.unknownBatches=(p.batches||[]).filter(b=>!ids.has(b.event_id)).length;return out;}
  function failedWait(p){return (p.batches||[]).filter(b=>b.status==='failure'&&Number.isFinite(b.e2e_ms)&&b.e2e_ms>=0).sort((a,b)=>b.e2e_ms-a.e2e_ms||Number(b.number)-Number(a.number))[0]||null;}
  function detailGroups(pr){const groups=new Map();for(const b of (pr.batches||[])){const key=b.event_id||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b)}const events=[...new Map((pr.events||[]).map(e=>[e.id,e])).values()],seen=new Set(events.map(e=>e.id));const out=events.map(e=>({event:e,batches:groups.get(e.id)||[]}));const unmatched=[...groups.entries()].filter(([key])=>!seen.has(key)).flatMap(([,bs])=>bs);if(unmatched.length){const empty=unmatched.filter(b=>!b.event_id).length;out.push({event:{kind:'unmatched'},batches:unmatched,reason:`${empty} 批 event_id 为空，${unmatched.length-empty} 批 event_id 不在事件列表`})}return out;}
  function stats(values){const a=values.filter(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);if(!a.length)return {n:0,mean:null,p90:null};const qnt=pos=>{const p=(a.length-1)*pos,l=Math.floor(p),h=Math.ceil(p);return l===h?a[l]:a[l]+(a[h]-a[l])*(p-l)};return {n:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p90:qnt(.9)};}
  /* EC-005/EC-004: a median-aware stats variant for the K1/K2/K3 metric cards.
     Kept separate from stats() so the frozen cross-repo aggregate contract
     (validate_multi / verify_ubs_semantics) is unchanged. */
  function statsWithP50(values){const a=values.filter(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);if(!a.length)return {n:0,mean:null,p50:null,p90:null};const qnt=pos=>{const p=(a.length-1)*pos,l=Math.floor(p),h=Math.ceil(p);return l===h?a[l]:a[l]+(a[h]-a[l])*(p-l)};return {n:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p50:qnt(.5),p90:qnt(.9)};}
  function metrics(batches){
    const b=batches.filter(b=>b.eligible&&Number.isFinite(b.e2e_ms)&&b.e2e_ms>=0).sort((a,b)=>b.e2e_ms-a.e2e_ms||Number(b.number)-Number(a.number)||(a.url<b.url?1:a.url>b.url?-1:0))[0];
    const out={representative_batch_url:b?.url??null,representative_batch_number:b?.number??null,e2e_ms:b?.e2e_ms??null};
    for(const k of ['x86','arm','dt']){const tasks=new Map((b?.children||[]).filter(j=>j.kind===k&&j.association_valid&&!j.building&&['SUCCESS','FAILURE','UNSTABLE'].includes(j.result)).map(j=>[j.url,j]));const j=tasks.size===1?[...tasks.values()][0]:{};out[k]={url:j.url??null};for(const f of ['queue','duration','total'])out[k][f+'_ms']=j[f+'_ms']??null;}return out;
  }
  /* PSG-001: submission time = the latest authoritative code submission
     (create from PR.created_at / push from operate_logs). Retests, notes and
     plain comments never update it. New snapshots carry the derived field; old
     snapshots are derived from raw events (legacy-observed). */
  function submissionValue(p){
    if(p==null)return null;
    if(p.submission_time_profile==='ubs-latest-code-submission-v1'){
      const v=p.latest_submission_ms;
      return (typeof v==='number'&&Number.isFinite(v)&&v>=0)?v:null;
    }
    if(p.submission_events_status==='partial'||p.submission_events_status==='unknown')return null;
    const logFailed=(p.issues||[]).some(s=>String(s).includes('操作日志采集失败'));
    if(logFailed)return null;
    let best=null;
    for(const e of (p.events||[])){
      const kind=e.kind,src=e.source||(kind==='create'?'PR.created_at':kind==='push'?'operate_logs':kind);
      if(!((kind==='create'&&src==='PR.created_at')||(kind==='push'&&src==='operate_logs')))continue;
      const v=e.time_ms;
      if(typeof v==='number'&&Number.isInteger(v)&&v>=0&&(best==null||v>best))best=v;
    }
    return best;
  }
  function numDesc(a,b){const an=(typeof a==='number'&&Number.isFinite(a))?a:null,bn=(typeof b==='number'&&Number.isFinite(b))?b:null;if(an==null&&bn==null)return 0;if(an==null)return 1;if(bn==null)return -1;return bn-an;}
  function prIdentityTie(a,b){const na=a.number==null?null:Number(a.number),nb=b.number==null?null:Number(b.number),d=(nb==null?-Infinity:nb)-(na==null?-Infinity:na);if(d)return d;const ra=String(a.repository||''),rb=String(b.repository||'');if(ra!==rb)return ra<rb?-1:1;const ua=String(a.url||''),ub=String(b.url||'');return ua<ub?-1:ua>ub?1:0;}
  function sortPRs(prs,order='e2e'){const value=p=>metrics(p.batches);return [...prs].sort((a,b)=>{if(order==='batches'){const d=b.batches.length-a.batches.length;if(d)return d;const s=numDesc(submissionValue(a),submissionValue(b));if(s)return s;return prIdentityTie(a,b);}if(order==='submitted'||order==='created'){const s=numDesc(submissionValue(a),submissionValue(b));if(s)return s;return prIdentityTie(a,b);}const e=numDesc(value(a).e2e_ms,value(b).e2e_ms);if(e)return e;const s=numDesc(submissionValue(a),submissionValue(b));if(s)return s;return prIdentityTie(a,b);});}
  function aggregate(prs){const values=prs.map(p=>metrics(p.batches)),out={e2e:stats(values.map(v=>v.e2e_ms))};for(const k of ['x86','arm','dt']){out[k]={};for(const f of ['queue','duration','total'])out[k][f]=stats(values.map(v=>v[k][f+'_ms']));}return out;}
  function filterPRs(prs,{state='',quality='',trigger=''}={}){return prs.filter(p=>!trigger||triggerCounts(p)[trigger]>0).filter(p=>!state||p.state===state).filter(p=>!quality||(quality==='complete'?p.batches.length>0&&p.batches.every(b=>b.eligible)&&!(p.issues||[]).length:!p.batches.length||(p.issues||[]).length||p.batches.some(b=>!b.eligible)));}
  function searchPRs(prs,query=''){const q=String(query||'').toLowerCase().trim();return q?prs.filter(p=>[p.number,p.title,p.author,...p.batches.map(b=>b.sha||'')].join(' ').toLowerCase().includes(q)):prs.slice();}
  function repositoryRows(index,snapshots,state=''){return index.repositories.map(entry=>{const snapshot=snapshots[entry.name];const current=!!snapshot&&snapshot.meta.start_ms===index.start_ms&&snapshot.meta.end_ms===index.end_ms;const included=current&&['success','partial'].includes(entry.status);const prs=included?filterPRs(snapshot.prs,{state}):[];return {...entry,current,included,prs,metrics:aggregate(prs),counts:Object.fromEntries(['open','merged','closed'].map(k=>[k,prs.filter(p=>p.state===k).length]))};});}
  function csv(rows){return '\ufeff'+rows.map(row=>row.map(x=>{let s=x==null?'':String(x);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n');}
  /* P-010: versioned export metadata + confirmation summary. The versioned
     fields travel as self-describing metadata (never comment rows at the CSV
     top, which would break existing parsers). */
  function exportMetadata(meta){const m=meta||{};return {format:'ubs-core-export',format_version:1,entity:m.entity||'',scope:m.scope||'',list_condition:m.list_condition||'',count:m.count==null?null:m.count,unit:m.unit||'',duration_unit:m.duration_unit||'分钟',profile_version:m.profile_version||'',submission_time_profile:m.submission_time_profile||'',sort_key:m.sort_key||'',sort_direction:m.sort_direction||'',snapshot_id:m.snapshot_id||'',collected_at:m.collected_at||'',time_basis:m.time_basis||''};}
  function exportSummary(meta){const m=meta||{};const p=[];if(m.entity)p.push('实体：'+m.entity);if(m.scope)p.push('分析范围：'+m.scope);if(m.list_condition)p.push('列表条件：'+m.list_condition);p.push('条数：'+(m.count==null?'—':m.count));if(m.unit)p.push('单位：'+m.unit);p.push('数据版本：'+(m.snapshot_id||'—'));p.push('口径版本：'+(m.profile_version||'—'));return p.join(' · ');}
  async function saveCsv(rows,name,env=root,meta=null){
    const content=csv(rows),host=env.location?.hostname||'',local=['localhost','127.0.0.1','::1'].includes(host);
    if(local){
      const response=await env.fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,csv:content})});
      if(!response.ok)throw Error('HTTP '+response.status);
      return {mode:'saved',...(await response.json()),...(meta?{metadata:exportMetadata(meta)}:{})};
    }
    const blob=new env.Blob([content],{type:'text/csv;charset=utf-8'}),url=env.URL.createObjectURL(blob),anchor=env.document.createElement('a');
    anchor.href=url;anchor.download=name;anchor.click();env.URL.revokeObjectURL(url);
    return {mode:'download',name,...(meta?{metadata:exportMetadata(meta)}:{})};
  }
  function createReloadGate(){let gen=0;return{begin(){return ++gen;},isCurrent(g){return g===gen;}};}
  const api={triggerCounts,failedWait,detailGroups,stats,statsWithP50,metrics,submissionValue,sortPRs,aggregate,filterPRs,searchPRs,repositoryRows,csv,exportMetadata,exportSummary,saveCsv,createReloadGate};if(typeof module!=='undefined')module.exports=api;else root.Metrics=api;
})(typeof window!=='undefined'?window:globalThis);
