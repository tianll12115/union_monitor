// Read-only adversarial probes. No production data or source is mutated.
const fs = require('fs');
const Records = require('../../web/records.js');
const Detail = require('../../web/detail.js');
const Metrics = require('../../web/core.js');
async function main() {
 const out = {};
 const rows = [{id:'zero',duration_ms:0},{id:'negative',duration_ms:-1},{id:'boolean',duration_ms:true},{id:'unknown',duration_ms:null}];
 out.numericSort = Records.sortRecords(rows,'duration','desc');
 out.queueNormalization = [-1,true,0,null].map(queue_ms=>Records.ubsBatchRecords({meta:{repository:'test'},prs:[{number:1,batches:[{url:'x',trigger:{queue_ms}}]}]})[0].queue_ms);
 out.invalidExplicitBatch = Detail.defaultExpandedBatch([{url:'valid',number:2,e2e_ms:1}], {entryId:'expired',representativeUrl:'valid'});
 out.pageSequences = Object.fromEntries([15,30,50].map(size=>[size,Records.mergePages(Array.from({length:31},(_,i)=>({id:String(i),duration_ms:i})), 'duration','desc',size).map(x=>x.id)]));
 let request;
 out.savedFile = await Metrics.saveCsv([['E2E ms'],[60000]],'ux-probe.csv',{location:{hostname:'localhost'},fetch:async(url,opts)=>{request={url,body:JSON.parse(opts.body)};return {ok:true,json:async()=>({url:'/exports/ux-probe.csv'})}}},{unit:'分钟',snapshot_id:'new-release',count:1});
 out.exportRequest=request;
 console.log(JSON.stringify(out,null,2));
}
main();
